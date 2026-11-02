package com.kiit.issue.controller;

import com.kiit.issue.dto.AssignmentRequestDTO;
import com.kiit.issue.dto.AssignmentResponseDTO;
import com.kiit.issue.dto.UserDTO;
import com.kiit.issue.feign.UserServiceClient;
import com.kiit.issue.feign.WorkerServiceClient;
import com.kiit.issue.model.Issue;
import com.kiit.issue.repository.IssueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@Slf4j
public class IssueController {

    private final IssueRepository issueRepository;
    private final UserServiceClient userServiceClient;
    private final WorkerServiceClient workerServiceClient;

    // ── CREATE ISSUE ─────────────────────────────────────────────────────────
    @PostMapping
    public Issue createIssue(@RequestBody Issue issue) {

        // 1. Validate user exists (Feign call to User Service)
        Long userId = issue.getUserId();
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }

        UserDTO user = userServiceClient.getUserById(userId);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "User Service unavailable or user not found");
        }

        // 2. Set defaults and save issue first (get the generated ID)
        issue.setStatus("open");
        issue.setAssignmentStatus("pending_assignment");
        Issue savedIssue = issueRepository.save(issue);

        // 3. Request worker assignment from Worker Service (Feign call)
        try {
            AssignmentRequestDTO assignReq = new AssignmentRequestDTO(
                    savedIssue.getId(),
                    savedIssue.getCategory()
            );
            AssignmentResponseDTO assignResp = workerServiceClient.assignWorker(assignReq);

            if (assignResp != null && "ASSIGNED".equals(assignResp.getStatus())) {
                savedIssue.setAssignedWorkerId(assignResp.getWorkerId());
                savedIssue.setWorkerName(assignResp.getWorkerName());
                savedIssue.setWorkerType(assignResp.getWorkerType());
                savedIssue.setAssignmentStatus("assigned");
                savedIssue.setStatus("in_progress");
            }
            // If PENDING_ASSIGNMENT, fields remain null and assignment_status stays "pending_assignment"
            savedIssue = issueRepository.save(savedIssue);

        } catch (Exception e) {
            log.error("[Issue Service] Worker assignment failed for issue {}: {}", savedIssue.getId(), e.getMessage());
            // Issue still saved — will be picked up by Worker Service retry scheduler
        }

        return savedIssue;
    }

    // ── GET SINGLE ISSUE ─────────────────────────────────────────────────────
    @GetMapping("/{id}")
    public Issue getIssueById(@PathVariable Long id) {
        return issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found"));
    }

    // ── GET ISSUES BY USER ───────────────────────────────────────────────────
    @GetMapping("/user/{userId}")
    public List<Issue> getIssuesByUser(@PathVariable Long userId) {
        return issueRepository.findByUserId(userId);
    }

    // ── ADMIN: GET ALL ISSUES ────────────────────────────────────────────────
    @GetMapping("/admin")
    public List<Issue> getAllIssues() {
        return issueRepository.findAll();
    }

    // ── DASHBOARD: OPEN / IN-PROGRESS ISSUES ────────────────────────────────
    @GetMapping("/dashboard")
    public List<Issue> getOpenIssues() {
        return issueRepository.findByStatus("open");
    }

    // ── HISTORY: RESOLVED ISSUES ─────────────────────────────────────────────
    @GetMapping("/history")
    public List<Issue> getResolvedIssues() {
        return issueRepository.findByStatus("resolved");
    }

    // ── MARK AS RESOLVED ─────────────────────────────────────────────────────
    // Also notifies Worker Service to decrement that worker's task count
    // so they become available for the next queued complaint.
    @DeleteMapping("/{id}")
    public Map<String, String> resolveIssue(@PathVariable Long id) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found"));

        issue.setStatus("resolved");
        issueRepository.save(issue);

        // Notify Worker Service if a worker was assigned — decrement their task count
        if (issue.getAssignedWorkerId() != null) {
            try {
                workerServiceClient.completeTask(issue.getAssignedWorkerId(), issue.getId());
            } catch (Exception e) {
                log.warn("[Issue Service] Could not notify Worker Service of task completion: {}", e.getMessage());
            }
        }

        return Map.of("message", "Issue marked as resolved");
    }

    // ── UPDATE ASSIGNMENT (called by Worker Service retry scheduler) ─────────
    @PutMapping("/{id}/assign")
    public Issue updateAssignment(@PathVariable Long id,
                                  @RequestBody AssignmentResponseDTO assignResp) {
        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Issue not found"));

        issue.setAssignedWorkerId(assignResp.getWorkerId());
        issue.setWorkerName(assignResp.getWorkerName());
        issue.setWorkerType(assignResp.getWorkerType());
        issue.setAssignmentStatus("assigned");
        issue.setStatus("in_progress");

        return issueRepository.save(issue);
    }
}
