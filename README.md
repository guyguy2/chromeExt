# Kiosk Control

Chrome OS / Chromebox kiosk extension. Bundles a small landing page (acting as the "PWA" content) and adds a `Ctrl+Shift+G` overlay with three controls:

- **Zoom** — `+` / `-` in 10% steps, range 50%–300%
- **Screen rotation** — buttons for 0°, 90°, 180°, 270° (the only values Chrome's display API supports)
- **Reboot** — calls `chrome.runtime.restart()` after a confirmation dialog

## Files

```
manifest.json     MV3 manifest (kiosk_enabled, commands, perms)
background.js     service worker, forwards Ctrl+Shift+G to active tab
home.html         landing page + hidden control overlay markup
home.css          page + overlay styles
home.js           overlay logic, zoom / rotation / reboot handlers
icons/            16 / 48 / 128 px placeholder icons
tests/            Playwright smoke tests
playwright.config.js
package.json
run-tests.sh      one-shot test runner
```

## Install (developer mode)

1. Push this repo to GitHub.
2. On the Chromebook, clone the repo.
3. Open `chrome://extensions`.
4. Toggle **Developer mode** on (top right).
5. Click **Load unpacked** and select the cloned repo directory.
6. Open a new tab — the landing page loads via the `chrome_url_overrides.newtab` setting.
7. Press **Ctrl + Shift + G** to open the control overlay.

## Reboot caveat

`chrome.runtime.restart()` only fires when the extension is launched as a kiosk app via enterprise policy (managed Chromebook + admin console). On a personal Chromebook in dev mode the reboot button no-ops silently — this is a Chrome platform restriction, not a bug in the extension.

For real kiosk deployment:
- Enroll the Chromebook in your Google Workspace / Chrome Enterprise domain.
- In the admin console, configure **Kiosk Apps** (Devices → Chrome → Apps & extensions → Kiosks) and force-install this extension by ID.
- Set it as the auto-launched kiosk app.

## Running tests

```sh
./run-tests.sh
```

The script installs `npm` deps and the Playwright Chromium build on first run, then executes the smoke tests in `tests/`. Tests load the unpacked extension into a Chromium persistent context, navigate to `home.html`, and verify:

- Landing page renders dummy content.
- Overlay opens via `Ctrl+Shift+G` and closes via `Esc` / close button.
- Zoom buttons update the displayed value and call `chrome.tabs.setZoom`.
- Rotation buttons call `chrome.system.display.setDisplayProperties` with the right rotation value (the API is stubbed during the test so your real display is never rotated).
- Reboot button shows a confirmation dialog; cancelling it does not call `chrome.runtime.restart`.

## Customise

- Replace `icons/icon{16,48,128}.png` with your branding.
- Edit `home.html` / `home.css` to swap dummy content for the real PWA.
- Adjust `ZOOM_MIN`, `ZOOM_MAX`, `ZOOM_STEP` at the top of `home.js`.
