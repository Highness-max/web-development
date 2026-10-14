-- ============================================================
-- Day 6 — School Database
-- Run this in SQLite (e.g. sqliteonline.com).
-- ============================================================
-- Make SQLite enforce foreign keys.
PRAGMA foreign_keys = ON;
-- ------------------------------------------------------------
-- Drop old tables so the script can be re-run cleanly.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS enrolments;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS students;
-- ============================================================
-- 1. CREATE TABLE statements
-- ============================================================
CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    teacher TEXT NOT NULL
);
CREATE TABLE enrolments (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade TEXT,
    enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
    -- A student can only enrol on the same course once.
    UNIQUE (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
-- ============================================================
-- 2. INSERT sample data
-- ============================================================
INSERT INTO students (name, email)
VALUES ('Amina Otieno', 'amina@example.com'),
    ('Brian Kamau', 'brian@example.com'),
    ('Cynthia Wanjiku', 'cynthia@example.com');
INSERT INTO courses (title, teacher)
VALUES ('Web Foundations', 'Mr. Mwangi'),
    ('Database Design', 'Ms. Njeri'),
    ('Mathematics', 'Mr. Ochieng');
INSERT INTO enrolments (student_id, course_id, grade)
VALUES (1, 1, 'A'),
    -- Amina on Web Foundations
    (1, 2, 'B'),
    -- Amina on Database Design
    (2, 1, 'B'),
    -- Brian on Web Foundations
    (2, 3, 'A'),
    -- Brian on Mathematics
    (3, 2, NULL);
-- Cynthia on Database Design, no grade yet
-- ============================================================
-- 3. Queries
-- ============================================================
-- ------------------------------------------------------------
-- Query 1: All courses for one student (by name)
-- ------------------------------------------------------------
SELECT c.title AS course,
    c.teacher
FROM courses c
    JOIN enrolments e ON e.course_id = c.id
    JOIN students s ON s.id = e.student_id
WHERE s.name = 'Amina Otieno'
ORDER BY c.title;
-- ------------------------------------------------------------
-- Query 2: All students on one course
-- ------------------------------------------------------------
SELECT s.name AS student,
    s.email
FROM students s
    JOIN enrolments e ON e.student_id = s.id
    JOIN courses c ON c.id = e.course_id
WHERE c.title = 'Web Foundations'
ORDER BY s.name;
-- ------------------------------------------------------------
-- Query 3: Number of students per course
-- (LEFT JOIN keeps courses that have zero students)
-- ------------------------------------------------------------
SELECT c.title AS course,
    COUNT(e.student_id) AS student_count
FROM courses c
    LEFT JOIN enrolments e ON e.course_id = c.id
GROUP BY c.id
ORDER BY c.title;
-- ------------------------------------------------------------
-- Query 4: Students who have no enrolments
-- (LEFT JOIN + IS NULL)
-- ------------------------------------------------------------
SELECT s.name AS student,
    s.email
FROM students s
    LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.id IS NULL
ORDER BY s.name;
-- ------------------------------------------------------------
-- Query 5: Update one enrolment's grade
-- (Give Brian's Web Foundations enrolment a new grade.)
-- ------------------------------------------------------------
UPDATE enrolments
SET grade = 'A'
WHERE student_id = 2
    AND course_id = 1;
-- Show the result of the update.
SELECT s.name AS student,
    c.title AS course,
    e.grade
FROM enrolments e
    JOIN students s ON s.id = e.student_id
    JOIN courses c ON c.id = e.course_id
ORDER BY s.name,
    c.title;
-- ============================================================
-- 4. Indexes (see school-design.md for the reasoning)
-- ============================================================
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);