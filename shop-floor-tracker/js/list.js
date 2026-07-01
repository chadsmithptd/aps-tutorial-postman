// Task list screen controller (list.html)

ensureSeeded();

function getOperatorIdFromContext() {
  const params = new URLSearchParams(window.location.search);
  return params.get("operatorId") || getCurrentOperatorId();
}

const operatorId = getOperatorIdFromContext();

if (!operatorId) {
  window.location.href = "index.html";
}

function renderClock() {
  const el = document.getElementById("clock");
  const now = new Date();
  el.textContent = now.toLocaleTimeString("en-US", { hour12: false });
}

function renderHeader() {
  const operator = findOperator(operatorId);
  const workstationId = getCurrentWorkstationId();
  const workstation = findWorkstation(workstationId);
  document.getElementById("operatorLabel").textContent = operator ? operator.name : "--";
  document.getElementById("workstationLabel").textContent = workstation ? workstation.label : "--";
}

function statusLabel(status) {
  return status.replace("-", " ").toUpperCase();
}

function renderTaskList() {
  const tasks = getTasksForOperator(operatorId);
  const container = document.getElementById("taskRowList");
  container.innerHTML = "";

  const completeCount = tasks.filter((t) => t.status === "complete").length;
  document.getElementById("listSummary").textContent =
    `${completeCount} of ${tasks.length} complete`;

  tasks.forEach((task) => {
    const segment = findSegment(task.segmentId);
    const elapsed = getElapsedSeconds(task);

    const row = document.createElement("button");
    row.className = "task-row";
    row.innerHTML = `
      <span class="task-row-number">${task.opNumber}</span>
      <span class="task-row-info">
        <span class="task-row-name">${task.name}</span>
        <span class="task-row-sub">
          <span>${task.category}</span>
          ${segment ? `<span class="badge badge-segment">${segment.name}</span>` : ""}
        </span>
      </span>
      <span class="badge badge-status ${task.status}">${statusLabel(task.status)}</span>
      <span class="task-row-time">
        <strong>${formatHMS(elapsed)}</strong> / ${formatMS(task.targetSeconds)}
      </span>
    `;
    row.addEventListener("click", () => {
      window.location.href = `task.html?taskId=${encodeURIComponent(task.id)}`;
    });
    container.appendChild(row);
  });
}

renderHeader();
renderTaskList();
renderClock();
setInterval(() => {
  renderClock();
  renderTaskList();
}, 1000);
