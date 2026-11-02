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

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
