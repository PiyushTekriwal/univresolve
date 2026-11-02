package com.kiit.worker.repository;

import com.kiit.worker.model.Worker;
import com.kiit.worker.model.WorkerType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkerRepository extends JpaRepository<Worker, Long> {

    List<Worker> findByWorkerType(WorkerType workerType);

    /**
     * Find the least-loaded available worker of the given type.
     * "Available" = tasksToday < maxTasks (5).
     * Ordered by tasksToday ASC so the worker with fewest tasks is picked first.
     */
    @Query("SELECT w FROM Worker w WHERE w.workerType = :workerType " +
           "AND w.tasksToday < :maxTasks ORDER BY w.tasksToday ASC")
    List<Worker> findAvailableWorkersByType(WorkerType workerType, int maxTasks);

    Optional<Worker> findByEmail(String email);
}
