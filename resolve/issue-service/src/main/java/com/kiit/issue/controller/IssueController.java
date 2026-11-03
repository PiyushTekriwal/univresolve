package com.kiit.issue.controller;

import com.kiit.issue.dto.AssignmentRequestDTO;
import com.kiit.issue.dto.AssignmentResponseDTO;
import com.kiit.issue.dto.UserDTO;
import com.kiit.issue.feign.UserServiceClient;
import com.kiit.issue.feign.WorkerServiceClient;
import com.kiit.issue.model.Issue;
import com.kiit.issue.repository.IssueRepository;
import com.kiit.issue.service.SlaIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.annotation.PostConstruct;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@Slf4j
public class IssueController {

    private final IssueRepository issueRepository;
    private final UserServiceClient userServiceClient;
    private final WorkerServiceClient workerServiceClient;
    private final SlaIntegrationService slaIntegrationService;

    // ── CREATE ISSUE ─────────────────────────────────────────────────────────
    @PostMapping
    public Issue createIssue(@RequestBody Issue issue) {

        // 1. Validate required fields
        if (issue.getTitle() == null || issue.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title is required");
        }
        if (issue.getCategory() == null || issue.getCategory().isBlank()) {
            issue.setCategory("other");
        }

        Long userId = issue.getUserId();
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }

        // Validate user existence via User Service with graceful resilience
        try {
            UserDTO user = userServiceClient.getUserById(userId);
            if (user != null) {
                log.info("[Issue Service] Verified user {}: {}", userId, user.getEmail());
            } else {
                log.warn("[Issue Service] User Service returned null for userId {}, proceeding with complaint", userId);
            }
        } catch (feign.FeignException.NotFound e) {
            log.warn("[Issue Service] User {} not found in User Service", userId);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found with ID: " + userId);
        } catch (Exception e) {
            log.warn("[Issue Service] User Service verification skipped or unavailable ({}). Proceeding with submission for userId={}", e.getMessage(), userId);
        }

        // 2. Set creation timestamp and defaults
        if (issue.getCreatedAt() == null) {
            issue.setCreatedAt(LocalDateTime.now());
        }
        issue.setStatus("open");
        issue.setAssignmentStatus("pending_assignment");

        // 3. Delegate to SLA Engine for Priority, SLA target/due date, and ETR prediction
        List<Issue> resolvedHistory = issueRepository.findByStatus("resolved");
        List<Issue> openSameCategory = issueRepository.findByStatusIn(List.of("open", "in_progress"));
        int currentWorkload = (int) openSameCategory.stream()
                .filter(i -> Objects.equals(i.getCategory(), issue.getCategory()))
                .count();

        slaIntegrationService.evaluateNewIssue(issue, resolvedHistory, currentWorkload);

        // 4. Save issue with calculated SLA & Priority
        Issue savedIssue = issueRepository.save(issue);

        // 5. Request worker assignment from Worker Service (Feign call)
        try {
            AssignmentRequestDTO assignReq = new AssignmentRequestDTO(
                    savedIssue.getId(),
                    savedIssue.getCategory(),
                    savedIssue.getPriority(),
                    savedIssue.getBasePriorityScore(),
                    savedIssue.getCurrentPriorityScore(),
                    savedIssue.getCreatedAt()
            );
            AssignmentResponseDTO assignResp = workerServiceClient.assignWorker(assignReq);

            if (assignResp != null && "ASSIGNED".equals(assignResp.getStatus())) {
                savedIssue.setAssignedWorkerId(assignResp.getWorkerId());
                savedIssue.setWorkerName(assignResp.getWorkerName());
                savedIssue.setWorkerType(assignResp.getWorkerType());
                savedIssue.setAssignmentStatus("assigned");
                savedIssue.setStatus("in_progress");
                // Recalculate ETA immediately after assignment
                slaIntegrationService.calculateAndApplyDynamicEta(savedIssue, 0, 1);
            }
            savedIssue = issueRepository.save(savedIssue);

        } catch (Exception e) {
            log.error("[Issue Service] Worker assignment failed for issue {}: {}", savedIssue.getId(), e.getMessage());
        }

        return savedIssue;
    }

    // ── GET ALL ISSUES ROOT (supports GET /api/issues directly) ──────────────
    @GetMapping
    public List<Issue> getAllIssuesRoot() {
        return getAllIssues();
    }

    // ── GET SINGLE ISSUE ─────────────────────────────────────────────────────
    @GetMapping("/{id}")
    public Issue getIssueById(@PathVariable Long id) {
        return issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found"));
    }

    // ── GET ISSUES BY USER ───────────────────────────────────────────────────
    @GetMapping("/user/{userId}")
    public List<Issue> getIssuesByUser(@PathVariable Long userId) {
        List<Issue> userIssues = issueRepository.findByUserId(userId);
        // Refresh remaining minutes on view
        refreshRemainingTime(userIssues);
        return slaIntegrationService.sortIssuesByFairPriority(userIssues);
    }

    // ── ADMIN: GET ALL ISSUES ────────────────────────────────────────────────
    @GetMapping("/admin")
    public List<Issue> getAllIssues() {
        List<Issue> all = issueRepository.findAll();
        refreshRemainingTime(all);
        return slaIntegrationService.sortIssuesByFairPriority(all);
    }

    // ── DASHBOARD: OPEN / IN-PROGRESS ISSUES ────────────────────────────────
    @GetMapping("/dashboard")
    public List<Issue> getOpenIssues() {
        List<Issue> active = issueRepository.findByStatusIn(List.of("open", "in_progress"));
        refreshRemainingTime(active);
        return slaIntegrationService.sortIssuesByFairPriority(active);
    }

    // ── HISTORY: RESOLVED ISSUES ─────────────────────────────────────────────
    @GetMapping("/history")
    public List<Issue> getResolvedIssues() {
        List<Issue> resolved = issueRepository.findByStatus("resolved");
        refreshRemainingTime(resolved);
        resolved.sort((a, b) -> {
            LocalDateTime tA = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
            LocalDateTime tB = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
            return tB.compareTo(tA);
        });
        return resolved;
    }

    // ── MARK AS RESOLVED ─────────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public Map<String, String> resolveIssue(@PathVariable Long id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found"));

        LocalDateTime now = LocalDateTime.now();
        issue.setStatus("resolved");
        issue.setSlaStatus("RESOLVED");
        issue.setEstimatedRemainingMinutes(0L);
        issue.setResolvedAt(now);

        if (issue.getCreatedAt() != null) {
            long minutes = Duration.between(issue.getCreatedAt(), now).toMinutes();
            issue.setActualResolutionMinutes(Math.max(1L, minutes));
        } else {
            issue.setActualResolutionMinutes(120L);
        }

        issueRepository.save(issue);

        // Notify Worker Service if a worker was assigned — decrement their task count
        if (issue.getAssignedWorkerId() != null) {
            try {
                workerServiceClient.completeTask(issue.getAssignedWorkerId(), issue.getId());
            } catch (Exception e) {
                log.warn("[Issue Service] Could not notify Worker Service of task completion: {}", e.getMessage());
            }
        }

        // Recalculate remaining active issues in the same category now that a complaint is completed
        try {
            List<Issue> activeRemaining = issueRepository.findByStatusIn(List.of("open", "in_progress"));
            slaIntegrationService.recalculateActiveIssues(activeRemaining, List.of(issue));
            issueRepository.saveAll(activeRemaining);
        } catch (Exception e) {
            log.warn("[Issue Service] ETA recalculation after resolution: {}", e.getMessage());
        }

        return Map.of("message", "Issue marked as resolved");
    }

    // ── UPDATE ASSIGNMENT (called by Worker Service retry scheduler) ─────────
    @PutMapping("/{id}/assign")
    public Issue updateAssignment(@PathVariable Long id,
                                  @RequestBody AssignmentResponseDTO assignResp) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found"));

        issue.setAssignedWorkerId(assignResp.getWorkerId());
        issue.setWorkerName(assignResp.getWorkerName());
        issue.setWorkerType(assignResp.getWorkerType());
        issue.setAssignmentStatus("assigned");
        issue.setStatus("in_progress");

        // Requirement 10: Recalculate ETA after successful assignment
        slaIntegrationService.calculateAndApplyDynamicEta(issue, 0, 1);

        return issueRepository.save(issue);
    }

    // ── TRIGGER MANUAL SLA RECALCULATION ─────────────────────────────────────
    @PostMapping("/recalculate")
    public Map<String, Object> triggerRecalculate() {
        List<Issue> active = issueRepository.findByStatusIn(List.of("open", "in_progress"));
        List<Issue> history = issueRepository.findByStatus("resolved");

        slaIntegrationService.recalculateActiveIssues(active, history);
        issueRepository.saveAll(active);

        List<Issue> sorted = slaIntegrationService.sortIssuesByFairPriority(active);

        return Map.of(
                "updatedCount", active.size(),
                "timestamp", LocalDateTime.now().toString(),
                "fairQueue", sorted
        );
    }

    // ── ADMIN SLA ANALYTICS & STATS ──────────────────────────────────────────
    @GetMapping("/analytics")
    public Map<String, Object> getSlaAnalytics() {
        List<Issue> all = issueRepository.findAll();

        long total = all.size();
        long open = all.stream().filter(i -> "open".equalsIgnoreCase(i.getStatus())).count();
        long inProgress = all.stream().filter(i -> "in_progress".equalsIgnoreCase(i.getStatus())).count();
        long resolved = all.stream().filter(i -> "resolved".equalsIgnoreCase(i.getStatus())).count();

        long critical = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "CRITICAL".equalsIgnoreCase(i.getEffectivePriority())).count();
        long high = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "HIGH".equalsIgnoreCase(i.getEffectivePriority())).count();
        long medium = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "MEDIUM".equalsIgnoreCase(i.getEffectivePriority())).count();
        long low = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "LOW".equalsIgnoreCase(i.getEffectivePriority())).count();

        long onTrack = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "ON_TRACK".equalsIgnoreCase(i.getSlaStatus())).count();
        long warning = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "WARNING".equalsIgnoreCase(i.getSlaStatus())).count();
        long breached = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()) && "BREACHED".equalsIgnoreCase(i.getSlaStatus())).count();

        long escalated = all.stream().filter(i -> !"resolved".equalsIgnoreCase(i.getStatus())
                && i.getEffectivePriority() != null
                && !i.getEffectivePriority().equalsIgnoreCase(i.getOriginalPriority())).count();

        // Oldest unresolved complaints
        List<Issue> active = all.stream()
                .filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()))
                .sorted(Comparator.comparing(i -> i.getCreatedAt() != null ? i.getCreatedAt() : LocalDateTime.now()))
                .limit(5)
                .toList();

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", total);
        stats.put("open", open);
        stats.put("inProgress", inProgress);
        stats.put("resolved", resolved);
        stats.put("critical", critical);
        stats.put("high", high);
        stats.put("medium", medium);
        stats.put("low", low);
        stats.put("onTrack", onTrack);
        stats.put("warning", warning);
        stats.put("breached", breached);
        stats.put("escalated", escalated);
        stats.put("oldestUnresolved", active);

        return stats;
    }

    @PostConstruct
    public void backfillLegacyResolvedIssues() {
        try {
            List<Issue> resolved = issueRepository.findByStatus("resolved");
            boolean changed = false;
            LocalDateTime now = LocalDateTime.now();
            for (Issue i : resolved) {
                boolean modified = false;
                if (!"RESOLVED".equals(i.getSlaStatus())) {
                    i.setSlaStatus("RESOLVED");
                    modified = true;
                }
                if (i.getEstimatedRemainingMinutes() == null || i.getEstimatedRemainingMinutes() != 0L) {
                    i.setEstimatedRemainingMinutes(0L);
                    modified = true;
                }
                if (i.getResolvedAt() == null) {
                    LocalDateTime created = i.getCreatedAt() != null ? i.getCreatedAt() : now.minusHours(2);
                    long actualMins = (i.getActualResolutionMinutes() != null && i.getActualResolutionMinutes() > 0)
                            ? i.getActualResolutionMinutes() : 120L;
                    i.setActualResolutionMinutes(actualMins);
                    i.setResolvedAt(created.plusMinutes(actualMins));
                    modified = true;
                }
                if (modified) {
                    changed = true;
                }
            }
            if (changed) {
                issueRepository.saveAll(resolved);
                log.info("[Issue Service] Backfilled {} legacy resolved issues with SLA=RESOLVED and timestamps", resolved.size());
            }
        } catch (Exception e) {
            log.warn("[Issue Service] Startup backfill check skipped: {}", e.getMessage());
        }
    }

    private void refreshRemainingTime(List<Issue> issues) {
        LocalDateTime now = LocalDateTime.now();
        for (Issue i : issues) {
            if ("resolved".equalsIgnoreCase(i.getStatus())) {
                i.setEstimatedRemainingMinutes(0L);
                i.setSlaStatus("RESOLVED");
                if (i.getResolvedAt() == null) {
                    LocalDateTime created = i.getCreatedAt() != null ? i.getCreatedAt() : now.minusHours(2);
                    long actualMins = (i.getActualResolutionMinutes() != null && i.getActualResolutionMinutes() > 0)
                            ? i.getActualResolutionMinutes() : 120L;
                    i.setActualResolutionMinutes(actualMins);
                    i.setResolvedAt(created.plusMinutes(actualMins));
                } else if (i.getActualResolutionMinutes() == null && i.getCreatedAt() != null) {
                    long minutes = Duration.between(i.getCreatedAt(), i.getResolvedAt()).toMinutes();
                    i.setActualResolutionMinutes(Math.max(1L, minutes));
                }
                continue;
            }
            if (i.getCreatedAt() != null) {
                long hoursUnresolved = Math.max(0, Duration.between(i.getCreatedAt(), now).toHours());
                int aging = (int) (hoursUnresolved / 6) * 10;
                i.setAgingScore(aging);
                i.setCurrentPriorityScore(i.getBasePriorityScore() + aging);
            }
            if (i.getEstimatedResolutionAt() != null) {
                long rem = Duration.between(now, i.getEstimatedResolutionAt()).toMinutes();
                i.setEstimatedRemainingMinutes(Math.max(15L, rem));
            } else {
                slaIntegrationService.calculateAndApplyDynamicEta(i, 0, 1);
            }
            // Check SLA status if due date passed
            if (i.getSlaDueAt() != null && now.isAfter(i.getSlaDueAt())) {
                i.setSlaStatus("BREACHED");
                if (i.getSlaBreachedAt() == null) {
                    i.setSlaBreachedAt(i.getSlaDueAt());
                }
            }
        }
    }

    @ExceptionHandler(ResponseStatusException.class)
    public org.springframework.http.ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", ex.getStatusCode().value());
        body.put("error", ex.getReason());
        body.put("message", ex.getReason());
        body.put("path", "/api/issues");
        return org.springframework.http.ResponseEntity.status(ex.getStatusCode()).body(body);
    }
}
