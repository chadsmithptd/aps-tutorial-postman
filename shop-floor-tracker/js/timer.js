// Pure timer logic for Shop Floor Tracker. No DOM dependencies.
// runningStartTs is an absolute epoch-ms timestamp persisted to localStorage,
// so elapsed time survives a page refresh without relying on an in-memory interval.

function getElapsedSeconds(task) {
  const runningSeconds = task.runningStartTs
    ? Math.floor((Date.now() - task.runningStartTs) / 1000)
    : 0;
  return task.accumulatedSeconds + runningSeconds;
}

function startTask(task) {
  if (task.runningStartTs) return task; // already running, no-op

  // Single-active-task rule: auto-pause any other in-progress task for this operator.
  const tasks = getTasks();
  tasks.forEach((t) => {
    if (t.id !== task.id && t.operatorId === task.operatorId && t.runningStartTs) {
      pauseTask(t);
    }
  });

  task.status = "in-progress";
  task.runningStartTs = Date.now();
  task.logEntries.push({ startTs: task.runningStartTs, endTs: null, seconds: null });
  updateTask(task);
  return task;
}

function pauseTask(task) {
  if (!task.runningStartTs) return task;

  const now = Date.now();
  const elapsedThisRun = Math.floor((now - task.runningStartTs) / 1000);
  task.accumulatedSeconds += elapsedThisRun;
  task.status = "paused";

  const openEntry = task.logEntries[task.logEntries.length - 1];
  if (openEntry && openEntry.endTs === null) {
    openEntry.endTs = now;
    openEntry.seconds = elapsedThisRun;
  }

  task.runningStartTs = null;
  updateTask(task);
  return task;
}

function completeTask(task) {
  if (task.runningStartTs) task = pauseTask(task); // bank any running time first
  task.status = "complete";
  task.completedAtTs = Date.now();
  updateTask(task);
  return task;
}

function formatHMS(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatMS(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}M:${String(s).padStart(2, "0")}S`;
}
