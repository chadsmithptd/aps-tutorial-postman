// Jobs list screen controller (list.html)

ensureSeeded();

function getOperatorIdFromContext() {
  const params = new URLSearchParams(window.location.search);
  return params.get("operatorId") || getCurrentOperatorId();
}

const operatorId = getOperatorIdFromContext();

if (!operatorId) {
  window.location.href = "index.html";
}

let searchTerm = "";

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

function matchesSearch(job) {
  if (!searchTerm) return true;
  const haystack = `${job.name} ${job.workOrderNo} ${job.productName}`.toLowerCase();
  return haystack.includes(searchTerm.toLowerCase());
}

function renderJobList() {
  const allJobs = getJobsForOperator(operatorId);
  const jobs = allJobs.filter(matchesSearch);
  const container = document.getElementById("jobRowList");
  container.innerHTML = "";

  const completeJobs = allJobs.filter((j) => getJobProgress(j.id).aggregateStatus === "complete").length;
  let summaryText = `${completeJobs} of ${allJobs.length} jobs complete`;
  if (searchTerm) {
    summaryText += ` — showing ${jobs.length} match${jobs.length === 1 ? "" : "es"}`;
  }
  document.getElementById("listSummary").textContent = summaryText;

  jobs.forEach((job) => {
    const progress = getJobProgress(job.id);

    const row = document.createElement("button");
    row.className = "job-row";
    row.innerHTML = `
      <span class="job-row-info">
        <span class="job-row-name">${job.name}</span>
        <span class="job-row-sub">
          <span>${job.workOrderNo}</span>
          <span>${job.productName}</span>
        </span>
      </span>
      <span class="job-row-progress">${progress.completeCount} of ${progress.total} operations complete</span>
      <span class="badge badge-status ${progress.aggregateStatus}">${statusLabel(progress.aggregateStatus)}</span>
    `;
    row.addEventListener("click", () => {
      window.location.href = `job.html?jobId=${encodeURIComponent(job.id)}`;
    });
    container.appendChild(row);
  });
}

document.getElementById("jobSearchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderJobList();
});

renderHeader();
renderJobList();
renderClock();
setInterval(() => {
  renderClock();
  renderJobList();
}, 1000);
