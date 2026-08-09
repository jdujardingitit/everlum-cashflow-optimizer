#!/usr/bin/env bash
set -euo pipefail

WP_PATH="${WP_PATH:-/var/www/html}"
PLUGIN_SLUG="${PLUGIN_SLUG:-everlum-cashflow-optimizer}"
PROJECT_ROOT="${PROJECT_ROOT:-/workspace}"

echo "[install-plugin] Installing ${PLUGIN_SLUG} to ${WP_PATH}"

rm -rf "${WP_PATH}/wp-content/plugins/${PLUGIN_SLUG}"
mkdir -p "${WP_PATH}/wp-content/plugins/${PLUGIN_SLUG}"

cp "${PROJECT_ROOT}/everlum-cashflow-optimizer.php" "${WP_PATH}/wp-content/plugins/${PLUGIN_SLUG}/"
cp -R "${PROJECT_ROOT}/assets" "${WP_PATH}/wp-content/plugins/${PLUGIN_SLUG}/"

if command -v wp >/dev/null 2>&1; then
  wp plugin activate "${PLUGIN_SLUG}" --path="${WP_PATH}" --allow-root
else
  echo "[install-plugin] wp-cli is required to activate the plugin. Copy is complete; activation skipped."
  exit 0
fi

echo "[install-plugin] Done."
