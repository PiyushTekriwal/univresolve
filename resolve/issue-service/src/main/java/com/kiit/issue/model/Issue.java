package com.kiit.issue.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Issue entity — microservices version.
 * No JPA @ManyToOne to User; we store userId as a plain Long
 * so the Issue Service stays independent of the User Service's DB.
 */
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

    // "open" | "in_progress" | "resolved"
    private String status = "open";

    // Stored as plain Long — no cross-service JPA join
    @Column(name = "user_id")
    private Long userId;

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
}
