"use strict";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;

const overlay = document.getElementById("controls");
const closeBtn = document.getElementById("close");
const zoomVal = document.getElementById("zoom-val");
const zoomIn = document.getElementById("zoom-in");
const zoomOut = document.getElementById("zoom-out");
const rotBtns = document.querySelectorAll(".rot-btn");
const rebootBtn = document.getElementById("reboot");
const statusEl = document.getElementById("status");

let currentZoom = 1.0;

function setStatus(msg, kind) {
  statusEl.textContent = msg || "";
  if (kind) statusEl.dataset.kind = kind;
  else delete statusEl.dataset.kind;
}

function openOverlay() {
  overlay.hidden = false;
  setStatus("");
  closeBtn.focus();
}

function closeOverlay() {
  overlay.hidden = true;
}

function toggleOverlay() {
  if (overlay.hidden) openOverlay();
  else closeOverlay();
}

function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}

function applyZoom(next) {
  const target = clampZoom(next);
  if (!chrome?.tabs?.setZoom) {
    setStatus("Zoom unavailable: chrome.tabs API missing", "error");
    return;
  }
  chrome.tabs.getCurrent((tab) => {
    if (!tab) {
      setStatus("Zoom failed: no current tab", "error");
      return;
    }
    chrome.tabs.setZoom(tab.id, target, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        setStatus("Zoom failed: " + err.message, "error");
        return;
      }
      currentZoom = target;
      zoomVal.textContent = Math.round(target * 100) + "%";
      setStatus("Zoom set to " + Math.round(target * 100) + "%");
    });
  });
}

function applyRotation(deg) {
  if (!chrome?.system?.display?.getInfo) {
    setStatus("Rotation unavailable: chrome.system.display missing", "error");
    return;
  }
  chrome.system.display.getInfo((displays) => {
    const primary = displays.find((d) => d.isPrimary) || displays[0];
    if (!primary) {
      setStatus("Rotation failed: no display", "error");
      return;
    }
    chrome.system.display.setDisplayProperties(
      primary.id,
      { rotation: deg },
      () => {
        const err = chrome.runtime.lastError;
        if (err) setStatus("Rotation failed: " + err.message, "error");
        else setStatus("Rotation set to " + deg + " degrees");
      },
    );
  });
}

function applyReboot() {
  const ok = window.confirm(
    "Reboot the device now? Any unsaved work will be lost.",
  );
  if (!ok) {
    setStatus("Reboot cancelled");
    return;
  }
  if (!chrome?.runtime?.restart) {
    setStatus("Reboot unavailable: chrome.runtime.restart missing", "error");
    return;
  }
  setStatus("Rebooting...");
  chrome.runtime.restart();
}

closeBtn.addEventListener("click", closeOverlay);
zoomIn.addEventListener("click", () => applyZoom(currentZoom + ZOOM_STEP));
zoomOut.addEventListener("click", () => applyZoom(currentZoom - ZOOM_STEP));
rotBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const deg = Number(btn.dataset.rotation);
    applyRotation(deg);
  });
});
rebootBtn.addEventListener("click", applyReboot);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !overlay.hidden) {
    e.preventDefault();
    closeOverlay();
    return;
  }
  if (e.ctrlKey && e.shiftKey && (e.key === "S" || e.key === "s")) {
    e.preventDefault();
    toggleOverlay();
  }
});

if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "open-controls") openOverlay();
  });
}
