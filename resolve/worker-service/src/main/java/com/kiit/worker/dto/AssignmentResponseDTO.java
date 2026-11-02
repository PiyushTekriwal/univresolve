package com.kiit.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Returned to Issue Service after attempting assignment. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentResponseDTO {
    private Long workerId;
    private String workerName;
    private String workerType;
    private String status; // "ASSIGNED" | "PENDING_ASSIGNMENT"
}
