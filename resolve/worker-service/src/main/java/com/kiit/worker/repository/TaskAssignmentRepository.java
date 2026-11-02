package com.kiit.worker.repository;

import com.kiit.worker.model.AssignmentStatus;
import com.kiit.worker.model.TaskAssignment;
import com.kiit.worker.model.WorkerType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, Long> {

    List<TaskAssignment> findByStatus(AssignmentStatus status);

    List<TaskAssignment> findByStatusAndRequiredWorkerType(
            AssignmentStatus status, WorkerType requiredWorkerType);

    Optional<TaskAssignment> findByIssueId(Long issueId);

    List<TaskAssignment> findByWorker_Id(Long workerId);
}
