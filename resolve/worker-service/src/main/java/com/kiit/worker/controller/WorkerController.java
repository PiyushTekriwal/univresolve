package com.kiit.worker.controller;

import com.kiit.worker.dto.AssignmentRequestDTO;
import com.kiit.worker.dto.AssignmentResponseDTO;
import com.kiit.worker.model.TaskAssignment;
import com.kiit.worker.model.Worker;
import com.kiit.worker.model.WorkerType;
import com.kiit.worker.repository.TaskAssignmentRepository;
import com.kiit.worker.repository.WorkerRepository;
import com.kiit.worker.service.WorkerAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/workers")
@RequiredArgsConstructor
public class WorkerController {

    private final WorkerRepository workerRepository;
    private final TaskAssignmentRepository taskAssignmentRepository;
    private final WorkerAssignmentService assignmentService;

    // ── ADMIN: Register a new worker ─────────────────────────────────────────
    @PostMapping
    public Worker createWorker(@RequestBody Worker worker) {
        if (worker.getName() == null || worker.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Worker name is required");
        }
        if (worker.getWorkerType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Worker type is required");
        }
        worker.setTasksToday(0);
        return workerRepository.save(worker);
    }

    // ── ADMIN: Get all workers ────────────────────────────────────────────────
    @GetMapping
    public List<Worker> getAllWorkers() {
        return workerRepository.findAll();
    }

    // ── Get worker by ID ─────────────────────────────────────────────────────
    @GetMapping("/{id}")
    public Worker getWorkerById(@PathVariable Long id) {
        return workerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker not found"));
    }

    // ── Get workers by type ───────────────────────────────────────────────────
    @GetMapping("/type/{type}")
    public List<Worker> getWorkersByType(@PathVariable String type) {
        try {
            WorkerType wt = WorkerType.valueOf(type.toUpperCase());
            return workerRepository.findByWorkerType(wt);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown worker type: " + type);
        }
    }

    // ── ADMIN: Delete / deactivate a worker ───────────────────────────────────
    @DeleteMapping("/{id}")
    public Map<String, String> deleteWorker(@PathVariable Long id) {
        Worker worker = workerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Worker not found"));
        workerRepository.delete(worker);
        return Map.of("message", "Worker removed successfully");
    }

    // ── AUTO-ASSIGN (called by Issue Service via FeignClient) ─────────────────
    @PostMapping("/assign")
    public AssignmentResponseDTO assignWorker(@RequestBody AssignmentRequestDTO request) {
        return assignmentService.assignWorker(request);
    }

    // ── COMPLETE TASK (called when issue is marked resolved) ──────────────────
    @PutMapping("/{workerId}/complete/{issueId}")
    public Map<String, String> completeTask(@PathVariable Long workerId,
                                            @PathVariable Long issueId) {
        assignmentService.completeTask(workerId, issueId);
        return Map.of("message", "Task marked complete. Worker availability updated.");
    }

    // ── Get all assignments for a worker ─────────────────────────────────────
    @GetMapping("/{workerId}/assignments")
    public List<TaskAssignment> getWorkerAssignments(@PathVariable Long workerId) {
        return taskAssignmentRepository.findByWorker_Id(workerId);
    }

    // ── Get all PENDING (unassigned) complaints ───────────────────────────────
    @GetMapping("/assignments/pending")
    public List<TaskAssignment> getPendingAssignments() {
        return taskAssignmentRepository.findByStatus(
                com.kiit.worker.model.AssignmentStatus.PENDING);
    }
}
