package com.kiit.worker.model;

public enum AssignmentStatus {
    PENDING,   // No worker available yet; queued for retry
    ASSIGNED,  // Worker assigned and working
    COMPLETED  // Task resolved
}
