# School Database — Design Notes

A small relational database for a school where students enrol on courses
and receive a grade.

---

## Tables

### `students`

Holds one row per student.

- `id` — primary key, auto-numbered.
- `name` — the student's full name (`NOT NULL`).
- `email` — the student's email. `NOT NULL` and `UNIQUE`, because no two
  students may share an email.
- `created_at` — timestamp, filled in automatically.

### `courses`

Holds one row per course offered by the school.

- `id` — primary key, auto-numbered.
- `title` — the course name (`NOT NULL`, `UNIQUE` so two courses cannot
  share the same title).
- `teacher` — the teacher who runs the course (`NOT NULL`).

### `enrolments`

A **join table**. Each row records one student taking one course.

- `id` — primary key, auto-numbered.
- `student_id` — foreign key to `students(id)`.
- `course_id` — foreign key to `courses(id)`.
- `grade` — the grade the student received; `NULL` until it is awarded.
- `enrolled_at` — timestamp, filled in automatically.
- `UNIQUE (student_id, course_id)` — a student cannot enrol on the same
  course twice.
- `ON DELETE CASCADE` on both foreign keys — if a student or a course is
  deleted, its enrolment rows disappear too.

---

## Relationships

- **`students` → `enrolments`** is **one-to-many**. One student has many
  enrolment rows; each enrolment row belongs to exactly one student.
- **`courses` → `enrolments`** is **one-to-many**. One course has many
  enrolment rows; each enrolment row belongs to exactly one course.
- **`students` ↔ `courses`** is therefore **many-to-many**: one student
  can take many courses, and one course can be taken by many students.

### Why a join table is needed

A relational table cannot store a list in a single column, and copying the
student rows into `courses` (or vice versa) would duplicate data and break
as soon as a student changed their name or email. Instead, we store one
row per (student, course) pair in `enrolments`. This is the standard way
to represent many-to-many relationships in SQL, and it also gives us a
natural place to store data that belongs to the relationship itself —
here, the `grade`.

---

## Index

I would add this index:

```sql
CREATE INDEX idx_enrolments_student_id ON enrolments(student_id);
CREATE INDEX idx_enrolments_course_id  ON enrolments(course_id);
```
