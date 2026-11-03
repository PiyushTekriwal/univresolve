package com.kiit.issue.service;

import com.kiit.issue.model.Issue;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class SlaIntegrationService {

    private final RestTemplate restTemplate;
    private final PriorityClassificationService priorityClassificationService;

    @Value("${sla.service.url:http://127.0.0.1:8002}")
    private String slaServiceUrl;

    @Value("${sla.service.token:univ-resolve-sla-secret-token}")
    private String slaServiceToken;

    public SlaIntegrationService(RestTemplateBuilder builder,
                                 PriorityClassificationService priorityClassificationService) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
        this.priorityClassificationService = priorityClassificationService;
    }

    /**
     * Evaluates a newly submitted complaint:
     * 1. Rule-based Priority Classification
     * 2. Sets base and current priority scores
     * 3. Sets SLA targets and due date
     * 4. Computes Dynamic Estimated Resolution Time (ETA)
     */
    public void evaluateNewIssue(Issue issue, List<Issue> resolvedHistory, int currentWorkload) {
        // 1. Automatic rule-based priority prediction
        PriorityClassificationService.PriorityResult prioResult =
                priorityClassificationService.classify(
                        issue.getTitle(),
                        issue.getDescription(),
                        issue.getCategory(),
                        issue.getSeverity()
                );

        String priority = prioResult.priority();
        int baseScore = prioResult.baseScore();

        issue.setPriority(priority);
        issue.setBasePriorityScore(baseScore);
        issue.setCurrentPriorityScore(baseScore);
        issue.setPriorityUpdatedAt(LocalDateTime.now());

        // Compatibility fields
        issue.setOriginalPriority(priority);
        issue.setEffectivePriority(priority);
        issue.setPriorityScore(baseScore);
        issue.setAgingScore(0);

        // 2. SLA Target based on priority
        int slaHours = getSlaTargetHours(priority);
        issue.setSlaTargetHours(slaHours);
        issue.setSlaStatus("ON_TRACK");

        LocalDateTime createdAt = issue.getCreatedAt() != null ? issue.getCreatedAt() : LocalDateTime.now();
        issue.setSlaDueAt(createdAt.plusHours(slaHours));

        // 3. Dynamic Estimated Resolution Time (ETA)
        calculateAndApplyDynamicEta(issue, currentWorkload, 1);

        log.info("[SLA Service] Evaluated new issue #{}: priority={}, baseScore={}, ETA duration={}m",
                issue.getId(), priority, baseScore, issue.getEstimatedDurationMinutes());
    }

    /**
     * Base resolution times by category (in minutes):
     * Electrical: 4h (240m), Plumbing: 3h (180m), Internet: 2h (120m), Sanitation: 3h (180m),
     * Hostel maintenance: 5h (300m), Mess: 2h (120m), Security: 1h (60m), Academics: 24h (1440m), Other: 4h (240m)
     */
    public static long getBaseResolutionMinutes(String category) {
        if (category == null) return 240L;
        return switch (category.trim().toLowerCase()) {
            case "security" -> 60L;       // 1 hour
            case "internet" -> 120L;      // 2 hours
            case "mess" -> 120L;          // 2 hours
            case "plumbing" -> 180L;      // 3 hours
            case "sanitation" -> 180L;    // 3 hours
            case "electrical" -> 240L;    // 4 hours
            case "hostel", "hostel maintenance" -> 300L; // 5 hours
            case "academics" -> 1440L;    // 24 hours
            default -> 240L;              // 4 hours
        };
    }

    /**
     * Priority multipliers:
     * CRITICAL: 0.5x, HIGH: 0.75x, MEDIUM: 1.0x, LOW: 1.25x
     */
    public static double getPriorityMultiplier(String priority) {
        if (priority == null) return 1.0;
        return switch (priority.toUpperCase()) {
            case "CRITICAL" -> 0.5;
            case "HIGH" -> 0.75;
            case "MEDIUM" -> 1.0;
            case "LOW" -> 1.25;
            default -> 1.0;
        };
    }

    public static int getSlaTargetHours(String priority) {
        if (priority == null) return 24;
        return switch (priority.toUpperCase()) {
            case "CRITICAL" -> 4;
            case "HIGH" -> 8;
            case "MEDIUM" -> 24;
            default -> 48;
        };
    }

    /**
     * Calculates dynamic ETA taking into account:
     * 1. Category base resolution time
     * 2. Priority/severity multiplier
     * 3. Number of older/higher priority pending complaints in the queue
     * 4. Available workers of the required type
     * 5. Assignment status (assigned vs pending)
     */
    public void calculateAndApplyDynamicEta(Issue issue, int queueAhead, int availableWorkers) {
        if ("resolved".equalsIgnoreCase(issue.getStatus())) {
            issue.setEstimatedRemainingMinutes(0L);
            issue.setSlaStatus("RESOLVED");
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime createdAt = issue.getCreatedAt() != null ? issue.getCreatedAt() : now;

        long baseMins = getBaseResolutionMinutes(issue.getCategory());
        double multiplier = getPriorityMultiplier(issue.getPriority());
        long adjustedServiceMinutes = Math.max(15L, Math.round(baseMins * multiplier));

        long queueDelayMinutes = 0L;
        boolean isAssigned = "assigned".equalsIgnoreCase(issue.getAssignmentStatus()) ||
                             "in_progress".equalsIgnoreCase(issue.getStatus());

        if (!isAssigned) {
            // Unassigned complaints wait behind other complaints in the queue
            int workers = Math.max(1, availableWorkers);
            // Queue delay based on pending queue ahead and average category service time
            queueDelayMinutes = (long) Math.ceil(((double) queueAhead / workers) * baseMins);
        }

        long totalDurationMinutes = adjustedServiceMinutes + queueDelayMinutes;
        issue.setEstimatedDurationMinutes(totalDurationMinutes);

        LocalDateTime estimatedCompletionAt = createdAt.plusMinutes(totalDurationMinutes);
        if (estimatedCompletionAt.isBefore(now)) {
            // If already overdue or waiting longer than estimate, give realistic future estimate
            estimatedCompletionAt = now.plusMinutes(Math.max(15L, adjustedServiceMinutes / 2));
        }

        issue.setEstimatedResolutionAt(estimatedCompletionAt);
        long remaining = Duration.between(now, estimatedCompletionAt).toMinutes();
        issue.setEstimatedRemainingMinutes(Math.max(15L, remaining));
        issue.setPredictionMethod(isAssigned ? "WORKER_IN_PROGRESS_DYNAMIC" : "PRIORITY_QUEUE_CAPACITY_DYNAMIC");
    }

    /**
     * Batch recalculates aging, effective priority scores, SLA status, and ETAs for all active issues.
     * Prevents starvation by increasing effective score by 10 points every 6 hours.
     */
    public void recalculateActiveIssues(List<Issue> activeIssues, List<Issue> resolvedHistory) {
        if (activeIssues == null || activeIssues.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        // 1. Group active issues by category to calculate queue positions
        Map<String, List<Issue>> byCategory = new HashMap<>();
        for (Issue issue : activeIssues) {
            String cat = (issue.getCategory() != null ? issue.getCategory() : "other").trim().toLowerCase();
            byCategory.computeIfAbsent(cat, k -> new ArrayList<>()).add(issue);
        }

        // 2. Update Aging, Current Priority Score, and Effective Priority for each issue
        for (Issue issue : activeIssues) {
            if ("resolved".equalsIgnoreCase(issue.getStatus())) {
                issue.setSlaStatus("RESOLVED");
                issue.setEstimatedRemainingMinutes(0L);
                continue;
            }

            LocalDateTime createdAt = issue.getCreatedAt() != null ? issue.getCreatedAt() : now;
            long hoursUnresolved = Duration.between(createdAt, now).toHours();
            if (hoursUnresolved < 0) hoursUnresolved = 0;

            // Aging mechanism: +10 points for every 6 hours of unresolved waiting time
            int agingPoints = (int) (hoursUnresolved / 6) * 10;
            int baseScore = issue.getBasePriorityScore();
            int currentScore = baseScore + agingPoints;

            issue.setAgingScore(agingPoints);
            issue.setCurrentPriorityScore(currentScore);
            issue.setPriorityScore(currentScore);
            issue.setPriorityUpdatedAt(now);

            // Escalate effective priority if score reaches higher tiers
            String origPrio = issue.getPriority() != null ? issue.getPriority() : "LOW";
            String newEffective = origPrio;
            if (currentScore >= 100) {
                newEffective = "CRITICAL";
            } else if (currentScore >= 70) {
                newEffective = "HIGH";
            } else if (currentScore >= 40) {
                newEffective = "MEDIUM";
            }

            // Ensure original priority is never reduced
            if (prioRank(newEffective) < prioRank(origPrio)) {
                newEffective = origPrio;
            }

            issue.setEffectivePriority(newEffective);

            if (!newEffective.equalsIgnoreCase(origPrio) || agingPoints > 0) {
                issue.setEscalationReason("Aging starvation prevention guarantee (+" + agingPoints + " pts, " + hoursUnresolved + "h waiting)");
            }

            // SLA Due Date / Breach check
            if (issue.getSlaDueAt() != null && now.isAfter(issue.getSlaDueAt())) {
                issue.setSlaStatus("BREACHED");
                if (issue.getSlaBreachedAt() == null) {
                    issue.setSlaBreachedAt(issue.getSlaDueAt());
                }
            } else if (issue.getSlaTargetHours() != null) {
                long totalMins = issue.getSlaTargetHours() * 60L;
                long elapsedMins = Duration.between(createdAt, now).toMinutes();
                if (elapsedMins >= totalMins * 0.75) {
                    issue.setSlaStatus("WARNING");
                } else {
                    issue.setSlaStatus("ON_TRACK");
                }
            }
        }

        // 3. Recalculate Dynamic ETA for each issue based on queue ahead
        for (Map.Entry<String, List<Issue>> entry : byCategory.entrySet()) {
            List<Issue> catIssues = entry.getValue();
            // Sort by fair priority queue order
            catIssues.sort(issueFairComparator());

            int queuePos = 0;
            for (Issue issue : catIssues) {
                calculateAndApplyDynamicEta(issue, queuePos, 1);
                if ("pending_assignment".equalsIgnoreCase(issue.getAssignmentStatus())) {
                    queuePos++;
                }
            }
        }
    }

    private static int prioRank(String p) {
        if (p == null) return 1;
        return switch (p.toUpperCase()) {
            case "CRITICAL" -> 4;
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            default -> 1;
        };
    }

    /**
     * Comparator for sorting issues in the Fair Priority Queue:
     * 1. Effective / Current Priority Score DESC (highest score first)
     * 2. CreatedAt ASC (oldest complaint first)
     * 3. ID ASC (tie-breaker)
     */
    public static Comparator<Issue> issueFairComparator() {
        return (a, b) -> {
            int scoreA = a.getCurrentPriorityScore() != null ? a.getCurrentPriorityScore() : 10;
            int scoreB = b.getCurrentPriorityScore() != null ? b.getCurrentPriorityScore() : 10;
            if (scoreA != scoreB) {
                return Integer.compare(scoreB, scoreA); // Descending
            }

            LocalDateTime tA = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.now();
            LocalDateTime tB = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.now();
            int cmp = tA.compareTo(tB); // Ascending (oldest first)
            if (cmp != 0) {
                return cmp;
            }

            Long idA = a.getId() != null ? a.getId() : 0L;
            Long idB = b.getId() != null ? b.getId() : 0L;
            return Long.compare(idA, idB);
        };
    }

    /**
     * Sorts complaints using the Fair Priority Queue algorithm.
     */
    public List<Issue> sortIssuesByFairPriority(List<Issue> issues) {
        if (issues == null || issues.size() <= 1) {
            return issues;
        }

        List<Issue> sorted = new ArrayList<>(issues);
        sorted.sort(issueFairComparator());
        return sorted;
    }
}
