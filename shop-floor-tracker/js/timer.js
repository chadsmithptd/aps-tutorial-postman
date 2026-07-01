// Pure timer logic for Shop Floor Tracker. No DOM dependencies.
// runningStartTs is an absolute epoch-ms timestamp persisted to localStorage,
// so elapsed time survives a page refresh without relying on an in-memory interval.

function getElapsedSeconds(operation) {
  const runningSeconds = operation.runningStartTs
    ? Math.floor((Date.now() - operation.runningStartTs) / 1000)
    : 0;
  return operation.accumulatedSeconds + runningSeconds;
}

function startOperation(operation) {
  if (operation.runningStartTs) return operation; // already running, no-op

  // Single-active-operation rule: auto-pause any other in-progress operation
  // for this operator, even if it belongs to a different job.
  const operations = getOperations();
  operations.forEach((o) => {
    if (o.id !== operation.id && o.operatorId === operation.operatorId && o.runningStartTs) {
      pauseOperation(o);
    }
  });

  operation.status = "in-progress";
  operation.runningStartTs = Date.now();
  operation.logEntries.push({ startTs: operation.runningStartTs, endTs: null, seconds: null });
  updateOperation(operation);
  return operation;
}

function pauseOperation(operation) {
  if (!operation.runningStartTs) return operation;

  const now = Date.now();
  const elapsedThisRun = Math.floor((now - operation.runningStartTs) / 1000);
  operation.accumulatedSeconds += elapsedThisRun;
  operation.status = "paused";

  const openEntry = operation.logEntries[operation.logEntries.length - 1];
  if (openEntry && openEntry.endTs === null) {
    openEntry.endTs = now;
    openEntry.seconds = elapsedThisRun;
  }

  operation.runningStartTs = null;
  updateOperation(operation);
  return operation;
}

function completeOperation(operation) {
  if (operation.runningStartTs) operation = pauseOperation(operation); // bank any running time first
  operation.status = "complete";
  operation.completedAtTs = Date.now();
  updateOperation(operation);
  return operation;
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
