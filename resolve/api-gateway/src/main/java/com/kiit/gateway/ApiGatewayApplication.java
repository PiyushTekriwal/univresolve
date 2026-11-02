package com.kiit.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * API Gateway — single entry point for the React frontend (port 8080).
 * Routes /api/users/**   → USER-SERVICE
 *        /api/issues/**  → ISSUE-SERVICE
 *        /api/workers/** → WORKER-SERVICE
 *
 * CORS is configured globally in application.yml so individual services
 * do NOT need @CrossOrigin annotations.
 */
@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
