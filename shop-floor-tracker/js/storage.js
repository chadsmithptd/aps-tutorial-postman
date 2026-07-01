// localStorage access helpers + first-run seeding for Shop Floor Tracker.

const STORAGE_KEYS = {
  seedVersion: "sft.seedVersion",
  tasks: "sft.tasks",
  currentOperatorId: "sft.currentOperatorId",
  currentWorkstationId: "sft.currentWorkstationId",
  activeTaskId: "sft.activeTaskId",
};

function ensureSeeded() {
  const storedVersion = localStorage.getItem(STORAGE_KEYS.seedVersion);
  const storedTasks = localStorage.getItem(STORAGE_KEYS.tasks);

  if (storedVersion !== String(SEED_DATA.version) || !storedTasks) {
    const liveTasks = SEED_DATA.TASKS.map((task) => ({
      ...task,
      status: "pending",
      accumulatedSeconds: 0,
      runningStartTs: null,
      completedAtTs: null,
      logEntries: [],
    }));
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(liveTasks));
    localStorage.setItem(STORAGE_KEYS.seedVersion, String(SEED_DATA.version));
  }
}

function getTasks() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || "[]");
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function getTasksForOperator(operatorId) {
  return getTasks()
    .filter((t) => t.operatorId === operatorId)
    .sort((a, b) => a.order - b.order);
}

function getTaskById(taskId) {
  return getTasks().find((t) => t.id === taskId) || null;
}

function updateTask(updatedTask) {
  const tasks = getTasks();
  const index = tasks.findIndex((t) => t.id === updatedTask.id);
  if (index !== -1) {
    tasks[index] = updatedTask;
    saveTasks(tasks);
  }
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

function getActiveTaskId() {
  return localStorage.getItem(STORAGE_KEYS.activeTaskId);
}

function setActiveTaskId(taskId) {
  localStorage.setItem(STORAGE_KEYS.activeTaskId, taskId);
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
