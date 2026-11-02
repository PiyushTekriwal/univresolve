package com.kiit.issue.feign;

import com.kiit.issue.dto.UserDTO;
import org.springframework.stereotype.Component;

/**
 * Fallback for UserServiceClient.
 * Returns null so the caller can distinguish "service unavailable" from a real user.
 */
@Component
public class UserServiceClientFallback implements UserServiceClient {

    @Override
    public UserDTO getUserById(Long id) {
        // Return null — the IssueController will throw 503 if user is null
        return null;
    }
}
