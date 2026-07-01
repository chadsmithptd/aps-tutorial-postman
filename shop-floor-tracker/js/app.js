// Picker screen controller (index.html)

ensureSeeded();

let selectedWorkstationId = null;
let selectedOperatorId = null;

function renderClock() {
  const el = document.getElementById("clock");
  const now = new Date();
  el.textContent = now.toLocaleTimeString("en-US", { hour12: false });
}

function renderWorkstations() {
  const grid = document.getElementById("workstationGrid");
  grid.innerHTML = "";
  SEED_DATA.WORKSTATIONS.forEach((ws, index) => {
    const tile = document.createElement("button");
    tile.className = "tile" + (ws.id === selectedWorkstationId ? " selected" : "");
    tile.innerHTML = `
      <span class="tile-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="tile-label">${ws.label}</span>
    `;
    tile.addEventListener("click", () => {
      selectedWorkstationId = ws.id;
      renderWorkstations();
      updateStartShiftButton();
    });
    grid.appendChild(tile);
  });
}

function renderOperators() {
  const grid = document.getElementById("operatorGrid");
  grid.innerHTML = "";
  SEED_DATA.OPERATORS.forEach((op, index) => {
    const tile = document.createElement("button");
    tile.className = "tile" + (op.id === selectedOperatorId ? " selected" : "");
    tile.innerHTML = `
      <span class="tile-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="tile-label">${op.name}</span>
    `;
    tile.addEventListener("click", () => {
      selectedOperatorId = op.id;
      renderOperators();
      updateStartShiftButton();
    });
    grid.appendChild(tile);
  });
}

function updateStartShiftButton() {
  const btn = document.getElementById("startShiftBtn");
  btn.disabled = !(selectedWorkstationId && selectedOperatorId);
}

function renderResumeBanner() {
  const priorOperatorId = getCurrentOperatorId();
  const priorWorkstationId = getCurrentWorkstationId();
  if (!priorOperatorId || !priorWorkstationId) return;

  const operator = findOperator(priorOperatorId);
  const workstation = findWorkstation(priorWorkstationId);
  if (!operator || !workstation) return;

  const banner = document.getElementById("resumeBanner");
  const text = document.getElementById("resumeText");
  text.textContent = `Resume as ${operator.name} at ${workstation.label}`;
  banner.style.display = "flex";

  document.getElementById("resumeBtn").addEventListener("click", () => {
    window.location.href = `list.html?operatorId=${encodeURIComponent(priorOperatorId)}`;
  });
}

document.getElementById("startShiftBtn").addEventListener("click", () => {
  if (!selectedOperatorId || !selectedWorkstationId) return;
  setCurrentSelection(selectedOperatorId, selectedWorkstationId);
  window.location.href = `list.html?operatorId=${encodeURIComponent(selectedOperatorId)}`;
});

renderWorkstations();
renderOperators();
renderResumeBanner();
renderClock();
setInterval(renderClock, 1000);
