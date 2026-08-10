<?php
if (! defined('ABSPATH')) {
    exit(1);
}

$reset = isset($args[0]) && $args[0] === 'reset';
global $wpdb;

if ($reset) {
    foreach (array('everlum_cf_plans', 'everlum_cf_prereg_signups') as $suffix) {
        $table = $wpdb->prefix . $suffix;
        $wpdb->query("TRUNCATE TABLE `{$table}`");
    }
}

$users = array(
    array(getenv('OWNER_A_USERNAME'), getenv('OWNER_A_PASSWORD'), getenv('OWNER_A_EMAIL')),
    array(getenv('OWNER_B_USERNAME'), getenv('OWNER_B_PASSWORD'), getenv('OWNER_B_EMAIL')),
);

foreach ($users as $item) {
    list($username, $password, $email) = $item;
    if (! $username || ! $password || ! $email) {
        WP_CLI::error('Synthetic review user environment is incomplete.');
    }
    $user = get_user_by('login', $username);
    if (! $user) {
        $user_id = wp_create_user($username, $password, $email);
        if (is_wp_error($user_id)) {
            WP_CLI::error($user_id->get_error_message());
        }
        $user = get_user_by('id', $user_id);
    } else {
        wp_set_password($password, $user->ID);
    }
    $user->set_role('subscriber');
}

$page = get_page_by_path('everlum-cf-qa', OBJECT, 'page');
$post = array(
    'ID' => $page ? $page->ID : 0,
    'post_type' => 'page',
    'post_title' => 'Everlum Cash Flow Optimizer V1 Review',
    'post_name' => 'everlum-cf-qa',
    'post_content' => '[everlum_cashflow_optimizer]',
    'post_status' => 'publish',
);
$page_id = wp_insert_post($post, true);
if (is_wp_error($page_id)) {
    WP_CLI::error($page_id->get_error_message());
}

update_option('permalink_structure', '/%postname%/');
update_option('blog_public', '0');
WP_CLI::success('Synthetic V1 review state is ready.');
