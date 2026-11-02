package com.kiit.worker.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request from Issue Service: "please assign a worker for this issue/category" */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentRequestDTO {
    private Long issueId;
    private String category;
}
