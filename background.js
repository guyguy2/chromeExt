// Service worker: forwards the keyboard command to the active tab so
// home.js can toggle the control overlay.

chrome.commands.onCommand.addListener((command) => {
  if (command !== "open-controls") return;
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || tab.id === undefined) return;
    chrome.tabs.sendMessage(tab.id, { type: "open-controls" }, () => {
      // Swallow "Receiving end does not exist" when the active tab is not the
      // bundled home page (e.g. user is on chrome://settings).
      void chrome.runtime.lastError;
    });
  });
});
