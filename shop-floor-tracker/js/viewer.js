// 3D part preview viewer (ES module). Renders a placeholder shape per
// operation, keyed by `modelType`, in place of real STEP-file geometry.
// Owns a single Three.js scene/camera/renderer/controls instance;
// showModel() swaps only the displayed mesh group, never recreates them.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COLOR_BASE = 0x8b94a3; // --text-dim
const COLOR_ACCENT = 0x3ba7f2; // --accent
const COLOR_DARK = 0x5a6472; // recessed/inset details
const COLOR_BG = 0x171b22; // --panel

function baseMaterial() {
  return new THREE.MeshStandardMaterial({ color: COLOR_BASE, roughness: 0.6, metalness: 0.3 });
}
function accentMaterial() {
  return new THREE.MeshStandardMaterial({ color: COLOR_ACCENT, roughness: 0.4, metalness: 0.4 });
}
function darkMaterial() {
  return new THREE.MeshStandardMaterial({ color: COLOR_DARK, roughness: 0.7, metalness: 0.2 });
}

const MODEL_TEMPLATES = {
  bracket() {
    const group = new THREE.Group();
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.8), baseMaterial());
    upright.position.set(-0.5, 0.4, 0);
    group.add(upright);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.8), baseMaterial());
    foot.position.set(0.15, -0.35, 0);
    group.add(foot);
    [[-0.3, -0.35, 0.25], [0.6, -0.35, 0.25], [-0.3, -0.35, -0.25], [0.6, -0.35, -0.25]].forEach(([x, y, z]) => {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), accentMaterial());
      bolt.position.set(x, y + 0.2, z);
      group.add(bolt);
    });
    return group;
  },
  "tube-assembly"() {
    const group = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 20), baseMaterial());
    tube.rotation.z = Math.PI / 2;
    group.add(tube);
    [-1.1, 1.1].forEach((x) => {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.4), darkMaterial());
      cap.position.set(x, 0, 0);
      group.add(cap);
    });
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 16), accentMaterial());
    branch.position.set(0.3, 0.45, 0);
    branch.rotation.z = Math.PI / 5;
    group.add(branch);
    return group;
  },
  panel() {
    const group = new THREE.Group();
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.3), baseMaterial());
    group.add(sheet);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.04), darkMaterial());
    seam.position.set(0, 0.05, 0);
    group.add(seam);
    return group;
  },
  "fastener-array"() {
    const group = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 1.1), darkMaterial());
    group.add(plate);
    for (let col = -1.5; col <= 1.5; col += 1) {
      for (let row = -0.4; row <= 0.4; row += 0.4) {
        const fastener = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 12), accentMaterial());
        fastener.position.set(col * 0.5, 0.13, row);
        group.add(fastener);
      }
    }
    return group;
  },
  "housing-block"() {
    const group = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.2), baseMaterial());
    group.add(block);
    const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.3, 24), darkMaterial());
    bore.rotation.x = Math.PI / 2;
    group.add(bore);
    [[-0.7, -0.45, 0.55], [0.7, -0.45, 0.55], [-0.7, -0.45, -0.55], [0.7, -0.45, -0.55]].forEach(([x, y, z]) => {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.22), accentMaterial());
      flange.position.set(x, y, z);
      group.add(flange);
    });
    return group;
  },
  crate() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.4), baseMaterial());
    group.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 1.45), darkMaterial());
    lid.position.set(0, 0.56, 0);
    group.add(lid);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.04, 1.48), accentMaterial());
    rim.position.set(0, 0.5, 0);
    group.add(rim);
    return group;
  },
  "flat-tag"() {
    const group = new THREE.Group();
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.6), baseMaterial());
    group.add(tag);
    const grommet = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16), darkMaterial());
    grommet.rotation.x = Math.PI / 2;
    grommet.position.set(-0.35, 0, 0.22);
    group.add(grommet);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.3), accentMaterial());
    label.position.set(0.05, 0.04, 0);
    group.add(label);
    return group;
  },
  "hinge-assembly"() {
    const group = new THREE.Group();
    const leafA = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.1), baseMaterial());
    leafA.position.set(-0.5, 0, 0.15);
    leafA.rotation.y = 0.15;
    group.add(leafA);
    const leafB = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.1), baseMaterial());
    leafB.position.set(-0.5, 0, -0.15);
    leafB.rotation.y = -0.15;
    group.add(leafB);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 16), accentMaterial());
    pin.position.set(0, 0, 0);
    group.add(pin);
    return group;
  },
};

let scene, camera, renderer, controls;
let currentGroup = null;
let currentModelType = null;
const defaultCameraPosition = new THREE.Vector3(3.2, 2.4, 4);
const defaultTarget = new THREE.Vector3(0, 0, 0);

function buildModel(modelType) {
  const builder = MODEL_TEMPLATES[modelType];
  if (!builder) return new THREE.Group();
  return builder();
}

function init() {
  const container = document.getElementById("viewerCanvasWrap");
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR_BG);

  const rect = container.getBoundingClientRect();
  const width = rect.width || 400;
  const height = rect.height || 280;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.copy(defaultCameraPosition);
  camera.lookAt(defaultTarget);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
  dirLight.position.set(3, 4, 5);
  scene.add(dirLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 12;
  controls.target.copy(defaultTarget);
  controls.update();

  const resetBtn = document.getElementById("viewerResetBtn");
  if (resetBtn) resetBtn.addEventListener("click", resetView);

  const resizeObserver = new ResizeObserver(() => handleResize(container));
  resizeObserver.observe(container);
  window.addEventListener("resize", () => handleResize(container));

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.PartViewer.ready = true;
  window.dispatchEvent(new CustomEvent("PartViewerReady"));
}

function handleResize(container) {
  if (!renderer || !camera) return;
  const rect = container.getBoundingClientRect();
  const width = rect.width || 400;
  const height = rect.height || 280;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function showModel(modelType, fileName) {
  if (!scene) return;
  const label = document.getElementById("viewerFilenameLabel");
  if (label && fileName) label.textContent = fileName;

  if (modelType === currentModelType) return; // already showing this shape, no rebuild needed

  if (currentGroup) {
    scene.remove(currentGroup);
    currentGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  currentGroup = buildModel(modelType);
  currentModelType = modelType;
  scene.add(currentGroup);
}

function resetView() {
  if (!camera || !controls) return;
  camera.position.copy(defaultCameraPosition);
  controls.target.copy(defaultTarget);
  controls.update();
}

window.PartViewer = {
  ready: false,
  showModel,
  resetView,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
