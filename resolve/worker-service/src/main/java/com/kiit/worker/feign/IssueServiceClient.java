package com.kiit.worker.feign;

import com.kiit.worker.dto.AssignmentResponseDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * FeignClient for Issue Service.
 * Called by the Worker Service retry scheduler to update an issue's
 * assignment details once a previously queued complaint gets a worker.
 */
@FeignClient(name = "ISSUE-SERVICE", fallback = IssueServiceClientFallback.class)
public interface IssueServiceClient {

    @PutMapping("/api/issues/{id}/assign")
    Object updateIssueAssignment(@PathVariable("id") Long issueId,
                                 @RequestBody AssignmentResponseDTO response);
}
