package com.kiit.worker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Worker Service — port 8083
 * Responsibilities:
 *   - Worker CRUD (admin registers/removes workers)
 *   - Auto-assignment of workers to complaints (category-matched, least-loaded first)
 *   - Queue pending complaints and retry when a worker becomes free
 *   - Daily reset of task counts at 08:00 AM (start of shift)
 */
@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
@EnableScheduling
public class WorkerServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkerServiceApplication.class, args);
    }
}
