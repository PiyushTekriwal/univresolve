package com.kiit.resolve.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import com.kiit.resolve.model.Issue;
import com.kiit.resolve.model.User;
import com.kiit.resolve.repository.IssueRepository;
import com.kiit.resolve.repository.UserRepository;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@CrossOrigin // 🔥 IMPORTANT for frontend calls
public class IssueController {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;

    // ✅ CREATE ISSUE
    @PostMapping
    public Issue createIssue(@RequestBody Issue issue) {

        Long userId = issue.getUser().getId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        issue.setUser(user);
        issue.setStatus("open");

        return issueRepository.save(issue);
    }

    // ✅ GET SINGLE ISSUE (for View button if needed)
    @GetMapping("/{id}")
    public Issue getIssueById(@PathVariable Long id) {
        return issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));
    }

    // ✅ USER ISSUES
    @GetMapping("/user/{userId}")
    public List<Issue> getIssuesByUser(@PathVariable Long userId) {
        return issueRepository.findByUserId(userId);
    }

    // 🔥 ADMIN: GET ALL ISSUES
    @GetMapping("/admin")
    public List<Issue> getAllIssues() {
        return issueRepository.findAll();
    }

    // 🔥 DASHBOARD: ONLY OPEN
    @GetMapping("/dashboard")
    public List<Issue> getOpenIssues() {
        return issueRepository.findByStatus("open");
    }

    // 🔥 HISTORY: ONLY RESOLVED
    @GetMapping("/history")
    public List<Issue> getResolvedIssues() {
        return issueRepository.findByStatus("resolved");
    }

    // 🔥 MARK AS RESOLVED
    @DeleteMapping("/{id}")
    public Map<String, String> resolveIssue(@PathVariable Long id) {

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        issue.setStatus("resolved");
        issueRepository.save(issue);

        return Map.of("message", "Issue marked as resolved");
    }
}