package com.kiit.worker.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "task_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TaskAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The issue this assignment is for (stored as plain Long — no cross-service join). */
    @Column(name = "issue_id", nullable = false)
    private Long issueId;

    /** The worker assigned to this issue. Null when status = PENDING (not yet assigned). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "worker_id")
    private Worker worker;

    /** The worker type required for this complaint category. */
    @Enumerated(EnumType.STRING)
    @Column(name = "required_worker_type", nullable = false)
    private WorkerType requiredWorkerType;

    @Enumerated(EnumType.STRING)
    private AssignmentStatus status = AssignmentStatus.PENDING;

    // ── Priority & Aging Queue Fields ─────────────────────────────────────────
    @Column(name = "priority")
    private String priority = "LOW";

    @Column(name = "base_priority_score")
    private Integer basePriorityScore = 10;

    @Column(name = "current_priority_score")
    private Integer currentPriorityScore = 10;

    @Column(name = "issue_created_at")
    private LocalDateTime issueCreatedAt;

    @Column(name = "priority_updated_at")
    private LocalDateTime priorityUpdatedAt;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Integer getBasePriorityScore() {
        if (basePriorityScore != null) return basePriorityScore;
        String p = priority != null ? priority.toUpperCase() : "LOW";
        return switch (p) {
            case "CRITICAL" -> 100;
            case "HIGH" -> 70;
            case "MEDIUM" -> 40;
            default -> 10;
        };
    }

    public Integer getCurrentPriorityScore() {
        return currentPriorityScore != null ? currentPriorityScore : getBasePriorityScore();
    }

    public LocalDateTime getEffectiveCreatedAt() {
        return issueCreatedAt != null ? issueCreatedAt : (createdAt != null ? createdAt : LocalDateTime.now());
    }
}
