package com.kiit.resolve.service;

import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import com.kiit.resolve.model.SlaStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Anti-Starvation Complaint Scheduling Service.
 * Implements monotonic aging bonus and SLA urgency escalation to prevent complaint starvation.
 */
@Service
@RequiredArgsConstructor
public class ComplaintSchedulingService {

    private final ComplaintPriorityService priorityService;
    private final SlaPolicyService slaPolicyService;
    private final ResolutionTimeEstimationService estimationService;

    // Aging rate: points accumulated per hour of waiting
    public static final double AGING_RATE_PER_HOUR = 1.5;

    /**
     * Calculates the dynamic anti-starvation effective score for an issue at a given time.
     * effectiveScore = basePriorityScore + agingBonus + slaUrgencyBonus
     */
    public double calculateEffectiveScore(Issue issue, LocalDateTime referenceTime) {
        if (issue == null) return 0.0;
        LocalDateTime now = referenceTime != null ? referenceTime : LocalDateTime.now();
        LocalDateTime createdAt = issue.getCreatedAt() != null ? issue.getCreatedAt() : now;

        Priority priority;
        if (issue.getPriority() == null || issue.getPriority().isBlank()) {
            priority = priorityService.evaluatePriority(issue);
        } else {
            priority = Priority.fromString(issue.getPriority());
        }

        // 1. Base Priority Score (CRITICAL=120, HIGH=80, MEDIUM=50, LOW=20)
        double baseScore = priorityService.getBasePriorityScore(priority);

        // 2. Monotonic Aging Bonus based on waiting time
        long waitingHours = Math.max(0, Duration.between(createdAt, now).toHours());
        double agingBonus = waitingHours * AGING_RATE_PER_HOUR;

        // 3. SLA Urgency Bonus (escalates if at risk or overdue)
        double slaBonus = slaPolicyService.getSlaUrgencyBonus(issue, now);

        return Math.round((baseScore + agingBonus + slaBonus) * 100.0) / 100.0;
    }

    /**
     * Ranks open complaints into an actionable, starvation-resistant queue.
     * Filters out non-open complaints, enriches each complaint with live metrics,
     * and sorts deterministically:
     * 1. Effective score descending
     * 2. Submission time ascending (FIFO tie-breaker)
     * 3. ID ascending (deterministic tie-breaker)
     */
    public List<Issue> rankQueue(List<Issue> issues, LocalDateTime referenceTime) {
        if (issues == null) return List.of();
        LocalDateTime now = referenceTime != null ? referenceTime : LocalDateTime.now();

        return issues.stream()
                .filter(issue -> "open".equalsIgnoreCase(issue.getStatus()))
                .map(issue -> enrich(issue, now))
                .sorted(Comparator
                        .comparingDouble(Issue::getEffectiveScore).reversed()
                        .thenComparing(Issue::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Issue::getId, Comparator.nullsLast(Comparator.naturalOrder()))
                )
                .collect(Collectors.toList());
    }

    /**
     * Enriches an issue entity with runtime scheduling scores, SLA status, and remaining time.
     */
    public Issue enrich(Issue issue, LocalDateTime referenceTime) {
        if (issue == null) return null;
        LocalDateTime now = referenceTime != null ? referenceTime : LocalDateTime.now();
        LocalDateTime createdAt = issue.getCreatedAt() != null ? issue.getCreatedAt() : now;

        Priority priority;
        if (issue.getPriority() == null || issue.getPriority().isBlank()) {
            priority = priorityService.evaluatePriority(issue);
            issue.setPriority(priority.name());
        } else {
            priority = Priority.fromString(issue.getPriority());
        }

        // Ensure SLA deadline is set
        if (issue.getSlaDeadline() == null) {
            issue.setSlaDeadline(slaPolicyService.calculateSlaDeadline(createdAt, issue.getCategory(), priority));
        }

        // Live SLA status
        SlaStatus slaStatus = slaPolicyService.evaluateSlaStatus(issue, now);
        issue.setSlaStatus(slaStatus.name());

        // Calculate anti-starvation score
        double score = calculateEffectiveScore(issue, now);
        issue.setEffectiveScore(score);

        // Waiting time
        long waitingHours = Math.max(0, Duration.between(createdAt, now).toHours());
        issue.setWaitingHours(waitingHours);

        // Estimation & Remaining duration
        ResolutionTimeEstimationService.EstimationResult est = estimationService.estimate(issue, now);
        if (issue.getEstimatedResolutionTime() == null) {
            issue.setEstimatedResolutionTime(est.estimatedCompletionTime());
        }
        issue.setRemainingHours(est.remainingHours());
        issue.setOverdueHours(est.overdueHours());
        issue.setIsOverdue(est.isOverdue());
        issue.setRemainingTimeFormatted(est.remainingTimeFormatted());
        issue.setEstimateExplanation(est.explanation());

        return issue;
    }
}

