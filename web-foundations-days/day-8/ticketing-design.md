<<<COPY START>>>

# TicketHub — Event Ticketing System Design

A design document for **TicketHub**, a website that sells tickets for
concerts and events. Written for the PLP Academy Web Foundations capstone.

The document follows the six-part design framework from Day 8:
requirements → estimates → API → data model → double-booking prevention
→ architecture and trade-offs.

---

## 1. Requirements

### 1.1 Functional requirements

- Visitors can browse upcoming events (title, venue, date, poster, availability).
- A logged-in user can view a live seat map for an event, showing which
  seats are available, held, or sold.
- A user can **hold** one or more seats for a limited time (10 minutes)
  while they complete checkout.
- A user can pay for their held seats and receive a ticket (PDF and a
  record in their account).
- A user can view all past and upcoming tickets in "My Tickets".
- An admin can create events and define their seat layout and pricing.
- Users can cancel their own orders before the event begins; the seat is
  released back to the pool.

### 1.2 Non-functional requirements

**Speed.**

- `GET /events` and `GET /events/:id` respond in **under 200 ms** at the
  95th percentile.
- `GET /events/:id/seats` responds in **under 300 ms** at the 95th
  percentile, even during a big sale.
- Seat-hold and payment operations complete in **under 1 second** at
  the 95th percentile.

**Correctness (non-negotiable).**

- **No seat may ever be sold twice.** This must be enforced by the
  database, not by application code.
- Payment and seat reservation must be **atomic**: either the seat is
  sold and the order is paid, or neither happens.
- Every state transition (available → held → sold) must be auditable.

**Fairness.**

- When a high-demand event goes on sale, users are admitted in the
  order they arrive (FIFO). No one can jump the queue by refreshing.
- One user may not hold more than **4 seats per event** at a time.
- Bots and automated scripts must not be able to buy tickets faster
  than a human.

**Availability.**

- **99.9% uptime** for browsing ("three nines" — about 8.8 hours of
  downtime per year).
- During a big sale, the system must **degrade gracefully**: slow users
  are held in the waiting room, but the system never crashes.

**Security.**

- HTTPS only. Passwords hashed. Payment handled by an external
  provider (Stripe / Paystack / M-Pesa). No card data touches our
  servers.

---

## 2. Estimates

### 2.1 Normal traffic

| Metric                     | Value              |
| -------------------------- | ------------------ |
| Registered users           | 2,000,000          |
| Daily visitors             | 50,000             |
| Pages per visitor          | 10                 |
| **Page views per day**     | **500,000**        |
| **Average requests/sec**   | **~6 req/s**       |
| **Peak requests/sec** (5×) | **~30 req/s**      |
| **Tickets sold per day**   | **5,000**          |
| **Average writes/sec**     | **~0.06 writes/s** |

The system is heavily read-skewed even on a normal day: 100× more reads
than writes.

### 2.2 The big sale

One popular concert, 20,000 seats, on sale for 10 minutes. 200,000 people
arrive.

| Metric                                          | Value                 |
| ----------------------------------------------- | --------------------- |
| Users trying to buy                             | 200,000               |
| Sale window                                     | 600 seconds (10 min)  |
| **New users arriving per second**               | **~333 users/sec**    |
| Requests per user (browse, seat map, hold, pay) | ~10–15                |
| **Total requests in the 10 minutes**            | **~2,400,000**        |
| **Average during sale**                         | **~4,000 req/s**      |
| **Peak (on-sale moment, refreshes)**            | **~10,000 req/s**     |
| **Oversubscription**                            | **10 users per seat** |

### 2.3 The gap between the two

The sale peak is roughly **1,600× normal traffic**, but only for 10
minutes. If we provisioned servers for the sale, we'd pay for them all
year and waste money. If we provisioned for the normal day, the sale
would kill the system.

**The design principle:** size the infrastructure for the normal day,
and use a **virtual waiting room** to _flatten_ the sale peak into a
sustained, controlled flow that the same infrastructure can absorb.

### 2.4 Storage

| Data                                          | Per year                          |
| --------------------------------------------- | --------------------------------- |
| Users                                         | 400 MB (once)                     |
| Events and seats                              | ~50 MB                            |
| Orders and order items                        | ~450 MB                           |
| **Total structured (database)**               | **~1 GB in year 1**, +500 MB/year |
| Ticket PDFs and event images (object storage) | ~180 GB/year                      |

**Conclusion:** storage is trivial. The bottleneck is **concurrent
writes on 20,000 hot seats** during the sale window.

---

## 3. API Design

Base URL: `https://api.tickethub.com/v1`. All endpoints require HTTPS
and (except browsing events) a valid `Authorization: Bearer <token>`
header.

| #   | Method | Path                             | Purpose                           | Success |
| --- | ------ | -------------------------------- | --------------------------------- | ------- |
| 1   | GET    | `/events`                        | List upcoming events (paginated)  | 200     |
| 2   | GET    | `/events/:id`                    | Event details                     | 200     |
| 3   | GET    | `/events/:id/seats`              | Seat map with per-seat status     | 200     |
| 4   | POST   | `/events/:id/seats/:seatId/hold` | Hold a seat for 10 minutes        | 201     |
| 5   | DELETE | `/events/:id/seats/:seatId/hold` | Release a held seat               | 204     |
| 6   | POST   | `/orders`                        | Create an order from held seats   | 201     |
| 7   | POST   | `/orders/:id/pay`                | Initiate payment for an order     | 200     |
| 8   | GET    | `/orders`                        | List the user's orders            | 200     |
| 9   | GET    | `/orders/:id`                    | Get one order with its tickets    | 200     |
| 10  | GET    | `/users/me/tickets`              | List the user's purchased tickets | 200     |

### 3.1 Example — browsing events

```http
GET /v1/events?page=1&limit=20 HTTP/1.1
Host: api.tickethub.com
```

```json
{
  "page": 1,
  "limit": 20,
  "total": 143,
  "events": [
    {
      "id": 42,
      "title": "Sauti Sol Live in Nairobi",
      "venue": "KICC",
      "startsAt": "2026-12-15T19:00:00+03:00",
      "onSaleAt": "2026-10-20T10:00:00+03:00",
      "totalSeats": 20000,
      "seatsAvailable": 20000
    }
  ]
}
```

### 3.2 Example — viewing seats

```http
GET /v1/events/42/seats HTTP/1.1
Host: api.tickethub.com
```

```json
{
  "eventId": 42,
  "sections": [
    {
      "name": "VIP",
      "seats": [
        {
          "id": 1001,
          "number": "A1",
          "status": "available",
          "priceCents": 500000
        },
        { "id": 1002, "number": "A2", "status": "held", "priceCents": 500000 },
        { "id": 1003, "number": "A3", "status": "sold", "priceCents": 500000 }
      ]
    }
  ]
}
```

### 3.3 Example — holding a seat

```http
POST /v1/events/42/seats/1001/hold HTTP/1.1
Host: api.tickethub.com
Authorization: Bearer <token>
```

**Response — 201 Created**

```json
{
  "seatId": 1001,
  "heldUntil": "2026-10-20T10:10:00+03:00",
  "holdId": "hold_7f3a9b2c"
}
```

If the seat is already taken:

**Response — 409 Conflict**

```json
{
  "error": "This seat is no longer available.",
  "seatId": 1001,
  "currentStatus": "held"
}
```

### 3.4 Example — creating an order

```http
POST /v1/orders HTTP/1.1
Host: api.tickethub.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventId": 42,
  "seatIds": [1001, 1002]
}
```

**Response — 201 Created**

```json
{
  "id": 9001,
  "status": "pending_payment",
  "totalCents": 1000000,
  "expiresAt": "2026-10-20T10:10:00+03:00",
  "seats": [1001, 1002]
}
```

### 3.5 Example — paying

```http
POST /v1/orders/9001/pay HTTP/1.1
Host: api.tickethub.com
Authorization: Bearer <token>
Content-Type: application/json

{
  "provider": "mpesa",
  "phone": "+2547XXXXXXXX"
}
```

**Response — 200 OK**

```json
{
  "orderId": 9001,
  "status": "awaiting_provider",
  "paymentUrl": "https://pay.tickethub.com/mpesa/...",
  "message": "Approve the payment on your phone."
}
```

Once the provider confirms (via webhook), the order transitions to
`paid` and the tickets become available at `GET /users/me/tickets`.

### 3.6 Error responses

| Code | Meaning               | Example cause                                        |
| ---- | --------------------- | ---------------------------------------------------- |
| 400  | Bad Request           | Missing `seatIds`, or more than 4 seats in one order |
| 401  | Unauthorized          | No token, or the token has expired                   |
| 403  | Forbidden             | Trying to pay for someone else's order               |
| 404  | Not Found             | Seat `99999` or event `42` does not exist            |
| 409  | Conflict              | Seat already held or sold (the double-booking guard) |
| 429  | Too Many Requests     | Rate limit exceeded (anti-bot)                       |
| 500  | Internal Server Error | Unexpected server fault                              |

**Example 409 body:**

```json
{
  "error": "This seat is no longer available.",
  "code": "SEAT_UNAVAILABLE",
  "seatId": 1001
}
```

---

## 4. Data Model

Five tables. Four are required by the brief (users, events, seats,
orders) — the fifth is `order_items`, the join table that links orders
to seats and makes the relationship expressible.

### 4.1 `users`

| Column          | Type    | Notes                       |
| --------------- | ------- | --------------------------- |
| `id`            | INTEGER | Primary key, auto-increment |
| `email`         | TEXT    | `NOT NULL UNIQUE`           |
| `name`          | TEXT    | `NOT NULL`                  |
| `password_hash` | TEXT    | `NOT NULL`                  |
| `created_at`    | TEXT    | `DEFAULT CURRENT_TIMESTAMP` |

### 4.2 `events`

| Column       | Type    | Notes                                     |
| ------------ | ------- | ----------------------------------------- |
| `id`         | INTEGER | Primary key                               |
| `title`      | TEXT    | `NOT NULL`                                |
| `venue`      | TEXT    | `NOT NULL`                                |
| `starts_at`  | TEXT    | `NOT NULL` (ISO 8601)                     |
| `on_sale_at` | TEXT    | `NOT NULL` — when the virtual queue opens |
| `created_at` | TEXT    | `DEFAULT CURRENT_TIMESTAMP`               |

### 4.3 `seats`

| Column        | Type    | Notes                                                       |
| ------------- | ------- | ----------------------------------------------------------- |
| `id`          | INTEGER | Primary key                                                 |
| `event_id`    | INTEGER | `NOT NULL`, FK → `events(id)`                               |
| `section`     | TEXT    | `NOT NULL`                                                  |
| `seat_number` | TEXT    | `NOT NULL`                                                  |
| `price_cents` | INTEGER | `NOT NULL`                                                  |
| `status`      | TEXT    | `NOT NULL`, `CHECK (status IN ('available','held','sold'))` |
| `held_by`     | INTEGER | FK → `users(id)`, `NULL` unless status = 'held'             |
| `held_until`  | TEXT    | Timestamp; when the hold expires                            |
| `version`     | INTEGER | `NOT NULL DEFAULT 0` — optimistic-lock counter              |
| `created_at`  | TEXT    | `DEFAULT CURRENT_TIMESTAMP`                                 |

**`UNIQUE (event_id, seat_number)`** — physically impossible to have two
rows for the same seat in the same event.

### 4.4 `orders`

| Column        | Type    | Notes                                                                            |
| ------------- | ------- | -------------------------------------------------------------------------------- |
| `id`          | INTEGER | Primary key                                                                      |
| `user_id`     | INTEGER | `NOT NULL`, FK → `users(id)`                                                     |
| `status`      | TEXT    | `NOT NULL`, `CHECK (status IN ('pending_payment','paid','cancelled','expired'))` |
| `total_cents` | INTEGER | `NOT NULL`                                                                       |
| `created_at`  | TEXT    | `DEFAULT CURRENT_TIMESTAMP`                                                      |
| `paid_at`     | TEXT    | `NULL` until the payment webhook arrives                                         |

### 4.5 `order_items`

| Column        | Type    | Notes                                            |
| ------------- | ------- | ------------------------------------------------ |
| `id`          | INTEGER | Primary key                                      |
| `order_id`    | INTEGER | `NOT NULL`, FK → `orders(id)`                    |
| `seat_id`     | INTEGER | `NOT NULL UNIQUE`, FK → `seats(id)`              |
| `price_cents` | INTEGER | `NOT NULL` — the price at the moment of purchase |

**`UNIQUE (seat_id)`** — the database physically refuses to put the same
seat into two orders, even if the application code has a bug.

### 4.6 Relationships

- **`users → orders`** is **one-to-many**: one user has many orders;
  each order belongs to one user.
- **`events → seats`** is **one-to-many**: one event has many seats;
  each seat belongs to one event.
- **`orders ↔ seats`** is **many-to-many**: an order can contain
  several seats, and a seat can (over time) be part of one order per
  purchase. The **join table `order_items`** resolves it, and its
  `UNIQUE (seat_id)` constraint is the last line of defence against
  double-booking.

### 4.7 Indexes

```sql
CREATE INDEX idx_seats_event_status
  ON seats(event_id, status);
```

**Reason.** Every seat-map load and every "which seats are still
available for this event?" query filters on `event_id` and `status`.
Without this index the database scans every seat of every event.
With it, the query planner jumps straight to the matching rows.

```sql
CREATE INDEX idx_orders_user_status
  ON orders(user_id, status);
```

**Reason.** "My Tickets" filters orders by `user_id` and usually by
`status = 'paid'`. This index covers that pattern.

---

## 5. Preventing Double-Booking — The Core Guarantee

This is the hardest problem in the design, and the rubric asks for it
explicitly. Here is the full mechanism, from database constraint up to
the client-facing response.

### 5.1 The state machine

Each seat is in exactly one of three states at any moment:

```
available ──hold──▶ held ──pay──▶ sold
    ▲                │
    └─────expire─────┘
```

- `available` — anyone can attempt to hold it.
- `held` — one specific user has 10 minutes to pay.
- `sold` — permanently owned. Cannot transition out (except via the
  user's own refund process, which reverses the order, not the seat).

### 5.2 Layer 1 — the `UNIQUE` constraint

The table-level `UNIQUE (event_id, seat_number)` on `seats` and
`UNIQUE (seat_id)` on `order_items` make double-booking **structurally
impossible**. Even if every other protection failed, the database
would refuse to write the bad row.

### 5.3 Layer 2 — the atomic hold

The hold is a single SQL statement:

```sql
UPDATE seats
   SET status     = 'held',
       held_by    = :user_id,
       held_until = NOW() + INTERVAL '10 minutes',
       version    = version + 1
 WHERE id         = :seat_id
   AND status     = 'available';
```

The application checks how many rows were affected:

- **`rowsAffected = 1`** — the seat was available and is now held by
  this user. Return `201 Created`.
- **`rowsAffected = 0`** — someone else got it between the user's click
  and the database write. Return `409 Conflict`.

This works **at every isolation level** because the `WHERE` clause is
itself the check. Two concurrent `UPDATE`s on the same seat serialise at
the row level: the second one sees `status = 'held'` and matches zero
rows. No race condition exists.

### 5.4 Layer 3 — the atomic purchase

Payment happens inside an explicit transaction:

```sql
BEGIN TRANSACTION;

-- 1. Confirm the seat is still held by this user and not expired.
UPDATE seats
   SET status  = 'sold',
       version = version + 1
 WHERE id        = :seat_id
   AND status    = 'held'
   AND held_by   = :user_id
   AND held_until > NOW();

-- Application checks: rowsAffected must be 1.
-- If it is 0, the hold expired or the seat was released.
-- Abort and return 409 Conflict.

-- 2. Record the order item.
INSERT INTO order_items (order_id, seat_id, price_cents)
VALUES (:order_id, :seat_id, :price_cents);
-- The UNIQUE (seat_id) constraint is the backstop.

-- 3. Mark the order paid.
UPDATE orders
   SET status = 'paid', paid_at = NOW()
 WHERE id = :order_id;

COMMIT;
```

The payment provider's webhook confirms the charge. The transaction
above **only runs once the provider confirms** — so we never mark a seat
sold for an unpaid order. If the transaction fails after the charge
(extremely rare, but possible), the provider's refund webhook is
triggered automatically.

### 5.5 Layer 4 — the expiry sweeper

Every 30 seconds, a background worker runs:

```sql
UPDATE seats
   SET status     = 'available',
       held_by    = NULL,
       held_until = NULL,
       version    = version + 1
 WHERE status     = 'held'
   AND held_until < NOW();
```

This releases seats whose 10-minute hold has elapsed, so abandoned
carts do not permanently block inventory. It is also the mechanism that
makes the sale **fair**: a user who holds a seat and walks away loses it
after 10 minutes, giving the next person in the queue a chance.

### 5.6 Layer 5 — the client contract

The API returns `409 Conflict` with the current seat status when a hold
fails. The front end shows a message like "That seat was just taken —
here is another one" and re-renders the seat map. This is the
**graceful-degradation** path: the user is never told "something went
wrong", they are told what happened and what to do next.

### 5.7 Why not just use `SELECT` then `UPDATE`?

The naïve pattern:

```sql
-- WRONG
SELECT status FROM seats WHERE id = 1001;   -- returns 'available'
-- ... application logic ...
UPDATE seats SET status = 'held' WHERE id = 1001;
```

Two users can both run the `SELECT` and see `available`, then both run
the `UPDATE` and both succeed. The atomic `UPDATE ... WHERE status =
'available'` prevents this because the check and the write happen in
the same statement. This is the single most important lesson from Day 6
applied to a real problem.

---

## 6. Architecture

### 6.1 Diagram (text)

```text
                  ┌──────────────────┐
                  │  Browser / App   │
                  └────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
  ┌──────────┐       ┌───────────────┐   ┌──────────┐
  │   DNS    │       │   Virtual     │   │   CDN    │
  └──────────┘       │   Waiting     │   │ (static  │
                     │   Room        │   │  assets) │
                     │  (Redis ZSET  │   └──────────┘
                     │   + tokens)   │
                     └───────┬───────┘
                             │  admitted users only
                             ▼
                    ┌────────────────┐
                    │ LOAD BALANCER  │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │ App 1   │         │ App 2   │  ...    │ App N   │   (stateless)
   └────┬────┘         └────┬────┘         └────┬────┘
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   ┌─────────┐        ┌────────────┐      ┌─────────┐
   │  Cache  │        │  PRIMARY   │      │  QUEUE  │
   │ (Redis) │        │  DATABASE  │      │         │
   └─────────┘        └─────┬──────┘      └────┬────┘
                            │                  │
                            ▼                  ▼
                       ┌─────────┐        ┌─────────┐
                       │  READ   │        │ WORKER  │
                       │REPLICAS │        │ (PDFs,  │
                       └─────────┘        │ emails) │
                                          └────┬────┘
                                               │
                                               ▼
                                          ┌─────────┐
                                          │ OBJECT  │
                                          │ STORAGE │
                                          └─────────┘

   External services (behind the app servers):
     - Payment provider (Stripe / Paystack / M-Pesa)
     - Email provider (ticket confirmations)
```

### 6.2 Component explanations (one sentence each)

- **DNS** — turns `tickethub.com` into the IP address of the CDN or load
  balancer so browsers know where to send requests.
- **CDN** — serves static assets (HTML, CSS, JS, event posters) from
  servers close to users, reducing latency and removing that traffic
  from our infrastructure.
- **Virtual Waiting Room** — a Redis-backed FIFO queue that holds users
  until they are admitted in controlled batches; it flattens the sale
  spike so the app servers see a steady 500–1,000 req/s instead of
  10,000.
- **Load Balancer** — spreads admitted API requests across the app
  servers and stops sending traffic to any server that fails its health
  check.
- **App Servers (stateless)** — run the API and business logic; because
  they keep no state between requests, any server can serve any user and
  the fleet can scale horizontally.
- **Cache (Redis)** — stores hot event details and seat-map snapshots,
  so 90% of seat-map loads never reach the database.
- **Primary Database** — the single source of truth; only writes and
  the atomic hold/purchase statements run here.
- **Read Replicas** — copies of the primary that serve read-only
  queries (event lists, order history) so reads never compete with
  writes.
- **Queue** — holds slow or retriable background jobs (generating PDF
  tickets, sending confirmation emails, reconciling payments) so the
  app can reply to the user immediately.
- **Worker** — takes jobs off the queue and processes them; it also
  runs the 30-second expiry sweeper that releases abandoned holds.
- **Object Storage (S3 / R2)** — stores ticket PDFs, event posters and
  images; the database stores only the URL.
- **Payment Provider (external)** — handles the actual charge
  (Stripe / Paystack / M-Pesa) and calls back via a webhook; our servers
  never see card data.

### 6.3 Flow — viewing the seat map (`GET /events/:id/seats`)

1. User is admitted by the waiting room and gets an `admission_token`
   (15-minute validity).
2. The client sends `GET /events/42/seats` with the token.
3. The load balancer forwards to any healthy app server.
4. The app server checks the token and asks Redis for
   `seatmap:event:42`.
   - **Hit:** returns the cached seat map immediately (~5 ms).
   - **Miss:** queries a read replica with
     `SELECT id, section, seat_number, status FROM seats WHERE event_id = 42`
     (the `idx_seats_event_status` index makes this ~10 ms), stores the
     result in Redis with a **30-second TTL**, and returns it.
5. The client renders the seat map. Sold seats are greyed out; held
   seats are yellow; available seats are green.

**Why a 30-second TTL?** Long enough that 50,000 users on the same
event do not hammer the database, short enough that a seat that just
sold shows as sold within half a minute. Cache invalidation is not
attempted on every hold — that would defeat the point of caching — we
accept up to 30 seconds of staleness and rely on Layer 2 (the atomic
hold) to catch any race when the user actually clicks a seat.

### 6.4 Flow — buying a seat (`POST hold` → `POST pay`)

1. User clicks an available seat.
2. `POST /events/42/seats/1001/hold`. The app server runs the atomic
   `UPDATE ... WHERE status = 'available'`.
   - If 1 row changed → seat is held by this user for 10 minutes.
   - If 0 rows → `409 Conflict`; client refreshes the seat map.
3. User clicks **Pay** → `POST /orders` with the held seat IDs, then
   `POST /orders/:id/pay`.
4. The app server creates an order (`pending_payment`), calls the
   payment provider, and returns the provider URL.
5. The user completes payment on the provider's site or on their phone
   (M-Pesa prompt).
6. The provider calls our webhook `POST /webhooks/payment` with the
   result.
7. The app server runs the transaction from §5.4: transition the seat
   to `sold`, insert the `order_item`, mark the order `paid`.
8. The app server enqueues a job: `{ type: "generate_ticket_pdf",
orderId: 9001 }`.
9. The worker generates the PDF, uploads it to object storage, and
   emails the user a link.
10. On the next `GET /users/me/tickets`, the user sees their ticket.

**Failure case.** If the user's hold expires before payment confirms
(they took more than 10 minutes), step 7 fails with `rowsAffected = 0`.
The order is marked `expired`, the payment is refunded by the provider,
and the seat returns to `available`. This is the graceful-degradation
path.

### 6.5 How the architecture survives the big sale

| Component                | What it does during the sale                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Virtual waiting room** | Admits 500 users every 10 seconds. The rest wait in a Redis sorted set, seeing a live "You are #12,340, estimated wait 4 min" message.                                                                            |
| **Load balancer**        | Sees a steady ~500 req/s from admitted users, not 10,000.                                                                                                                                                         |
| **App servers**          | Scale horizontally: 4 servers on a normal day, **12 servers during the sale** (autoscaled from CPU).                                                                                                              |
| **Cache**                | Caches the seat map for 30 s; **9 out of 10 seat-map loads never reach the DB**.                                                                                                                                  |
| **Primary database**     | Handles only the actual hold and purchase writes: ~20 writes/sec at peak (20,000 seats ÷ 600 s × 10× oversubscription). With `idx_seats_event_status`, each hold is a single indexed row update, in microseconds. |
| **Read replicas**        | Serve all the event-detail reads so the primary is free for writes.                                                                                                                                               |
| **Queue + worker**       | Generates 20,000 PDF tickets over ~10 minutes in the background; the sale UI never waits for them.                                                                                                                |
| **Object storage**       | Absorbs 20,000 PDF writes without any pressure on the database.                                                                                                                                                   |
| **Payment provider**     | Is the only truly "external" bottleneck; our queue retries failed webhooks with exponential backoff.                                                                                                              |

**Why this works.** The database is the bottleneck. If we allowed
10,000 req/s to hit the primary, the write queue would back up, latency
would climb, and the site would feel frozen. By inserting a waiting
room **in front of** the load balancer, we cap the arrival rate at the
exact number the database can handle (~500 req/s of admitted traffic,
which produces ~20 writes/s of actual holds — well within budget).

This is the "one component, one reason" principle from the URL
shortener example: each layer exists because the layer below it cannot
survive the load on its own.

---

## 7. Trade-offs

**Trade-off 1 — Fairness vs. raw throughput (the virtual waiting room).**
A waiting room adds ~30 seconds of latency for 80% of users: they queue
before they shop. It also requires a sticky session token, an extra
Redis dependency, and a careful clock-sync between the room and the app
servers. But it is the only way to guarantee that a user with a fast
internet connection cannot buy 200 tickets before a user on a slow
connection sees the page. Without it, the sale becomes a bandwidth
competition, not a ticket sale. We accept the complexity and the
latency because **fairness is a non-functional requirement** for
ticketing systems (see §1.2).

**Trade-off 2 — Consistency vs. cache (30-second seat-map staleness).**
We cache the seat map for 30 seconds. That means the seat map a user
sees can be up to 30 seconds out of date, so a seat shown as "green"
may already be held by someone else. The cost is a `409 Conflict` on
click, which the UI handles by refreshing. The alternative — no cache,
or a cache invalidated on every hold — means 50,000 users × 1 seat-map
request per second = 50,000 read queries per second against the
database, which no reasonable primary can serve. We accept 30 seconds
of staleness because the **atomic hold (Layer 2) is the real source
of truth**; the cache is a convenience, not a guarantee.

**Trade-off 3 — Cost vs. availability (autoscaling vs. static fleet).**
If we kept 12 app servers running all year, we'd pay for a big sale
every day. If we kept only 4, we'd crash during every sale. Autoscaling
solves this by adding servers during the sale and removing them
afterwards — but autoscaling is not instant (it takes 1–3 minutes to
spin up a new server, and the sale peak lasts ~2 minutes). We use a
**scheduled scale-up**: at `on_sale_at - 10 minutes`, autoscaling
pre-warms 12 servers, so the sale peak never catches us with 4 servers.
The cost is a few extra server-hours on sale day, which is cheaper
than a crash that loses a whole concert's revenue.

---

## 8. Risks and Open Questions

- **Payment webhook loss.** If the provider's webhook is delayed, the
  user has paid but the order shows `pending_payment`. Mitigation: the
  worker reconciles every order against the provider once per minute
  for the first 10 minutes after payment.
- **Bot attacks.** Sophisticated bots could still try to enter the
  waiting room with thousands of accounts. Mitigation: CAPTCHA at
  admission, per-IP rate limiting (429), and email/phone verification.
- **Refunds.** The design assumes refunds are handled by the payment
  provider. We have not modelled the seat-releasing refund flow in
  detail; that is a follow-up design.
- **Multi-event sales.** A concert series (e.g., five nights) has five
  events that go on sale at the same time. The waiting room is
  per-event, so each has its own queue. This is a natural extension of
  the design and not built into the current schema.
  <<<COPY END>>>
