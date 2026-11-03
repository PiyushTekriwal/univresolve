package com.kiit.resolve.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "issues")
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

    private String status = "open";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // ── Priority & SLA Fields ─────────────────────────────────────────────────
    @Column(name = "original_priority")
    private String originalPriority = "LOW";

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

    @Column(name = "sla_target_hours")
    private Integer slaTargetHours = 48;

    @Column(name = "sla_due_at")
    private LocalDateTime slaDueAt;

    @Column(name = "sla_status")
    private String slaStatus = "ON_TRACK";

    @Column(name = "sla_breached_at")
    private LocalDateTime slaBreachedAt;

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
}
