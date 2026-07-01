# Shop Floor Tracker (v1 prototype)

A lightweight, static shop-floor execution tool: operators pick their workstation,
see today's ordered list of tasks, and track time with a simple Start/Pause/Complete
flow. Built as a deliberately simple alternative to heavyweight MES/ERP tools —
no build step, no backend, no framework.

## Running it

From this directory:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser.

Opening `index.html` directly via `file://` also works, but a local server is
recommended since some browsers restrict `localStorage` behavior on `file://`.

## Scope (v1)

In scope:
- Operator + workstation picker
- A flat, pre-ordered task list per operator (seed data, no scheduling engine)
- Start / Pause / Resume / Complete timing per task, persisted in `localStorage`
- Elapsed time survives page refresh (timestamp-based, not interval-based)
- Only one task can be "in progress" per operator at a time

Explicitly out of scope for v1:
- Any backend, database, or multi-device sync — all state lives in the browser's
  `localStorage`, scoped to one browser/device
- Auto-scheduling, prioritization, or dependency-based sequencing of tasks
- Authentication — the operator picker is a convenience selector, not a login
- 3D part preview (shown in reference mockups) — replaced with a text description panel

## Data

Seed data (workstations, operators, parts catalog, segments, tasks) lives in
`js/data.js`. On first load, `ensureSeeded()` (in `js/storage.js`) copies this
into `localStorage` under the `sft.tasks` key, which becomes the live source of
truth for status/timing going forward.

If you edit `js/data.js`, bump `SEED_DATA.version` so `ensureSeeded()` knows to
re-seed rather than keep using previously stored data.

## Verification checklist

1. Clear `localStorage` for this origin, load `index.html`.
2. Confirm the picker renders workstation/operator tiles and `localStorage['sft.tasks']`
   is populated (check via devtools).
3. Select an operator + workstation, click **Start Shift** — confirm `list.html`
   shows that operator's tasks in order, all "PENDING".
4. Click a task row — confirm `task.html` shows the correct name, category,
   description, parts list, and target (TAKT) time.
5. Click **Start** — status becomes "IN PROGRESS", the elapsed readout counts up
   every second, button becomes "Pause".
6. **Refresh the page** — confirm the elapsed readout resumes from the correct
   value rather than resetting (this is the key correctness check for the
   timestamp-based timer design).
7. Click **Pause** — status becomes "PAUSED", readout freezes. Refresh again and
   confirm no further time accumulates while paused.
8. Click **Start** again — confirm the readout continues from where it left off.
9. Navigate back to the task list while a task is running — confirm the list
   shows that task as in-progress with a live-updating elapsed time.
10. Start a second task for the same operator — confirm the first task is
    automatically paused (only one active task per operator at a time).
11. Click **Complete** — status becomes "COMPLETE", the timer stops accepting
    further start clicks, and the list view's completion count updates.
12. Repeat for a second seeded operator and confirm task lists/timers are
    isolated per operator.
