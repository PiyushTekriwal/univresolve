package com.kiit.issue.feign;

import com.kiit.issue.dto.AssignmentRequestDTO;
import com.kiit.issue.dto.AssignmentResponseDTO;
import org.springframework.stereotype.Component;

/**
 * Fallback for WorkerServiceClient.
 * If Worker Service is unavailable, issue is saved with "pending_assignment".
 */
@Component
public class WorkerServiceClientFallback implements WorkerServiceClient {

    @Override
    public AssignmentResponseDTO assignWorker(AssignmentRequestDTO request) {
        return new AssignmentResponseDTO(null, null, null, "PENDING_ASSIGNMENT");
    }

    @Override
    public Object completeTask(Long workerId, Long issueId) {
        // Silently ignore — Worker Service will self-correct on next retry
        return null;
    }
}
