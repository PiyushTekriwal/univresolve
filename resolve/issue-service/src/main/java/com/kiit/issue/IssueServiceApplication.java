package com.kiit.issue;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Issue Service — port 8082
 * Handles: complaint creation, status updates, history, SLA monitoring, and aging escalation
 * Communicates with:
 *   - USER-SERVICE  (via FeignClient) to validate users
 *   - WORKER-SERVICE (via FeignClient) to auto-assign workers
 *   - PYTHON SLA SERVICE (via REST) for priority scoring, aging, and ETR prediction
 * Registers with Eureka as "ISSUE-SERVICE"
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@EnableScheduling
public class IssueServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IssueServiceApplication.class, args);
    }
}
