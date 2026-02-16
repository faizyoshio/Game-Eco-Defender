import { GAME_DATA, STORAGE_KEYS } from "./data.js";
import { SimulationEngine } from "./simulation.js";
import { RenderEngine } from "./render.js";
import { UIManager } from "./ui.js";

const cityCanvas = document.getElementById("city-canvas");
const chartCanvas = document.getElementById("chart-canvas");

const simulation = new SimulationEngine(GAME_DATA);
const renderEngine = new RenderEngine(cityCanvas, chartCanvas, GAME_DATA);
const uiManager = new UIManager(simulation, renderEngine, GAME_DATA);

uiManager.init();
uiManager.showStartModal();

const updateResumeAvailability = () => {
  const hasSave = Boolean(localStorage.getItem(STORAGE_KEYS.save) || localStorage.getItem(STORAGE_KEYS.saveLegacy));
  uiManager.elements.startResumeBtn.disabled = !hasSave;
};

simulation.on("state", () => {
  updateResumeAvailability();
});

updateResumeAvailability();
renderEngine.resize();

const renderLoop = (timeMs) => {
  renderEngine.renderFrame(simulation.getSnapshot(), timeMs);
  window.requestAnimationFrame(renderLoop);
};

window.requestAnimationFrame(renderLoop);

window.addEventListener("resize", () => {
  renderEngine.resize();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Ignore registration errors and continue with online mode.
    });
  });
}
