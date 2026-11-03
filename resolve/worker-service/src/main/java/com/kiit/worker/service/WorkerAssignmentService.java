package com.kiit.worker.service;

import com.kiit.worker.dto.AssignmentRequestDTO;
import com.kiit.worker.dto.AssignmentResponseDTO;
import com.kiit.worker.feign.IssueServiceClient;
import com.kiit.worker.model.*;
import com.kiit.worker.repository.TaskAssignmentRepository;
import com.kiit.worker.repository.WorkerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkerAssignmentService {

    /** Maximum tasks a worker can be assigned in a single shift. */
    public static final int MAX_TASKS_PER_DAY = 5;

    private final WorkerRepository workerRepository;
    private final TaskAssignmentRepository taskAssignmentRepository;
    private final IssueServiceClient issueServiceClient;

    /**
     * Aging formula:
     * Every 6 hours of unresolved waiting time, increase effective priority score by 10 points.
     */
    public static int calculateAgingScore(LocalDateTime createdAt, LocalDateTime asOf) {
        if (createdAt == null || asOf == null) return 0;
        long hours = Duration.between(createdAt, asOf).toHours();
        if (hours < 0) return 0;
        return (int) (hours / 6) * 10;
    }

    public static int calculateEffectiveScore(int baseScore, LocalDateTime createdAt, LocalDateTime asOf) {
        return baseScore + calculateAgingScore(createdAt, asOf);
    }

    /**
     * Priority Queue sorting rule:
     * 1. Highest effective priority score first (descending)
     * 2. If scores are equal, oldest complaint first (createdAt ascending)
     * 3. If creation times are equal, complaint ID as tie-breaker (id ascending)
     */
    public static Comparator<TaskAssignment> queueComparator() {
        return (a, b) -> {
            int scoreA = a.getCurrentPriorityScore();
            int scoreB = b.getCurrentPriorityScore();
            if (scoreA != scoreB) {
                return Integer.compare(scoreB, scoreA); // Descending (highest score first)
            }
            LocalDateTime tA = a.getEffectiveCreatedAt();
            LocalDateTime tB = b.getEffectiveCreatedAt();
            int cmp = tA.compareTo(tB); // Ascending (oldest complaint first)
            if (cmp != 0) {
                return cmp;
            }
            Long idA = a.getIssueId() != null ? a.getIssueId() : a.getId();
            Long idB = b.getIssueId() != null ? b.getIssueId() : b.getId();
            if (idA != null && idB != null) {
                return Long.compare(idA, idB); // Ascending (tie-breaker)
            }
            return 0;
        };
    }

    // ── Assign a worker to a new complaint ───────────────────────────────────
    @Transactional
    public AssignmentResponseDTO assignWorker(AssignmentRequestDTO request) {
        if (request == null || request.getIssueId() == null) {
            throw new IllegalArgumentException("Assignment request and issueId are required");
        }

        // 1. Prevent duplicate assignments for the same complaint
        Optional<TaskAssignment> existingOpt = taskAssignmentRepository.findByIssueId(request.getIssueId());
        if (existingOpt.isPresent()) {
            TaskAssignment existing = existingOpt.get();
            if (existing.getStatus() == AssignmentStatus.ASSIGNED && existing.getWorker() != null) {
                log.info("[Worker Service] Issue {} is already assigned to worker {}",
                        request.getIssueId(), existing.getWorker().getName());
                return new AssignmentResponseDTO(
                        existing.getWorker().getId(),
                        existing.getWorker().getName(),
                        existing.getRequiredWorkerType() != null ? existing.getRequiredWorkerType().name() : null,
                        "ASSIGNED"
                );
            }
        }

        WorkerType requiredType = WorkerType.fromCategory(request.getCategory());
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime issueCreated = request.getCreatedAt() != null ? request.getCreatedAt() : now;
        int baseScore = request.getBasePriorityScore() != null ? request.getBasePriorityScore() : 10;
        int currentScore = calculateEffectiveScore(baseScore, issueCreated, now);

        // 2. Fetch existing pending assignments for this worker type and update their aging scores
        List<TaskAssignment> pendingList = taskAssignmentRepository
                .findByStatusAndRequiredWorkerType(AssignmentStatus.PENDING, requiredType);

        for (TaskAssignment p : pendingList) {
            int bScore = p.getBasePriorityScore();
            int effScore = calculateEffectiveScore(bScore, p.getEffectiveCreatedAt(), now);
            p.setCurrentPriorityScore(effScore);
            p.setPriorityUpdatedAt(now);
        }

        // 3. Check for available workers of the required type
        List<Worker> available = workerRepository
                .findAvailableWorkersByType(requiredType, MAX_TASKS_PER_DAY);

        // If no workers available, save this complaint as PENDING in queue
        if (available.isEmpty()) {
            log.info("[Worker Service] No {} available for issue {}. Queuing with score {}.",
                    requiredType, request.getIssueId(), currentScore);

            TaskAssignment pending = existingOpt.orElseGet(TaskAssignment::new);
            pending.setIssueId(request.getIssueId());
            pending.setRequiredWorkerType(requiredType);
            pending.setStatus(AssignmentStatus.PENDING);
            pending.setPriority(request.getPriority() != null ? request.getPriority() : "LOW");
            pending.setBasePriorityScore(baseScore);
            pending.setCurrentPriorityScore(currentScore);
            pending.setIssueCreatedAt(issueCreated);
            pending.setPriorityUpdatedAt(now);
            if (pending.getCreatedAt() == null) {
                pending.setCreatedAt(now);
            }
            taskAssignmentRepository.save(pending);

            return new AssignmentResponseDTO(null, null, requiredType.name(), "PENDING_ASSIGNMENT");
        }

        // 4. Workers ARE available: Apply Fair Queue ordering
        // Build candidate assignment for the incoming request
        TaskAssignment incomingAssignment = existingOpt.orElseGet(TaskAssignment::new);
        incomingAssignment.setIssueId(request.getIssueId());
        incomingAssignment.setRequiredWorkerType(requiredType);
        incomingAssignment.setStatus(AssignmentStatus.PENDING);
        incomingAssignment.setPriority(request.getPriority() != null ? request.getPriority() : "LOW");
        incomingAssignment.setBasePriorityScore(baseScore);
        incomingAssignment.setCurrentPriorityScore(currentScore);
        incomingAssignment.setIssueCreatedAt(issueCreated);
        incomingAssignment.setPriorityUpdatedAt(now);
        if (incomingAssignment.getCreatedAt() == null) {
            incomingAssignment.setCreatedAt(now);
        }

        List<TaskAssignment> allCandidates = new ArrayList<>(pendingList);
        // Avoid duplicate candidate entry if incoming was already in pendingList
        if (!allCandidates.contains(incomingAssignment)) {
            allCandidates.add(incomingAssignment);
        }

        // Sort candidates by effective score DESC, oldest first, ID tie-breaker
        allCandidates.sort(queueComparator());

        // Assign workers to the highest priority candidates in order
        AssignmentResponseDTO responseForIncoming = null;
        int workerIdx = 0;

        for (TaskAssignment candidate : allCandidates) {
            if (workerIdx >= available.size()) {
                // Out of available workers — candidate remains pending
                if (candidate.getId() == null || !taskAssignmentRepository.existsById(candidate.getId())) {
                    taskAssignmentRepository.save(candidate);
                }
                if (Objects.equals(candidate.getIssueId(), request.getIssueId())) {
                    responseForIncoming = new AssignmentResponseDTO(null, null, requiredType.name(), "PENDING_ASSIGNMENT");
                }
                continue;
            }

            Worker worker = available.get(workerIdx++);
            AssignmentResponseDTO resp = doAssign(worker, candidate.getIssueId(), requiredType);

            // If this candidate was an existing persisted pending assignment, remove the pending record
            if (candidate.getId() != null) {
                taskAssignmentRepository.delete(candidate);
            }

            if (Objects.equals(candidate.getIssueId(), request.getIssueId())) {
                responseForIncoming = resp;
            } else {
                // Notify Issue Service that the queued older complaint has now been assigned
                try {
                    issueServiceClient.updateIssueAssignment(candidate.getIssueId(), resp);
                    log.info("[Worker Service] Higher priority queued issue {} assigned to worker {}",
                            candidate.getIssueId(), worker.getName());
                } catch (Exception e) {
                    log.error("[Worker Service] Failed to notify Issue Service for issue {}: {}",
                            candidate.getIssueId(), e.getMessage());
                }
            }
        }

        return responseForIncoming != null
                ? responseForIncoming
                : new AssignmentResponseDTO(null, null, requiredType.name(), "PENDING_ASSIGNMENT");
    }

    // ── Mark a task as complete (called when issue is resolved) ──────────────
    @Transactional
    public void completeTask(Long workerId, Long issueId) {
        Worker worker = workerRepository.findById(workerId)
                .orElseThrow(() -> new RuntimeException("Worker not found: " + workerId));

        // Decrement task count (floor at 0)
        int newCount = Math.max(0, worker.getTasksToday() - 1);
        worker.setTasksToday(newCount);
        if (newCount < MAX_TASKS_PER_DAY) {
            worker.setStatus(WorkerStatus.IDLE);
        }
        workerRepository.save(worker);

        // Mark assignment as completed
        taskAssignmentRepository.findByIssueId(issueId).ifPresent(a -> {
            a.setStatus(AssignmentStatus.COMPLETED);
            a.setCompletedAt(LocalDateTime.now());
            taskAssignmentRepository.save(a);
        });

        log.info("[Worker Service] Worker {} completed issue {}. tasks_today={}", workerId, issueId, newCount);

        // Immediately try to pick up the next eligible pending task for this worker type
        retryPendingForWorkerType(worker.getWorkerType());
    }

    // ── Retry queued assignments for a specific worker type ──────────────────
    @Transactional
    public void retryPendingForWorkerType(WorkerType workerType) {
        LocalDateTime now = LocalDateTime.now();
        List<TaskAssignment> pending = taskAssignmentRepository
                .findByStatusAndRequiredWorkerType(AssignmentStatus.PENDING, workerType);

        if (pending.isEmpty()) return;

        // Recalculate aging for all pending assignments
        for (TaskAssignment p : pending) {
            int bScore = p.getBasePriorityScore();
            int effScore = calculateEffectiveScore(bScore, p.getEffectiveCreatedAt(), now);
            p.setCurrentPriorityScore(effScore);
            p.setPriorityUpdatedAt(now);
        }

        // Sort by effective priority score DESC, oldest first, ID tie-breaker
        pending.sort(queueComparator());

        for (TaskAssignment assignment : pending) {
            List<Worker> available = workerRepository
                    .findAvailableWorkersByType(workerType, MAX_TASKS_PER_DAY);
            if (available.isEmpty()) break; // No workers free, stop trying

            Worker worker = available.get(0);
            AssignmentResponseDTO resp = doAssign(worker, assignment.getIssueId(), workerType);

            // Remove the PENDING record
            taskAssignmentRepository.delete(assignment);

            // Notify Issue Service to update the issue record
            try {
                issueServiceClient.updateIssueAssignment(assignment.getIssueId(), resp);
                log.info("[Worker Service] Queued issue {} now assigned to worker {} (priority={}, score={})",
                        assignment.getIssueId(), worker.getName(), assignment.getPriority(), assignment.getCurrentPriorityScore());
            } catch (Exception e) {
                log.error("[Worker Service] Failed to notify Issue Service for issue {}: {}",
                        assignment.getIssueId(), e.getMessage());
            }
        }
    }

    // ── Retry ALL pending assignments (called by scheduler) ──────────────────
    @Transactional
    public void retryAllPending() {
        for (WorkerType type : WorkerType.values()) {
            retryPendingForWorkerType(type);
        }
    }

    // ── Reset all workers at shift start (08:00 AM) ──────────────────────────
    @Transactional
    public void resetAllWorkers() {
        List<Worker> workers = workerRepository.findAll();
        for (Worker w : workers) {
            w.setTasksToday(0);
            w.setStatus(WorkerStatus.IDLE);
        }
        workerRepository.saveAll(workers);
        log.info("[Worker Service] Shift reset — {} workers set to IDLE with 0 tasks.", workers.size());
    }

    // ── Private helper: perform the actual assignment ─────────────────────────
    private AssignmentResponseDTO doAssign(Worker worker, Long issueId, WorkerType requiredType) {
        worker.setTasksToday(worker.getTasksToday() + 1);
        if (worker.getTasksToday() >= MAX_TASKS_PER_DAY) {
            worker.setStatus(WorkerStatus.BUSY);
        }
        workerRepository.save(worker);

        TaskAssignment assignment = new TaskAssignment();
        assignment.setIssueId(issueId);
        assignment.setWorker(worker);
        assignment.setRequiredWorkerType(requiredType);
        assignment.setStatus(AssignmentStatus.ASSIGNED);
        assignment.setAssignedAt(LocalDateTime.now());
        taskAssignmentRepository.save(assignment);

        log.info("[Worker Service] Issue {} → {} ({}) [tasks_today={}]",
                issueId, worker.getName(), worker.getWorkerType(), worker.getTasksToday());

        return new AssignmentResponseDTO(
                worker.getId(),
                worker.getName(),
                worker.getWorkerType().name(),
                "ASSIGNED"
        );
    }
}
