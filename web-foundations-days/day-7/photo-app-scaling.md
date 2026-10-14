# SnapShare — Scaling Plan

A scaling plan for **SnapShare**, a photo-sharing app where users upload
photos and scroll a feed of photos from people they follow.

---

## 1. Assumptions

The plan uses these figures, given as starting facts:

- **Registered users:** 10,000,000
- **Active users per day:** 10% of registered → **1,000,000 daily active users (DAU)**
- **Uploads per active user per day:** 1 photo
- **Feed views per active user per day:** 50 pages
- **Average photo size:** 2 MB
- **Average thumbnail size:** 50 KB
- **Peak traffic factor:** 5× the average (busy hours)
- **Seconds in a day:** 86,400

---

## 2. Load Estimates

### Uploads per second

- Per day: `1,000,000 users × 1 photo = 1,000,000 uploads/day`
- Average: `1,000,000 ÷ 86,400 ≈ 12 uploads/sec`
- Peak (5×): `≈ 60 uploads/sec`

### Feed views per second

- Per day: `1,000,000 users × 50 views = 50,000,000 feed views/day`
- Average: `50,000,000 ÷ 86,400 ≈ 579 feed views/sec`
- Peak (5×): `≈ 2,900 feed views/sec`

### Storage per year

- Photos per day: `1,000,000 × 2 MB = 2,000,000 MB = 2 TB`
- Thumbnails per day: `1,000,000 × 50 KB = 50,000,000 KB = 50 GB`
- Total per day: about **2.05 TB**
- Total per year: `2.05 TB × 365 ≈ 750 TB per year`

---

## 3. Read-Heavy or Write-Heavy?

The system is **strongly read-heavy**.

- 50,000,000 feed views per day vs 1,000,000 uploads per day
- That is a **50:1 read-to-write ratio**.

**What this means for the design.** Because reads dominate, we must
optimise the read path much more than the write path:

- Cache feed pages and photo metadata so most reads never reach the database.
- Serve photo files from a CDN and object storage, not from the app servers.
- Add **read replicas** so the primary database is not overwhelmed by reads.
- Keep the write path simple: uploads are relatively rare and can be
  processed asynchronously (e.g. thumbnail creation in a queue).

---

## 4. Why Photos Must Not Live Inside the Database

A database row is meant to hold small, structured values — text, numbers,
dates — and the database indexes and copies those values for speed and
reliability. A 2 MB photo is thousands of times larger than a normal
field, so storing photos inside the database would:

- Blow up the size of every backup and every replica.
- Make the database much slower, because large binary values compete with
  the small rows the database is designed for.
- Make replication expensive: every replica would have to copy gigabytes
  of photos every day.
- Make it hard to serve photos from a CDN, which expects to fetch them
  over plain HTTP.

**Where photos should go instead:** an **object storage service** such as
Amazon S3, Google Cloud Storage or Cloudflare R2. Object storage is
designed for large files, scales to petabytes, is cheap, and can sit
directly behind a CDN. The database stores only the **metadata** for each
photo — its id, the user who uploaded it, a caption, a timestamp, and the
**URL** of the file in object storage. The photo itself lives in the
bucket; the URL points to it.

---

## 5. Architecture Diagram (text)

```text
                       ┌----------------------|-
                                              |
                        │   DNS (snapshare)   │
                        └──────────┬──────────┘
                                   │
             ┌─────────────────────┴─────────────────────┐
             │                                           │
        static files                              API calls (HTTPS/JSON)
             │                                           │
             ▼                                           ▼
     ┌──────────────┐                          ┌──────────────────┐
     │     CDN      │  ── thumbnails & ──▶     │  LOAD BALANCER   │
     │ (html,css,js │     full photos          └────────┬─────────┘
     │  ,photos)    │                                   │
     └──────┬───────┘                        ┌──────────┼──────────┐
            │                                ▼          ▼          ▼
            │                          ┌─────────┐┌─────────┐┌─────────┐
            │                          │App srv 1││App srv 2││App srv 3│
            │                          └────┬────┘└────┬────┘└────┬────┘
            │                               │          │          │
            │                    ┌──────────┴──────────┴──────────┘
            │                    │
            │                    ▼
            │              ┌──────────┐
            │              │  CACHE   │  (Redis: feed pages, sessions,
            │              │          │   photo metadata)
            │              └────┬─────┘
            │                   │ (on miss)
            │                   ▼
            │            ┌──────────────┐         ┌──────────────┐
            │            │   PRIMARY    │ ──copy─▶│  READ        │
            │            │  DATABASE    │         │  REPLICA(S)  │
            │            │ (metadata)   │◀──reads─│              │
            │            └──────┬───────┘         └──────────────┘
            │                   │
            │                   ▼
            │            ┌──────────────┐
            │            │   OBJECT     │ ◀── uploads ── App servers
            │            │   STORAGE    │
            │            │ (S3 / R2)    │
            │            └──────────────┘
            │
            │                   ┌──────────────┐       ┌──────────────┐
            ------─>  │   QUEUE      │ -----> │   WORKER     │
                               │ (RabbitMQ /  │       │ (thumbnail   │
                               │  SQS)        │       │  generator)  │
                               └──────────────┘       └──────────────┘
```
