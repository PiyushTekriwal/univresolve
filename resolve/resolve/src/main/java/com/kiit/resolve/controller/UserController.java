package com.kiit.resolve.controller;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import lombok.RequiredArgsConstructor;
import com.kiit.resolve.repository.UserRepository;
import com.kiit.resolve.model.User;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    // Get all users
    @GetMapping
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // Register new user
    @PostMapping("/register")
    public User registerUser(@RequestBody User user) {

        String email = user.getEmail();

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required");
        }

        // Allow only KIIT email IDs
        if (!email.endsWith("@kiit.ac.in")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only KIIT email IDs are allowed");
        }

        // Prevent duplicate email with clear message
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is already registered");
        }

        try {
            return userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            // Fallback in case of race condition or DB constraint error
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is already registered");
        }
    }

    // Login user
    @PostMapping("/login")
    public User loginUser(@RequestBody User loginRequest) {

        User user = userRepository.findByEmail(loginRequest.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!user.getPassword().equals(loginRequest.getPassword())) {
            throw new RuntimeException("Invalid password");
        }

        return user;
    }
}