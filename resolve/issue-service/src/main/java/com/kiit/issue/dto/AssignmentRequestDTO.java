package com.kiit.issue.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request sent from Issue Service → Worker Service to trigger auto-assignment.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentRequestDTO {
    private Long issueId;
    private String category;
}
