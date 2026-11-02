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

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkerAssignmentService {

    /** Maximum tasks a worker can be assigned in a single shift. */
    public static final int MAX_TASKS_PER_DAY = 5;

    private final WorkerRepository workerRepository;
    private final TaskAssignmentRepository taskAssignmentRepository;
    private final IssueServiceClient issueServiceClient;

    // ── Assign a worker to a new complaint ───────────────────────────────────
    @Transactional
    public AssignmentResponseDTO assignWorker(AssignmentRequestDTO request) {
        WorkerType requiredType = WorkerType.fromCategory(request.getCategory());

        // Find the least-loaded available worker of the correct type
        List<Worker> available = workerRepository
                .findAvailableWorkersByType(requiredType, MAX_TASKS_PER_DAY);

        if (!available.isEmpty()) {
            Worker worker = available.get(0); // First = fewest tasks today
            return doAssign(worker, request.getIssueId(), requiredType);
        }

        // No worker free right now → queue the complaint
        log.info("[Worker Service] No {} available for issue {}. Queuing.",
                requiredType, request.getIssueId());

        TaskAssignment pending = new TaskAssignment();
        pending.setIssueId(request.getIssueId());
        pending.setRequiredWorkerType(requiredType);
        pending.setStatus(AssignmentStatus.PENDING);
        taskAssignmentRepository.save(pending);

        return new AssignmentResponseDTO(null, null, requiredType.name(), "PENDING_ASSIGNMENT");
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

        // Immediately try to pick up a queued task for this worker type
        retryPendingForWorkerType(worker.getWorkerType());
    }

    // ── Retry queued assignments for a specific worker type ──────────────────
    @Transactional
    public void retryPendingForWorkerType(WorkerType workerType) {
        List<TaskAssignment> pending = taskAssignmentRepository
                .findByStatusAndRequiredWorkerType(AssignmentStatus.PENDING, workerType);

        for (TaskAssignment assignment : pending) {
            List<Worker> available = workerRepository
                    .findAvailableWorkersByType(workerType, MAX_TASKS_PER_DAY);
            if (available.isEmpty()) break; // No workers free, stop trying

            Worker worker = available.get(0);
            AssignmentResponseDTO resp = doAssign(worker, assignment.getIssueId(), workerType);

            // Remove the PENDING record (replaced by the new ASSIGNED record)
            taskAssignmentRepository.delete(assignment);

            // Notify Issue Service to update the issue record
            try {
                issueServiceClient.updateIssueAssignment(assignment.getIssueId(), resp);
                log.info("[Worker Service] Queued issue {} now assigned to worker {}",
                        assignment.getIssueId(), worker.getName());
            } catch (Exception e) {
                log.error("[Worker Service] Failed to notify Issue Service for issue {}: {}",
                        assignment.getIssueId(), e.getMessage());
            }
        }
    }

    // ── Retry ALL pending assignments (called by scheduler) ──────────────────
    @Transactional
    public void retryAllPending() {
        List<TaskAssignment> pending = taskAssignmentRepository
                .findByStatus(AssignmentStatus.PENDING);

        for (TaskAssignment assignment : pending) {
            List<Worker> available = workerRepository
                    .findAvailableWorkersByType(assignment.getRequiredWorkerType(), MAX_TASKS_PER_DAY);
            if (available.isEmpty()) continue;

            Worker worker = available.get(0);
            AssignmentResponseDTO resp = doAssign(worker, assignment.getIssueId(),
                    assignment.getRequiredWorkerType());
            taskAssignmentRepository.delete(assignment);

            try {
                issueServiceClient.updateIssueAssignment(assignment.getIssueId(), resp);
            } catch (Exception e) {
                log.error("[Worker Service] Retry scheduler — notify failed for issue {}: {}",
                        assignment.getIssueId(), e.getMessage());
            }
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
