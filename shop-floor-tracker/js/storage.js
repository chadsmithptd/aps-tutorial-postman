// localStorage access helpers + first-run seeding for Shop Floor Tracker.

const STORAGE_KEYS = {
  seedVersion: "sft.seedVersion",
  operations: "sft.operations",
  currentOperatorId: "sft.currentOperatorId",
  currentWorkstationId: "sft.currentWorkstationId",
  activeJobId: "sft.activeJobId",
  activeOperationIdByJob: "sft.activeOperationIdByJob",
};

function ensureSeeded() {
  const storedVersion = localStorage.getItem(STORAGE_KEYS.seedVersion);
  const storedOperations = localStorage.getItem(STORAGE_KEYS.operations);

  if (storedVersion !== String(SEED_DATA.version) || !storedOperations) {
    const liveOperations = SEED_DATA.OPERATIONS.map((op) => ({
      ...op,
      status: "pending",
      accumulatedSeconds: 0,
      runningStartTs: null,
      completedAtTs: null,
      logEntries: [],
    }));
    localStorage.setItem(STORAGE_KEYS.operations, JSON.stringify(liveOperations));
    localStorage.setItem(STORAGE_KEYS.seedVersion, String(SEED_DATA.version));
  }
}

function getOperations() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.operations) || "[]");
}

function saveOperations(operations) {
  localStorage.setItem(STORAGE_KEYS.operations, JSON.stringify(operations));
}

function getOperationsForJob(jobId) {
  return getOperations()
    .filter((o) => o.jobId === jobId)
    .sort((a, b) => a.order - b.order);
}

function getOperationById(operationId) {
  return getOperations().find((o) => o.id === operationId) || null;
}

function updateOperation(updatedOperation) {
  const operations = getOperations();
  const index = operations.findIndex((o) => o.id === updatedOperation.id);
  if (index !== -1) {
    operations[index] = updatedOperation;
    saveOperations(operations);
  }
}

function getJobs() {
  return SEED_DATA.JOBS.slice();
}

function getJobsForOperator(operatorId) {
  return getJobs()
    .filter((j) => j.operatorId === operatorId)
    .sort((a, b) => a.order - b.order);
}

function getJobById(jobId) {
  return SEED_DATA.JOBS.find((j) => j.id === jobId) || null;
}

function getJobProgress(jobId) {
  const operations = getOperationsForJob(jobId);
  const total = operations.length;
  const completeCount = operations.filter((o) => o.status === "complete").length;
  const anyStarted = operations.some(
    (o) => o.status === "in-progress" || o.status === "paused" || o.status === "complete"
  );

  let aggregateStatus;
  if (total > 0 && completeCount === total) {
    aggregateStatus = "complete";
  } else if (anyStarted) {
    aggregateStatus = "in-progress";
  } else {
    aggregateStatus = "pending";
  }

  return { completeCount, total, aggregateStatus };
}

function getCurrentOperatorId() {
  return localStorage.getItem(STORAGE_KEYS.currentOperatorId);
}

function getCurrentWorkstationId() {
  return localStorage.getItem(STORAGE_KEYS.currentWorkstationId);
}

function setCurrentSelection(operatorId, workstationId) {
  localStorage.setItem(STORAGE_KEYS.currentOperatorId, operatorId);
  localStorage.setItem(STORAGE_KEYS.currentWorkstationId, workstationId);
}

function getActiveJobId() {
  return localStorage.getItem(STORAGE_KEYS.activeJobId);
}

function setActiveJobId(jobId) {
  localStorage.setItem(STORAGE_KEYS.activeJobId, jobId);
}

function getActiveOperationIdForJob(jobId) {
  const map = JSON.parse(localStorage.getItem(STORAGE_KEYS.activeOperationIdByJob) || "{}");
  return map[jobId] || null;
}

function setActiveOperationIdForJob(jobId, operationId) {
  const map = JSON.parse(localStorage.getItem(STORAGE_KEYS.activeOperationIdByJob) || "{}");
  map[jobId] = operationId;
  localStorage.setItem(STORAGE_KEYS.activeOperationIdByJob, JSON.stringify(map));
}

function findOperator(operatorId) {
  return SEED_DATA.OPERATORS.find((o) => o.id === operatorId) || null;
}

function findWorkstation(workstationId) {
  return SEED_DATA.WORKSTATIONS.find((w) => w.id === workstationId) || null;
}

function findSegment(segmentId) {
  return SEED_DATA.SEGMENTS.find((s) => s.id === segmentId) || null;
}

function findPart(partId) {
  return SEED_DATA.PARTS.find((p) => p.id === partId) || null;
}
