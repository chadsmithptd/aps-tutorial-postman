// Job workspace screen controller (job.html)

ensureSeeded();

function getJobIdFromContext() {
  const params = new URLSearchParams(window.location.search);
  return params.get("jobId") || getActiveJobId();
}

const jobId = getJobIdFromContext();
const job = jobId ? getJobById(jobId) : null;

if (!job) {
  window.location.href = "index.html";
}

setActiveJobId(job.id);

document.getElementById("backLink").href = `list.html?operatorId=${encodeURIComponent(job.operatorId)}`;

function pickInitialOperationId() {
  const operations = getOperationsForJob(job.id);
  if (operations.length === 0) return null;

  const restored = getActiveOperationIdForJob(job.id);
  if (restored && operations.some((o) => o.id === restored)) return restored;

  const inProgress = operations.find((o) => o.status === "in-progress");
  if (inProgress) return inProgress.id;

  const notComplete = operations.find((o) => o.status !== "complete");
  if (notComplete) return notComplete.id;

  return operations[0].id;
}

let currentOperationId = pickInitialOperationId();

function selectOperation(operationId) {
  currentOperationId = operationId;
  setActiveOperationIdForJob(job.id, operationId);
  renderOperationList();
  renderMiddlePanel();
  renderPartsPanel();
}

function renderClock() {
  document.getElementById("clock").textContent = new Date().toLocaleTimeString("en-US", { hour12: false });
}

function renderHeader() {
  const operator = findOperator(job.operatorId);
  const workstation = findWorkstation(job.workstationId);
  document.getElementById("operatorLabel").textContent = operator ? operator.name : "--";
  document.getElementById("workstationLabel").textContent = workstation ? workstation.label : "--";
  document.getElementById("jobHeaderName").textContent = job.name;
  document.getElementById("jobHeaderSub").textContent = `${job.workOrderNo} · ${job.productName}`;
}

function statusLabel(status) {
  return status.replace("-", " ").toUpperCase();
}

function renderOperationList() {
  const operations = getOperationsForJob(job.id);
  const container = document.getElementById("operationRowList");
  container.innerHTML = "";

  operations.forEach((op) => {
    const elapsed = getElapsedSeconds(op);
    const row = document.createElement("button");
    row.className = "operation-row" + (op.id === currentOperationId ? " selected" : "");
    row.innerHTML = `
      <span class="operation-row-number">${op.opNumber}</span>
      <span class="operation-row-info">
        <span class="operation-row-name">${op.name}</span>
        <span class="badge badge-status ${op.status}">${statusLabel(op.status)}</span>
      </span>
      <span class="operation-row-time">${formatHMS(elapsed)} / ${formatMS(op.targetSeconds)}</span>
    `;
    row.addEventListener("click", () => selectOperation(op.id));
    container.appendChild(row);
  });
}

function renderMiddlePanel() {
  const operation = getOperationById(currentOperationId);
  if (!operation) return;

  const segment = findSegment(operation.segmentId);
  document.getElementById("detailOpNumber").textContent = `OP ${operation.opNumber}`;
  document.getElementById("detailName").textContent = operation.name;
  document.getElementById("detailCategory").textContent = operation.category;
  document.getElementById("detailDescription").textContent = operation.description;

  const segmentEl = document.getElementById("detailSegment");
  if (segment) {
    segmentEl.textContent = segment.name;
    segmentEl.style.display = "inline-block";
  } else {
    segmentEl.style.display = "none";
  }

  const elapsed = getElapsedSeconds(operation);
  document.getElementById("stepLabel").textContent = `Step ${operation.opNumber}`;
  document.getElementById("statusText").textContent = statusLabel(operation.status);
  document.getElementById("statusDot").className = `status-dot ${operation.status}`;
  document.getElementById("elapsedReadout").textContent = formatHMS(elapsed);
  document.getElementById("targetReadout").textContent = formatMS(operation.targetSeconds);

  const toggleBtn = document.getElementById("toggleBtn");
  const completeBtn = document.getElementById("completeBtn");

  if (operation.status === "complete") {
    toggleBtn.textContent = "Start";
    toggleBtn.className = "btn-toggle start";
    toggleBtn.disabled = true;
    completeBtn.disabled = true;
  } else if (operation.status === "in-progress") {
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

function renderPartsPanel() {
  const operation = getOperationById(currentOperationId);
  const partsBody = document.getElementById("partsListBody");
  partsBody.innerHTML = "";
  if (!operation) return;

  (operation.parts || []).forEach((entry) => {
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

document.getElementById("toggleBtn").addEventListener("click", () => {
  const operation = getOperationById(currentOperationId);
  if (operation.status === "in-progress") {
    pauseOperation(operation);
  } else {
    startOperation(operation);
  }
  renderOperationList();
  renderMiddlePanel();
});

document.getElementById("completeBtn").addEventListener("click", () => {
  const operation = getOperationById(currentOperationId);
  completeOperation(operation);
  renderOperationList();
  renderMiddlePanel();
});

renderHeader();
renderOperationList();
renderMiddlePanel();
renderPartsPanel();
renderClock();

setInterval(() => {
  renderClock();
  renderOperationList();
  renderMiddlePanel();
}, 1000);
