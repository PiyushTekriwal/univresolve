package com.kiit.worker.scheduler;

import com.kiit.worker.service.WorkerAssignmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class WorkerScheduler {

    private final WorkerAssignmentService assignmentService;

    /**
     * Shift-start reset — runs every day at 08:00 AM.
     * Resets tasksToday = 0 and status = IDLE for every worker.
     * After reset, all queued (PENDING) assignments are retried immediately
     * since all workers are now available again.
     */
    @Scheduled(cron = "0 0 8 * * *")
    public void shiftStartReset() {
        log.info("[Scheduler] Shift start — resetting worker task counts...");
        assignmentService.resetAllWorkers();

        log.info("[Scheduler] Retrying all pending assignments after shift reset...");
        assignmentService.retryAllPending();
    }

    /**
     * Periodic retry for pending assignments — every 5 minutes.
     * Catches any queued complaints that can be assigned without waiting
     * until the next shift reset (e.g., a worker finishes a task mid-day).
     */
    @Scheduled(fixedDelay = 300_000) // 5 minutes
    public void retryPendingAssignments() {
        log.debug("[Scheduler] Checking for pending assignments to retry...");
        assignmentService.retryAllPending();
    }
}
