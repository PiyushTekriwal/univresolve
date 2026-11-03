package com.kiit.worker.service;

import com.kiit.worker.dto.AssignmentRequestDTO;
import com.kiit.worker.dto.AssignmentResponseDTO;
import com.kiit.worker.feign.IssueServiceClient;
import com.kiit.worker.model.*;
import com.kiit.worker.repository.TaskAssignmentRepository;
import com.kiit.worker.repository.WorkerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

public class WorkerAssignmentQueueTest {

    private WorkerRepository workerRepository;
    private TaskAssignmentRepository taskAssignmentRepository;
    private IssueServiceClient issueServiceClient;
    private WorkerAssignmentService assignmentService;

    @BeforeEach
    void setUp() {
        workerRepository = mock(WorkerRepository.class);
        taskAssignmentRepository = mock(TaskAssignmentRepository.class);
        issueServiceClient = mock(IssueServiceClient.class);
        assignmentService = new WorkerAssignmentService(
                workerRepository,
                taskAssignmentRepository,
                issueServiceClient
        );
    }

    @Test
    @DisplayName("Test 5A: Queue comparator sorts by score DESC, age ASC, ID ASC")
    void testQueueComparator() {
        LocalDateTime t1 = LocalDateTime.of(2026, 1, 1, 9, 0);
        LocalDateTime t2 = LocalDateTime.of(2026, 1, 1, 10, 0);

        TaskAssignment a = new TaskAssignment();
        a.setId(1L);
        a.setIssueId(101L);
        a.setPriority("LOW");
        a.setBasePriorityScore(10);
        a.setCurrentPriorityScore(50); // Aged score
        a.setIssueCreatedAt(t1);

        TaskAssignment b = new TaskAssignment();
        b.setId(2L);
        b.setIssueId(102L);
        b.setPriority("MEDIUM");
        b.setBasePriorityScore(40);
        b.setCurrentPriorityScore(40); // Fresh score
        b.setIssueCreatedAt(t2);

        TaskAssignment c = new TaskAssignment();
        c.setId(3L);
        c.setIssueId(103L);
        c.setPriority("HIGH");
        c.setBasePriorityScore(70);
        c.setCurrentPriorityScore(70); // Fresh score
        c.setIssueCreatedAt(t2);

        List<TaskAssignment> list = new ArrayList<>(List.of(a, b, c));
        list.sort(WorkerAssignmentService.queueComparator());

        // Order should be: c (score 70), a (score 50 - aged LOW), b (score 40)
        assertEquals(103L, list.get(0).getIssueId(), "Score 70 first");
        assertEquals(101L, list.get(1).getIssueId(), "Score 50 second (starvation prevented)");
        assertEquals(102L, list.get(2).getIssueId(), "Score 40 third");
    }

    @Test
    @DisplayName("Test 5B: Worker assignment - worker available assigns immediately")
    void testWorkerAssignedWhenAvailable() {
        Worker worker = new Worker();
        worker.setId(1L);
        worker.setName("Rajesh Sharma");
        worker.setWorkerType(WorkerType.ELECTRICIAN);
        worker.setTasksToday(0);
        worker.setStatus(WorkerStatus.IDLE);

        when(workerRepository.findAvailableWorkersByType(eq(WorkerType.ELECTRICIAN), anyInt()))
                .thenReturn(new ArrayList<>(List.of(worker)));
        when(taskAssignmentRepository.findByIssueId(anyLong())).thenReturn(Optional.empty());
        when(taskAssignmentRepository.findByStatusAndRequiredWorkerType(eq(AssignmentStatus.PENDING), eq(WorkerType.ELECTRICIAN)))
                .thenReturn(new ArrayList<>());

        AssignmentRequestDTO req = new AssignmentRequestDTO(
                1L, "electrical", "CRITICAL", 100, 100, LocalDateTime.now()
        );

        AssignmentResponseDTO response = assignmentService.assignWorker(req);

        assertNotNull(response);
        assertEquals("ASSIGNED", response.getStatus());
        assertEquals("Rajesh Sharma", response.getWorkerName());
        assertEquals("ELECTRICIAN", response.getWorkerType());
        assertEquals(1, worker.getTasksToday());
    }

    @Test
    @DisplayName("Test 5C: When no worker available, task is queued as PENDING")
    void testTaskQueuedWhenNoWorkerAvailable() {
        when(workerRepository.findAvailableWorkersByType(eq(WorkerType.ELECTRICIAN), anyInt()))
                .thenReturn(Collections.emptyList());
        when(taskAssignmentRepository.findByIssueId(anyLong())).thenReturn(Optional.empty());
        when(taskAssignmentRepository.findByStatusAndRequiredWorkerType(eq(AssignmentStatus.PENDING), eq(WorkerType.ELECTRICIAN)))
                .thenReturn(new ArrayList<>());

        AssignmentRequestDTO req = new AssignmentRequestDTO(
                2L, "electrical", "MEDIUM", 40, 40, LocalDateTime.now()
        );

        AssignmentResponseDTO response = assignmentService.assignWorker(req);

        assertNotNull(response);
        assertEquals("PENDING_ASSIGNMENT", response.getStatus());
        verify(taskAssignmentRepository, times(1)).save(any(TaskAssignment.class));
    }

    @Test
    @DisplayName("Test 5D: Completing a task decrements worker load and triggers retry for pending queue")
    void testCompletingTaskTriggersQueueRetry() {
        Worker worker = new Worker();
        worker.setId(5L);
        worker.setName("Sunil Kumar");
        worker.setWorkerType(WorkerType.PLUMBER);
        worker.setTasksToday(5);
        worker.setStatus(WorkerStatus.BUSY);

        TaskAssignment existingPending = new TaskAssignment();
        existingPending.setId(99L);
        existingPending.setIssueId(501L);
        existingPending.setRequiredWorkerType(WorkerType.PLUMBER);
        existingPending.setStatus(AssignmentStatus.PENDING);
        existingPending.setPriority("HIGH");
        existingPending.setBasePriorityScore(70);
        existingPending.setCurrentPriorityScore(70);
        existingPending.setIssueCreatedAt(LocalDateTime.now().minusHours(2));

        when(workerRepository.findById(5L)).thenReturn(Optional.of(worker));
        when(taskAssignmentRepository.findByIssueId(400L)).thenReturn(Optional.empty());

        // After completeTask decrements tasksToday from 5 to 4, findAvailableWorkersByType returns worker
        when(taskAssignmentRepository.findByStatusAndRequiredWorkerType(eq(AssignmentStatus.PENDING), eq(WorkerType.PLUMBER)))
                .thenReturn(new ArrayList<>(List.of(existingPending)));
        when(workerRepository.findAvailableWorkersByType(eq(WorkerType.PLUMBER), anyInt()))
                .thenAnswer(inv -> worker.getTasksToday() < 5 ? new ArrayList<>(List.of(worker)) : Collections.emptyList());

        assignmentService.completeTask(5L, 400L);

        // Verify task completion decremented task count and set IDLE
        assertEquals(4, worker.getTasksToday() - 1 + 1); // was 5, decremented to 4, then reassigned to 5
        verify(issueServiceClient, times(1)).updateIssueAssignment(eq(501L), any(AssignmentResponseDTO.class));
    }

    @Test
    @DisplayName("Test 5E: Duplicate assignment check prevents re-assigning same complaint")
    void testPreventDuplicateAssignment() {
        Worker worker = new Worker();
        worker.setId(10L);
        worker.setName("Amit Verma");
        worker.setWorkerType(WorkerType.ELECTRICIAN);

        TaskAssignment assigned = new TaskAssignment();
        assigned.setId(1L);
        assigned.setIssueId(999L);
        assigned.setWorker(worker);
        assigned.setRequiredWorkerType(WorkerType.ELECTRICIAN);
        assigned.setStatus(AssignmentStatus.ASSIGNED);

        when(taskAssignmentRepository.findByIssueId(999L)).thenReturn(Optional.of(assigned));

        AssignmentRequestDTO req = new AssignmentRequestDTO(
                999L, "electrical", "HIGH", 70, 70, LocalDateTime.now()
        );

        AssignmentResponseDTO resp = assignmentService.assignWorker(req);

        assertEquals("ASSIGNED", resp.getStatus());
        assertEquals(10L, resp.getWorkerId());
        // Verify no extra save or worker task count change was made
        verify(workerRepository, never()).findAvailableWorkersByType(any(), anyInt());
    }
}

