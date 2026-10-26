-- SQL Script to create admin user
-- Run this script in your Neon PostgreSQL database

-- Insert admin user (PostgreSQL upsert syntax)
INSERT INTO users (name, email, password, role, created_at)
VALUES (
    'Admin',
    'admin@kiit.ac.in',
    'admin123',
    'ADMIN',
    NOW()
)
ON CONFLICT (email) DO UPDATE SET role = 'ADMIN';

-- Admin credentials:
-- Email: admin@kiit.ac.in
-- Password: admin123
