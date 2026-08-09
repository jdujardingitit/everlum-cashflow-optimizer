#!/usr/bin/env bash
set -euo pipefail

WP_PATH="${WP_PATH:-/var/www/html}"
DB_NAME="${WP_DB_NAME:-eecf_e2e}"
DB_USER="${WP_DB_USER:-eecf_user}"
DB_PASSWORD="${WP_DB_PASSWORD:-eecf_pass}"
DB_HOST="${WP_DB_HOST:-db:3306}"
SITE_URL="${WP_SITE_URL:-http://localhost:8080}"
CALC_PAGE_SLUG="${WP_CALC_PAGE_SLUG:-everlum-cf-qa}"
ADMIN_USER="${WP_ADMIN_USER:-eecf_admin}"
ADMIN_PASSWORD="${WP_ADMIN_PASSWORD:-EecfAdmin123!}"
ADMIN_EMAIL="${WP_ADMIN_EMAIL:-admin@localhost.localdomain}"
TEST_USER_EMAIL="${ECF_TEST_USER_EMAIL:-eecf-user-a@example.test}"
TEST_USER_PASSWORD="${ECF_TEST_USER_PASSWORD:-EecfPassA!234}"
TEST_USER_NAME="${ECF_TEST_USER_NAME:-Playwright QA}"
ALT_USER_EMAIL="${ECF_TEST_USER_EMAIL_ALT:-eecf-user-b@example.test}"
ALT_USER_PASSWORD="${ECF_TEST_USER_PASSWORD_ALT:-EecfPassB!234}"

echo "[setup-wp] Preparing WordPress in ${WP_PATH}"

mkdir -p "${WP_PATH}"

cd "${WP_PATH}/.."
if [ ! -f "${WP_PATH}/wp-config.php" ]; then
  wp core download --path="${WP_PATH}" --version=6.5.5 --skip-content --force --allow-root

  wp config create \
    --path="${WP_PATH}" \
    --dbname="${DB_NAME}" \
    --dbuser="${DB_USER}" \
    --dbpass="${DB_PASSWORD}" \
    --dbhost="${DB_HOST}" \
    --skip-check \
    --allow-root

  wp core install \
    --path="${WP_PATH}" \
    --url="${SITE_URL}" \
    --title="Everlum Cashflow QA" \
    --admin_user="${ADMIN_USER}" \
    --admin_password="${ADMIN_PASSWORD}" \
    --admin_email="${ADMIN_EMAIL}" \
    --skip-email \
    --allow-root
else
  echo "[setup-wp] WordPress already initialized; skipping fresh install."
fi

# Install/refresh plugin files so reruns stay deterministic.
rm -rf "${WP_PATH}/wp-content/plugins/everlum-cashflow-optimizer"
mkdir -p "${WP_PATH}/wp-content/plugins/everlum-cashflow-optimizer"
cp /workspace/everlum-cashflow-optimizer.php "${WP_PATH}/wp-content/plugins/everlum-cashflow-optimizer/"
cp -R /workspace/assets "${WP_PATH}/wp-content/plugins/everlum-cashflow-optimizer/"
wp plugin activate everlum-cashflow-optimizer --path="${WP_PATH}" --allow-root

wp option update permalink_structure '/%postname%/' --path="${WP_PATH}" --allow-root
wp rewrite flush --hard --path="${WP_PATH}" --allow-root

if EXISTING_PAGE_ID=$(wp post get "${CALC_PAGE_SLUG}" --path="${WP_PATH}" --field=ID --allow-root 2>/dev/null); then
  wp post update "${EXISTING_PAGE_ID}" \
    --path="${WP_PATH}" \
    --post_content='[everlum_cashflow_optimizer]' \
    --post_status=publish \
    --porcelain \
    --allow-root
else
  wp post create \
    --path="${WP_PATH}" \
    --post_type=page \
    --post_title='Everlum Cash Flow Optimizer QA' \
    --post_name="${CALC_PAGE_SLUG}" \
    --post_content='[everlum_cashflow_optimizer]' \
    --post_status=publish \
    --porcelain \
    --allow-root
fi

wp user create "${TEST_USER_NAME// /_}" "${TEST_USER_EMAIL}" \
  --user_pass="${TEST_USER_PASSWORD}" \
  --role=subscriber \
  --path="${WP_PATH}" \
  --allow-root \
  --skip-email || true

wp user create "${TEST_USER_NAME// /_}_alt" "${ALT_USER_EMAIL}" \
  --user_pass="${ALT_USER_PASSWORD}" \
  --role=subscriber \
  --path="${WP_PATH}" \
  --allow-root \
  --skip-email || true

echo "[setup-wp] Completed."
