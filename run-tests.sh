#!/usr/bin/env bash
# Smoke-test the Kiosk Control extension with Playwright.
# - Installs Node dependencies on first run.
# - Ensures Playwright's Chromium build is present.
# - Runs the Playwright suite in tests/.
#
# Note: Chromium extensions require a headed (or new-headless) browser. The
# Playwright config launches with headless: false, so a display server is
# required. On macOS / Linux desktops this Just Works.

set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "==> Installing npm dependencies"
  npm install --no-audit --no-fund
fi

echo "==> Ensuring Playwright Chromium is installed"
npx --no-install playwright install chromium

echo "==> Running Playwright tests"
npx --no-install playwright test "$@"
