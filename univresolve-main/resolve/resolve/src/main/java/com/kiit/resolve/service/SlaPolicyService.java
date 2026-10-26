package com.kiit.resolve.service;

import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.Priority;
import com.kiit.resolve.model.SlaStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Service managing SLA policies, deadlines, and urgency calculations.
 */
@Service
public class SlaPolicyService {

    // Default SLA target hours by Category & Priority
    private static final Map<String, Integer> DEFAULT_CATEGORY_SLA_HOURS = Map.of(
            "security", 8,
            "electrical", 16,
            "plumbing", 20,
            "mess", 18,
            "sanitation", 20,
            "internet", 24,
            "hostel", 36,
            "academics", 48,
            "other", 48
    );

    /**
     * Determines SLA target duration in hours based on category and priority.
     */
    public int getSlaTargetHours(String category, Priority priority) {
        if (priority == Priority.CRITICAL) {
            return 4; // 4-hour strict SLA for life-safety emergencies
        }

        String cat = category != null ? category.trim().toLowerCase() : "other";
        int baseHours = DEFAULT_CATEGORY_SLA_HOURS.getOrDefault(cat, 36);

        if (priority == Priority.HIGH) {
            return Math.max(6, (int) Math.round(baseHours * 0.6));
        } else if (priority == Priority.LOW) {
            return (int) Math.round(baseHours * 1.5);
        }

        return baseHours; // MEDIUM
    }

    /**
     * Calculates SLA deadline from creation time.
     */
    public LocalDateTime calculateSlaDeadline(LocalDateTime createdAt, String category, Priority priority) {
        LocalDateTime start = createdAt != null ? createdAt : LocalDateTime.now();
        int targetHours = getSlaTargetHours(category, priority);
        return start.plusHours(targetHours);
    }

    /**
     * Evaluates live SLA status (ON_TRACK, AT_RISK, OVERDUE) for an issue at a given time.
     */
    public SlaStatus evaluateSlaStatus(Issue issue, LocalDateTime referenceTime) {
        if (issue == null) return SlaStatus.ON_TRACK;
        if ("resolved".equalsIgnoreCase(issue.getStatus())) {
            return SlaStatus.ON_TRACK;
        }

        LocalDateTime deadline = issue.getSlaDeadline();
        if (deadline == null) {
            Priority priority = Priority.fromString(issue.getPriority());
            deadline = calculateSlaDeadline(issue.getCreatedAt(), issue.getCategory(), priority);
        }

        LocalDateTime now = referenceTime != null ? referenceTime : LocalDateTime.now();

        if (now.isAfter(deadline)) {
            return SlaStatus.OVERDUE;
        }

        LocalDateTime start = issue.getCreatedAt() != null ? issue.getCreatedAt() : now;
        long totalMinutes = Math.max(1, Duration.between(start, deadline).toMinutes());
        long remainingMinutes = Duration.between(now, deadline).toMinutes();

        // If less than 25% time remains or under 3 hours, mark AT_RISK
        if (remainingMinutes <= 180 || ((double) remainingMinutes / totalMinutes) < 0.25) {
            return SlaStatus.AT_RISK;
        }

        return SlaStatus.ON_TRACK;
    }

    /**
     * Calculates urgency bonus to add to effective scheduling score.
     */
    public double getSlaUrgencyBonus(Issue issue, LocalDateTime referenceTime) {
        if (issue == null) return 0.0;
        SlaStatus status = evaluateSlaStatus(issue, referenceTime);

        LocalDateTime now = referenceTime != null ? referenceTime : LocalDateTime.now();
        LocalDateTime deadline = issue.getSlaDeadline();

        return switch (status) {
            case OVERDUE -> {
                long overdueHours = deadline != null && now.isAfter(deadline)
                        ? Duration.between(deadline, now).toHours()
                        : 0;
                // Monotonically increasing penalty: base 50 + 2 points per overdue hour
                yield 50.0 + (overdueHours * 2.0);
            }
            case AT_RISK -> 25.0;
            case ON_TRACK -> 0.0;
        };
    }
}

