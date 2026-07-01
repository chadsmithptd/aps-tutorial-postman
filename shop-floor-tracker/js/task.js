// Task detail / active-work screen controller (task.html)

ensureSeeded();

function getTaskIdFromContext() {
  const params = new URLSearchParams(window.location.search);
  return params.get("taskId") || getActiveTaskId();
}

const taskId = getTaskIdFromContext();
let task = taskId ? getTaskById(taskId) : null;

if (!task) {
  window.location.href = "index.html";
}

setActiveTaskId(task.id);

document.getElementById("backLink").href = `list.html?operatorId=${encodeURIComponent(task.operatorId)}`;

function renderClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString("en-US", { hour12: false });
}

function renderHeader() {
  const operator = findOperator(task.operatorId);
  const workstation = findWorkstation(task.workstationId);
  document.getElementById("operatorLabel").textContent = operator ? operator.name : "--";
  document.getElementById("workstationLabel").textContent = workstation ? workstation.label : "--";
}

function renderTaskInfo() {
  const segment = findSegment(task.segmentId);
  document.getElementById("detailOpNumber").textContent = `OP ${task.opNumber}`;
  document.getElementById("detailName").textContent = task.name;
  document.getElementById("detailCategory").textContent = task.category;
  document.getElementById("detailDescription").textContent = task.description;

  const segmentEl = document.getElementById("detailSegment");
  if (segment) {
    segmentEl.textContent = segment.name;
    segmentEl.style.display = "inline-block";
  } else {
    segmentEl.style.display = "none";
  }

  const partsBody = document.getElementById("partsListBody");
  partsBody.innerHTML = "";
  (task.parts || []).forEach((entry) => {
    const part = findPart(entry.partId);
    const row = document.createElement("div");
    row.className = "part-row";
    row.innerHTML = `
      <span>${part ? part.name : entry.partId}</span>
      <span class="part-qty">x${entry.qty}</span>
    `;
    partsBody.appendChild(row);
  });
}

function renderControlBar() {
  const elapsed = getElapsedSeconds(task);
  document.getElementById("stepLabel").textContent = `Step ${task.opNumber}`;
  document.getElementById("statusText").textContent = task.status.replace("-", " ").toUpperCase();
  document.getElementById("statusDot").className = `status-dot ${task.status}`;
  document.getElementById("elapsedReadout").textContent = formatHMS(elapsed);
  document.getElementById("targetReadout").textContent = formatMS(task.targetSeconds);

  const toggleBtn = document.getElementById("toggleBtn");
  const completeBtn = document.getElementById("completeBtn");

  if (task.status === "complete") {
    toggleBtn.textContent = "Start";
    toggleBtn.className = "btn-toggle start";
    toggleBtn.disabled = true;
    completeBtn.disabled = true;
  } else if (task.status === "in-progress") {
    toggleBtn.textContent = "Pause";
    toggleBtn.className = "btn-toggle pause";
    toggleBtn.disabled = false;
    completeBtn.disabled = false;
  } else {
    toggleBtn.textContent = "Start";
    toggleBtn.className = "btn-toggle start";
    toggleBtn.disabled = false;
    completeBtn.disabled = false;
  }
}

document.getElementById("toggleBtn").addEventListener("click", () => {
  task = task.status === "in-progress" ? pauseTask(task) : startTask(task);
  renderControlBar();
});

document.getElementById("completeBtn").addEventListener("click", () => {
  task = completeTask(task);
  renderControlBar();
});

renderHeader();
renderTaskInfo();
renderControlBar();
renderClock();

setInterval(() => {
  task = getTaskById(task.id) || task;
  renderControlBar();
  renderClock();
}, 1000);
