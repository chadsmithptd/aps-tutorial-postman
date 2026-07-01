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

There is also a single-file `standalone.html` in this directory that bundles the
whole app inline (including the 3D viewer) for easy download — open it directly
in a browser, no server needed. It is kept in sync with the multi-file app.

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
- A rotatable 3D part preview in the middle column, framed as viewing the
  operation's STEP file, with the timer controls pinned to the bottom of that
  same column (see "3D part preview" below for what this is/isn't)

Explicitly out of scope for v1:
- Any backend, database, or multi-device sync — all state lives in the browser's
  `localStorage`, scoped to one browser/device
- Auto-scheduling, prioritization, or dependency-based sequencing of jobs/operations
- Authentication — the operator picker is a convenience selector, not a login
- Additional "required input" fields beyond the parts/materials list (e.g. data
  entry, measurements, checklists) — the right panel is parts/materials only

## 3D part preview

The middle column of the job workspace (`job.html`/`standalone.html`) shows a
rotatable 3D shape for the currently-selected operation, with a mock filename
label (e.g. `MOUNT-INSTALL-003.step`) and a "Reset View" button. **This is placeholder
geometry, not real STEP/CAD file parsing** — there are no real `.step` files
behind it. Each operation is assigned a `modelType` (one of 8 reusable template
shapes — `bracket`, `tube-assembly`, `panel`, `fastener-array`, `housing-block`,
`crate`, `flat-tag`, `hinge-assembly` — built from simple Three.js primitives in
`js/viewer.js`), chosen to loosely match what that operation actually does.
Real STEP parsing would require a heavy WASM CAD kernel (e.g. OpenCascade) and
is out of scope for this prototype; the `modelType` field is designed so a real
loader could be swapped in later without changing the surrounding UI/data
contract.

Drag to orbit, scroll/pinch to zoom, click **Reset View** to snap back to the
default camera angle. The timer/control-bar stays scoped to the middle column's
width (not the full screen) and is pinned to the bottom of that column via flexbox
— the viewer above it absorbs the remaining vertical space.

**Three.js is vendored locally, not loaded from a CDN** — `js/vendor/three/`
contains the minified library and its OrbitControls addon (MIT licensed), so
`job.html` keeps working fully offline via a local import map. `standalone.html`
takes this further: the library source is embedded directly in the file (as
non-executing `<script type="text/plain">` blocks) and loaded via `Blob` URLs
at runtime, so the single downloadable file has zero external dependencies —
it's larger as a result (~740 KB) but opens and runs with no network access at all.

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
   `job.html?jobId=...`), and confirm the 3D viewer swaps to a different
   placeholder shape matching the newly selected operation, with an updated
   filename label.
6a. Drag inside the 3D viewer to confirm it orbits the shape; scroll/pinch to
    confirm it zooms; click **Reset View** to confirm the camera snaps back to
    the default angle. Resize the browser window (including across the 900px
    breakpoint) and confirm the canvas doesn't stretch/distort. Confirm the
    control bar stays visible at the bottom of the middle column without
    needing to scroll, even as the viewer above it resizes.
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
