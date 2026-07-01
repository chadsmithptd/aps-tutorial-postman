# Shop Floor Tracker (v1 prototype)

A lightweight, static shop-floor execution tool: operators pick their workstation,
browse a searchable list of their jobs, and work through each job's operations in
a 3-panel workspace with simple Start/Pause/Complete time tracking. Built as a
deliberately simple alternative to heavyweight MES/ERP tools — no build step, no
backend, no framework.

## Running it

From this directory:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser.

Opening `index.html` directly via `file://` also works, but a local server is
recommended since some browsers restrict `localStorage` behavior on `file://`.

There is also a single-file `standalone.html` in this directory — an earlier,
independent snapshot bundling the whole app inline for easy download. It is not
kept in sync with the Jobs/Operations design described below.

## Scope (v1)

In scope:
- Operator + workstation picker
- **Jobs** (work orders) assigned to each operator, each containing several
  **Operations** — seed data, no scheduling/auto-prioritization engine
- A searchable jobs list (live filter by job name, work order number, or product)
- A 3-panel job workspace: operations sidebar (left), selected operation's details
  and time-tracking controls (middle), required parts/materials for the selected
  operation (right) — switching operations is instant, client-side, no page reload
- Start / Pause / Resume / Complete timing per operation, persisted in `localStorage`
- Elapsed time survives page refresh (timestamp-based, not interval-based)
- Only one operation can be "in progress" per operator at a time, even across jobs

Explicitly out of scope for v1:
- Any backend, database, or multi-device sync — all state lives in the browser's
  `localStorage`, scoped to one browser/device
- Auto-scheduling, prioritization, or dependency-based sequencing of jobs/operations
- Authentication — the operator picker is a convenience selector, not a login
- 3D part preview (shown in reference mockups) — replaced with a text description panel
- Additional "required input" fields beyond the parts/materials list (e.g. data
  entry, measurements, checklists) — the right panel is parts/materials only

## Data

Seed data (workstations, operators, parts catalog, segments, jobs, operations)
lives in `js/data.js`. `JOBS` is static reference data with no live/mutable state
and is never copied into `localStorage` — only `OPERATIONS` (each linked to a
parent job via `jobId`) get seeded into `localStorage['sft.operations']` with live
fields (`status`, `accumulatedSeconds`, `runningStartTs`, `completedAtTs`,
`logEntries`), via `ensureSeeded()` in `js/storage.js`.

If you edit `js/data.js`, bump `SEED_DATA.version` so `ensureSeeded()` knows to
re-seed rather than keep using previously stored data.

## Verification checklist

1. Clear `localStorage` for this origin, load `index.html`.
2. Confirm the picker renders workstation/operator tiles.
3. Select an operator + workstation, click **Start Shift** — confirm `list.html`
   shows that operator's **jobs**, each with a progress readout ("X of Y operations
   complete") and an aggregate status badge, all "PENDING" on first load.
4. Type into the search box — confirm the job list filters live (case-insensitive,
   matching job name / work order number / product name); clearing the box
   restores the full list.
5. Click a job row — confirm `job.html` loads a 3-column workspace: left =
   operations sidebar for that job, middle = the selected operation's name,
   category, description, and time-tracking controls, right = required parts for
   that operation.
6. Click a different operation in the left sidebar — confirm the middle and right
   panels update immediately with **no page navigation** (URL stays on
   `job.html?jobId=...`).
7. Click **Start** — status becomes "IN PROGRESS", the elapsed readout counts up
   every second in both the middle panel and that operation's sidebar row.
8. **Refresh the page** — confirm the workspace reopens to the same job and the
   same last-viewed operation, with elapsed time preserved (timestamp-based, the
   key correctness check for the timer design).
9. Click **Pause** — status becomes "PAUSED", readout freezes; refresh again and
   confirm no further time accumulates while paused. Click **Start** again and
   confirm the readout resumes rather than resetting.
10. Start a second operation (same job or a different job for the same operator)
    — confirm the first operation auto-pauses (only one active operation per
    operator at a time, even across jobs).
11. Click **Complete** — confirm the operation's sidebar badge updates, and that
    navigating back to `list.html` shows the job's aggregate progress/status badge
    reflecting the change.
12. Repeat briefly for the other seeded operators (including the one with no
    tasks in the original v1 seed, which now has jobs) to confirm jobs/operations/
    timers are isolated per operator.
