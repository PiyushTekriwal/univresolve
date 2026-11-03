package com.kiit.issue.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Issue entity — microservices version.
 * Augmented with SLA, Priority, Aging/Starvation Prevention, and Estimated Resolution Time fields.
 */
@Entity
@Table(name = "issues", indexes = {
    @Index(name = "idx_issues_status", columnList = "status"),
    @Index(name = "idx_issues_user_id", columnList = "user_id"),
    @Index(name = "idx_issues_effective_prio", columnList = "effective_priority"),
    @Index(name = "idx_issues_sla_status", columnList = "sla_status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Issue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String category;

    // "open" | "in_progress" | "resolved"
    private String status = "open";

    // Stored as plain Long — no cross-service JPA join
    @Column(name = "user_id")
    private Long userId;

    // Accepts either {"userId": 1} or {"user": {"id": 1}} from client/tests
    @JsonProperty("user")
    public void setUserObject(Map<String, Object> userMap) {
        if (userMap != null && userMap.containsKey("id") && userMap.get("id") != null) {
            this.userId = ((Number) userMap.get("id")).longValue();
        }
    }

    // ── Worker assignment fields (populated by Worker Service) ────────────────
    @Column(name = "assigned_worker_id")
    private Long assignedWorkerId;

    @Column(name = "worker_name")
    private String workerName;

    @Column(name = "worker_type")
    private String workerType;

    // "assigned" | "pending_assignment"
    @Column(name = "assignment_status")
    private String assignmentStatus = "pending_assignment";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    // ── Priority & Starvation Prevention Fields ──────────────────────────────
    // CRITICAL | HIGH | MEDIUM | LOW
    @Column(name = "priority")
    private String priority = "LOW";

    @Column(name = "base_priority_score")
    private Integer basePriorityScore = 10;

    @Column(name = "current_priority_score")
    private Integer currentPriorityScore = 10;

    @Column(name = "priority_updated_at")
    private LocalDateTime priorityUpdatedAt;

    // ── Legacy / Compatibility Priority & Scoring Fields ───────────────────────
    // CRITICAL | HIGH | MEDIUM | LOW
    @Column(name = "original_priority")
    private String originalPriority = "LOW";

    // Effective priority after aging escalation or SLA breach
    @Column(name = "effective_priority")
    private String effectivePriority = "LOW";

    @Column(name = "priority_score")
    private Integer priorityScore = 10;

    @Column(name = "aging_score")
    private Integer agingScore = 0;

    @Column(name = "severity")
    private String severity;

    @Column(name = "impact")
    private String impact;

    @Column(name = "affected_students")
    private Integer affectedStudents = 1;

    @Column(name = "escalation_reason", columnDefinition = "TEXT")
    private String escalationReason;

    // ── SLA Management Fields ─────────────────────────────────────────────────
    // Target duration in hours: 4 (CRITICAL), 8 (HIGH), 24 (MEDIUM), 48 (LOW)
    @Column(name = "sla_target_hours")
    private Integer slaTargetHours = 48;

    @Column(name = "sla_due_at")
    private LocalDateTime slaDueAt;

    // ON_TRACK | WARNING | BREACHED | RESOLVED
    @Column(name = "sla_status")
    private String slaStatus = "ON_TRACK";

    @Column(name = "sla_breached_at")
    private LocalDateTime slaBreachedAt;

    // ── Estimated Resolution Time (ETR) Fields ────────────────────────────────
    @Column(name = "estimated_duration_minutes")
    private Long estimatedDurationMinutes;

    @Column(name = "estimated_resolution_at")
    private LocalDateTime estimatedResolutionAt;

    @Column(name = "estimated_remaining_minutes")
    private Long estimatedRemainingMinutes;

    @Column(name = "actual_resolution_minutes")
    private Long actualResolutionMinutes;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "prediction_method")
    private String predictionMethod;

    public String getPriority() {
        if (priority != null && !priority.isBlank()) {
            return priority;
        }
        if (effectivePriority != null && !effectivePriority.isBlank()) {
            return effectivePriority;
        }
        return originalPriority != null ? originalPriority : "LOW";
    }

    public void setPriority(String newPriority) {
        this.priority = newPriority;
        if (this.originalPriority == null || "LOW".equalsIgnoreCase(this.originalPriority)) {
            this.originalPriority = newPriority;
        }
        if (this.effectivePriority == null || "LOW".equalsIgnoreCase(this.effectivePriority)) {
            this.effectivePriority = newPriority;
        }
    }

    public Integer getBasePriorityScore() {
        if (basePriorityScore != null) {
            return basePriorityScore;
        }
        String p = getPriority();
        return switch (p != null ? p.toUpperCase() : "LOW") {
            case "CRITICAL" -> 100;
            case "HIGH" -> 70;
            case "MEDIUM" -> 40;
            default -> 10;
        };
    }

    public Integer getCurrentPriorityScore() {
        if (currentPriorityScore != null) {
            return currentPriorityScore;
        }
        if (priorityScore != null) {
            return priorityScore;
        }
        return getBasePriorityScore();
    }

    public void setCurrentPriorityScore(Integer score) {
        this.currentPriorityScore = score;
        this.priorityScore = score;
        int base = getBasePriorityScore();
        this.agingScore = Math.max(0, (score != null ? score : base) - base);
    }
}
