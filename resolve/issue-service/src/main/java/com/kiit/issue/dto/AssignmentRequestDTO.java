package com.kiit.issue.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Request sent from Issue Service → Worker Service to trigger auto-assignment.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentRequestDTO {
    private Long issueId;
    private String category;
    private String priority;
    private Integer basePriorityScore;
    private Integer currentPriorityScore;
    private LocalDateTime createdAt;

    public AssignmentRequestDTO(Long issueId, String category) {
        this.issueId = issueId;
        this.category = category;
        this.priority = "LOW";
        this.basePriorityScore = 10;
        this.currentPriorityScore = 10;
        this.createdAt = LocalDateTime.now();
    }
}
