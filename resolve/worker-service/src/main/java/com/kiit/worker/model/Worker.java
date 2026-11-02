package com.kiit.worker.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "workers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Worker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true)
    private String email;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "worker_type", nullable = false)
    private WorkerType workerType;

    @Enumerated(EnumType.STRING)
    private WorkerStatus status = WorkerStatus.IDLE;

    /** Number of tasks assigned today. Resets at 08:00 AM (shift start). */
    @Column(name = "tasks_today")
    private int tasksToday = 0;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
