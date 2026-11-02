package com.kiit.worker.model;

public enum WorkerStatus {
    IDLE,  // Available — tasksToday < MAX_TASKS (5)
    BUSY   // At capacity — tasksToday == MAX_TASKS (5)
}
