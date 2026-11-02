package com.kiit.worker.feign;

import com.kiit.worker.dto.AssignmentResponseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class IssueServiceClientFallback implements IssueServiceClient {

    @Override
    public Object updateIssueAssignment(Long issueId, AssignmentResponseDTO response) {
        log.warn("[Worker Service] Issue Service unavailable — could not update issue {} assignment", issueId);
        return null;
    }
}
