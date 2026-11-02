package com.kiit.issue.feign;

import com.kiit.issue.dto.AssignmentRequestDTO;
import com.kiit.issue.dto.AssignmentResponseDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * FeignClient for Worker Service.
 * Called every time a new issue is created to auto-assign an available worker,
 * and when an issue is resolved to decrement the worker's task count.
 */
@FeignClient(name = "WORKER-SERVICE", fallback = WorkerServiceClientFallback.class)
public interface WorkerServiceClient {

    @PostMapping("/api/workers/assign")
    AssignmentResponseDTO assignWorker(@RequestBody AssignmentRequestDTO request);

    @PutMapping("/api/workers/{workerId}/complete/{issueId}")
    Object completeTask(@PathVariable("workerId") Long workerId,
                        @PathVariable("issueId") Long issueId);
}
