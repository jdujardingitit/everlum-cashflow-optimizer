<?php
/**
 * Plugin Name: Everlum V1 Review Environment
 * Description: Nonproduction review banner and safeguards outside the frozen V1 plugin.
 */

if (! defined('ABSPATH')) {
    exit;
}

const ECF_V1_REVIEW_TAG = 'ecf-wordpress-v1.0-review';
const ECF_V1_REVIEW_COMMIT = 'e4de26b154b10f01c5df14c3c9de04ecd48b0b9e';

add_filter('pre_option_blog_public', static function () { return '0'; });
add_filter('automatic_updater_disabled', '__return_true');
add_filter('auto_update_core', '__return_false');
add_filter('auto_update_plugin', '__return_false');
add_filter('auto_update_theme', '__return_false');
add_filter('pre_option_everlum_cf_clarity_project_id', '__return_empty_string');

add_action('send_headers', static function () {
    header('X-Robots-Tag: noindex, nofollow, noarchive', true);
});

function ecf_v1_review_banner(): void
{
    static $shown = false;
    if ($shown || is_admin()) {
        return;
    }
    $shown = true;
    echo '<div id="ecf-v1-review-banner" style="background:#8b1e16;color:#fff;padding:10px 16px;text-align:center;font:700 14px/1.3 sans-serif;position:relative;z-index:999999">V1 REVIEW - NONPRODUCTION</div>';
}

add_action('wp_body_open', 'ecf_v1_review_banner', 1);
add_action('wp_footer', 'ecf_v1_review_banner', 1);

add_action('template_redirect', static function () {
    $path = parse_url(isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
    if (untrailingslashit((string) $path) !== '/ecf-v1-review-status') {
        return;
    }
    status_header(200);
    nocache_headers();
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><title>ECF V1 Review Status</title></head><body>';
    echo '<h1>V1 REVIEW - NONPRODUCTION</h1>';
    echo '<p>Tag: <code>' . esc_html(ECF_V1_REVIEW_TAG) . '</code></p>';
    echo '<p>Commit: <code>' . esc_html(ECF_V1_REVIEW_COMMIT) . '</code></p>';
    echo '<p>Clarity: disabled. Search indexing: blocked. Background updates: disabled.</p>';
    echo '</body></html>';
    exit;
});
