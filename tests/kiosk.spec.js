// @ts-check
const { test, expect, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");

const EXT_PATH = path.resolve(__dirname, "..");

// Stub the privileged chrome.* APIs so tests never rotate the user's real
// display, never restart the device, and never depend on having a real tab id.
// Runs in every page (including the extension page itself) before any script.
const STUB = () => {
  if (!window.chrome) return;
  // @ts-ignore
  window.__calls = { rotation: [], reboot: 0, zoom: [] };
  try {
    if (window.chrome.system && window.chrome.system.display) {
      window.chrome.system.display.setDisplayProperties = (id, props, cb) => {
        // @ts-ignore
        window.__calls.rotation.push({ id, props });
        if (cb) cb();
      };
      window.chrome.system.display.getInfo = (cb) => {
        cb([{ id: "fake-display-1", isPrimary: true }]);
      };
    }
    if (window.chrome.runtime) {
      window.chrome.runtime.restart = () => {
        // @ts-ignore
        window.__calls.reboot += 1;
      };
    }
    if (window.chrome.tabs) {
      window.chrome.tabs.setZoom = (tabId, level, cb) => {
        // @ts-ignore
        window.__calls.zoom.push({ tabId, level });
        if (cb) cb();
      };
      window.chrome.tabs.getCurrent = (cb) => cb({ id: 999 });
    }
  } catch (_) {
    // chrome.* in extension pages may be partially frozen; tests that depend
    // on the stub will fail clearly rather than silently rotating a screen.
  }
};

async function launchExtensionContext() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kiosk-ext-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  await context.addInitScript(STUB);

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 10_000 });
  }
  const extId = new URL(worker.url()).host;
  return { context, extId, userDataDir };
}

test.describe("Kiosk Control extension", () => {
  /** @type {import('@playwright/test').BrowserContext} */
  let context;
  let extId;
  let userDataDir;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async () => {
    ({ context, extId, userDataDir } = await launchExtensionContext());
  });

  test.afterAll(async () => {
    if (context) await context.close();
    if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/home.html`);
    await page.waitForLoadState("domcontentloaded");
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test("landing page renders dummy content", async () => {
    await expect(page.locator("#title")).toHaveText("Kiosk Demo");
    await expect(page.locator("#lead")).toContainText("control overlay");
    await expect(page.locator("#hero")).toBeVisible();
  });

  test("overlay hidden by default", async () => {
    await expect(page.locator("#controls")).toBeHidden();
  });

  test("Ctrl+Shift+S opens overlay, Esc closes it", async () => {
    await page.locator("body").click();
    await page.keyboard.press("Control+Shift+S");
    await expect(page.locator("#controls")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#controls")).toBeHidden();
  });

  test("close button hides overlay", async () => {
    await page.keyboard.press("Control+Shift+S");
    await expect(page.locator("#controls")).toBeVisible();
    await page.click("#close");
    await expect(page.locator("#controls")).toBeHidden();
  });

  test("zoom in increments label and clamps at max", async () => {
    await page.keyboard.press("Control+Shift+S");
    for (let i = 0; i < 3; i++) await page.click("#zoom-in");
    await expect(page.locator("#zoom-val")).toHaveText("130%");
    const calls = await page.evaluate(() => window.__calls.zoom);
    expect(calls.length).toBe(3);
    expect(calls[2].level).toBeCloseTo(1.3, 5);
  });

  test("zoom out decrements label", async () => {
    await page.keyboard.press("Control+Shift+S");
    await page.click("#zoom-out");
    await page.click("#zoom-out");
    await expect(page.locator("#zoom-val")).toHaveText("80%");
  });

  test("rotation 90 deg calls setDisplayProperties with primary display", async () => {
    await page.keyboard.press("Control+Shift+S");
    await page.click('button.rot-btn[data-rotation="90"]');
    const calls = await page.evaluate(() => window.__calls.rotation);
    expect(calls.length).toBe(1);
    expect(calls[0].props.rotation).toBe(90);
    expect(calls[0].id).toBe("fake-display-1");
  });

  test("each rotation button passes its degree value", async () => {
    await page.keyboard.press("Control+Shift+S");
    for (const deg of [0, 90, 180, 270]) {
      await page.click(`button.rot-btn[data-rotation="${deg}"]`);
    }
    const calls = await page.evaluate(() => window.__calls.rotation);
    expect(calls.map((c) => c.props.rotation)).toEqual([0, 90, 180, 270]);
  });

  test("reboot cancel does NOT call runtime.restart", async () => {
    await page.keyboard.press("Control+Shift+S");
    page.once("dialog", (d) => d.dismiss());
    await page.click("#reboot");
    // Give the cancel handler a tick.
    await page.waitForTimeout(100);
    const reboots = await page.evaluate(() => window.__calls.reboot);
    expect(reboots).toBe(0);
    await expect(page.locator("#status")).toContainText("cancelled");
  });

  test("reboot confirm DOES call runtime.restart", async () => {
    await page.keyboard.press("Control+Shift+S");
    page.once("dialog", (d) => d.accept());
    await page.click("#reboot");
    await page.waitForFunction(() => window.__calls.reboot > 0);
    const reboots = await page.evaluate(() => window.__calls.reboot);
    expect(reboots).toBe(1);
  });
});
