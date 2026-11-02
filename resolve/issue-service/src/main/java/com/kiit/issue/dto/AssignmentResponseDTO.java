package com.kiit.issue.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response returned by the Worker Service after attempting worker assignment.
 * status = "ASSIGNED"          → workerID / workerName are populated
 * status = "PENDING_ASSIGNMENT" → no worker available right now; queued
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentResponseDTO {
    private Long workerId;
    private String workerName;
    private String workerType;
    private String status; // "ASSIGNED" | "PENDING_ASSIGNMENT"
}
