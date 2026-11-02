package com.kiit.issue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;

/**
 * Issue Service — port 8082
 * Handles: complaint creation, status updates, history
 * Communicates with:
 *   - USER-SERVICE  (via FeignClient) to validate users
 *   - WORKER-SERVICE (via FeignClient) to auto-assign workers
 * Registers with Eureka as "ISSUE-SERVICE"
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
public class IssueServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IssueServiceApplication.class, args);
    }
}
