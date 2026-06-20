# Queue System — How It Works

The queue runs the live flow of customers through your shop. There's a
**Queue** tab in the top menu for admins and cashiers, and attendants see
their queue inside **My Dashboard**.

## Two ways a customer enters the queue

**Walk-in** — On the Queue page, click **+ Add walk-in**, enter the customer,
vehicle, services, and (optionally) pre-assign attendants. They go straight
into the live queue.

**Scheduled booking** — Bookings you create (Admin → Bookings, or in the POS
booking calendar) for *today* automatically appear under **Arriving soon**.
When the customer physically shows up, click **Check in** and they join the
live queue. If they never arrive, use **No-show** or **Remove**.

## Priority

Scheduled bookings always sit **above** walk-ins once checked in. The list is
ordered top-to-bottom by who should be served next.

## How attendants get work

- The **Attendant turn order** panel shows who's next. It's load-balanced:
  free attendants first, then whoever has the fewest jobs / has been idle
  longest.
- An attendant can **Accept** a job only when they have **no** active job —
  one service at a time.
- The cashier can pre-assign specific attendants to a job, or add another
  attendant to a job that's already running (e.g. to speed it up). Anyone
  added must be free to join.
- **Multi-attendant jobs:** every assigned attendant must accept before the
  job flips to *in progress*.

## Taking payment

On any live queue entry, click **Take payment**. This opens checkout with the
entry's services and assigned attendants pre-filled. You can take payment
whenever suits the customer — upfront, after, or a deposit-then-balance flow.
Completing the sale records it, splits commission, and auto-deducts inventory
(exactly like the POS). Tick **Mark job complete** to free the attendants at
the same time.

## Completing a job

A job can be completed by the attendant (Mark complete on their dashboard),
by the cashier at payment, or by the cashier manually (Complete button).
Completing frees the attendant(s) for the next customer.

## No-shows & changes

Cashier/admin can **Requeue** (send back to the waiting list), **Remove**,
or edit any entry. Scheduled customers who don't show can be marked no-show
and requeued later if they turn up.

## A note on refresh

The queue auto-refreshes every few seconds on each open screen, so attendants
and cashiers see updates without reloading. It's not instant-push, but for a
single shop it stays current within seconds.

---

## Update: auto-assignment, clock-in rotation & self-queue

**Jobs assign automatically.** When a customer enters the queue (walk-in,
checked-in booking, or self-queue), the system auto-assigns them to the best
available attendant. The cashier no longer has to assign manually — but the
**Assign** button is still there for overrides.

**Clock-in drives the order.** Only attendants who have **clocked in** are in
the rotation. For the first job of the day the order follows clock-in time
(whoever clocked in first goes first); after that it balances by who has the
fewest jobs / has been idle longest.

**Accept or decline.** An auto-assigned attendant sees the job as their current
job and can **Accept** (to start) or **Decline** (to pass). A declined job is
re-assigned to the next available attendant automatically; if nobody is free,
it's flagged red on the cashier's queue screen for manual assignment.

**One job at a time** still holds — an attendant can't be assigned or accept a
new job until their current one is complete.

**Clocking out:** if an attendant still has an active job, they can't clock out
until it's completed — or the cashier reassigns it to someone else first.

**Customer self-queue (`/q`).** There's a public page at `yoursite/q` (put a QR
code at the counter). Customers enter their name, vehicle, pick services, and
optionally request a preferred attendant. They drop straight into the live
queue and auto-assign like a walk-in. A preferred attendant is honored only if
that person is free; otherwise the next available attendant takes them.

**Attendant history.** On their dashboard, attendants can pick a date to review
the jobs they completed and the commission they earned that day. It defaults to
today.

**Near real-time.** Queue screens refresh about every 2 seconds.
