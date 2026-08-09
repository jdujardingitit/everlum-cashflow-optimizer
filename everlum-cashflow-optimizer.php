<?php
/**
 * Plugin Name: Everlum Cash Flow Optimizer
 * Plugin URI: https://everlumenterprise.com
 * Description: Phase 1 implementation of the Everlum Cash Flow Optimizer with wizard UI, strategy simulation, secure save/retrieve, and optional Cloudflare Turnstile hooks.
 * Version: 0.1.0
 * Author: Everlum Enterprise LLC
 * Text Domain: everlum-cashflow-optimizer
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Everlum_Cashflow_Optimizer {
    private const VERSION = '0.1.0';
    private const TABLE_PLANS = 'everlum_cf_plans';
    private const TABLE_SIGNUPS = 'everlum_cf_prereg_signups';
    private const CLARITY_OPTION = 'everlum_cf_clarity_project_id';

    private static ?Everlum_Cashflow_Optimizer $instance = null;

    private wpdb $db;
    private string $plans_table;
    private string $signups_table;

    public static function instance(): Everlum_Cashflow_Optimizer {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        return self::$instance;
    }

    private function __construct() {
        global $wpdb;
        $this->db = $wpdb;
        $this->plans_table = $this->db->prefix . self::TABLE_PLANS;
        $this->signups_table = $this->db->prefix . self::TABLE_SIGNUPS;

        add_action('init', [$this, 'register_shortcodes']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        if (is_admin()) {
            add_action('admin_notices', [$this, 'admin_turnstile_notice']);
        }

        add_action('wp_ajax_everlum_cf_save_plan', [$this, 'ajax_save_plan']);
        add_action('wp_ajax_everlum_cf_get_plan', [$this, 'ajax_get_plan']);
        add_action('wp_ajax_everlum_cf_save_prereg', [$this, 'ajax_save_prereg']);
        add_action('wp_ajax_nopriv_everlum_cf_save_prereg', [$this, 'ajax_save_prereg']);
        add_action('wp_ajax_everlum_cf_signup', [$this, 'ajax_signup']);
        add_action('wp_ajax_nopriv_everlum_cf_signup', [$this, 'ajax_signup']);
        add_action('wp_ajax_everlum_cf_login', [$this, 'ajax_login']);
        add_action('wp_ajax_nopriv_everlum_cf_login', [$this, 'ajax_login']);
        add_action('wp_ajax_everlum_cf_forgot', [$this, 'ajax_forgot']);
        add_action('wp_ajax_nopriv_everlum_cf_forgot', [$this, 'ajax_forgot']);
    }

    public static function activate(): void {
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        if (class_exists('Everlum_Cashflow_Optimizer')) {
            $instance = new self();
            $wpdb = $instance->db;
            $charset = $wpdb->get_charset_collate();

            $plans = $instance->plans_table;
            $sql_plans = "CREATE TABLE {$plans} (
                id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
                user_id bigint(20) unsigned NOT NULL,
                title varchar(180) NOT NULL DEFAULT 'Saved Plan',
                status varchar(24) NOT NULL DEFAULT 'draft',
                payload longtext NOT NULL,
                money_steps longtext NULL,
                created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY  (id),
                KEY user_id (user_id),
                KEY status (status)
            ) {$charset};";

            $signups = $instance->signups_table;
            $sql_signups = "CREATE TABLE {$signups} (
                id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
                name varchar(160) NOT NULL,
                email varchar(190) NOT NULL,
                interests text NOT NULL,
                created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY email (email)
            ) {$charset};";

            dbDelta($sql_plans);
            dbDelta($sql_signups);
        }
    }

    public static function deactivate(): void {
        // Reserved for future cleanup.
    }

    public function register_shortcodes(): void {
        add_shortcode('everlum_cashflow_optimizer', [$this, 'render_shortcode']);
    }

    public function enqueue_assets(): void {
        global $post;

        if (is_admin()) {
            return;
        }

        if (! $post instanceof WP_Post || strpos($post->post_content, '[everlum_cashflow_optimizer]') === false) {
            return;
        }

        wp_enqueue_style(
            'everlum-cf-css',
            plugin_dir_url(__FILE__) . 'assets/css/everlum-cashflow-optimizer.css',
            [],
            self::VERSION
        );

        wp_enqueue_script(
            'everlum-cf-js',
            plugin_dir_url(__FILE__) . 'assets/js/everlum-cashflow-optimizer.js',
            [],
            self::VERSION,
            true
        );

        $this->maybe_enqueue_turnstile();
        $this->maybe_enqueue_clarity();

        wp_localize_script(
            'everlum-cf-js',
            'EverlumCF',
            [
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('everlum_cf_frontend'),
                'turnstileSiteKey' => $this->get_turnstile_site_key(),
                'isLoggedIn' => is_user_logged_in(),
                'userId' => get_current_user_id(),
                'currencySymbol' => '$',
                'canUseMoneySteps' => $this->can_use_money_steps(get_current_user_id()),
                'turnstileConfigured' => (bool) $this->is_turnstile_configured(),
                'clarityEnabled' => (bool) $this->should_load_clarity(),
                'e2eMode' => (bool) $this->is_e2e_mode(),
                'strings' => [
                    'loginHint' => 'Create a free account to save your plan and use Money Steps.',
                    'velocityMissing' => 'Velocity Banking: More information needed.',
                    'ibcNa' => 'Infinite Banking: N/A',
                    'clarityNote' => 'Clarity is for UX tracking only. Financial inputs must remain masked.',
                ],
            ]
        );
    }

    private function maybe_enqueue_turnstile(): void {
        $site_key = $this->get_turnstile_site_key();
        if (empty($site_key)) {
            return;
        }

        wp_enqueue_script(
            'everlum-turnstile',
            'https://challenges.cloudflare.com/turnstile/v2/api.js',
            [],
            null,
            true
        );
    }

    private function maybe_enqueue_clarity(): void {
        if (! $this->should_load_clarity()) {
            return;
        }

        $project_id = $this->get_clarity_project_id();
        if (empty($project_id)) {
            return;
        }

        wp_enqueue_script(
            'everlum-clarity',
            "https://www.clarity.ms/tag/{$project_id}",
            [],
            null,
            true
        );

        // Keep analytics safe during test automation unless explicitly enabled.
        wp_add_inline_script(
            'everlum-clarity',
            '(window.clarityQueue || (window.clarityQueue = [])).push(["set", "tracking", "enabled"]); window.__ecfClarityMaskedSelectors = ["[data-clarity-mask=\"true\"]", ".ecf-sensitive", ".ecf-financial-input", ".ecf-money-steps", ".ecf-saved-plan"];',
            'after'
        );
    }

    private function get_clarity_project_id(): string {
        $option_id = get_option(self::CLARITY_OPTION, '');
        $env_id = getenv('EVERLUM_CLARITY_PROJECT_ID') ?: '';
        return sanitize_text_field((string) ($env_id ?: $option_id));
    }

    private function get_wp_environment(): string {
        return function_exists('wp_get_environment_type')
            ? (string) wp_get_environment_type()
            : 'production';
    }

    private function is_clarity_request_disabled(): bool {
        return isset($_GET['disable_clarity']) && sanitize_text_field($_GET['disable_clarity']) === '1';
    }

    private function is_clarity_force_enabled(): bool {
        return sanitize_text_field((string) (getenv('EVERLUM_CLARITY_FORCE') ?: '')) === '1'
            || sanitize_text_field((string) ($_GET['enable_clarity'] ?? '')) === '1';
    }

    private function should_load_clarity(): bool {
        if ($this->is_clarity_request_disabled()) {
            return false;
        }

        if ($this->is_e2e_mode()) {
            return false;
        }

        $env = $this->get_wp_environment();
        $isAnalyticsEnv = in_array($env, ['production', 'staging'], true);

        if (! $isAnalyticsEnv && ! $this->is_clarity_force_enabled()) {
            return false;
        }

        return (bool) $this->get_clarity_project_id();
    }

    private function is_e2e_mode(): bool {
        return isset($_GET['ecf_e2e']) && sanitize_text_field($_GET['ecf_e2e']) === '1';
    }

    private function is_turnstile_mocked(): bool {
        $env = $this->get_wp_environment();
        if (in_array($env, ['production'], true)) {
            return false;
        }

        return isset($_GET['ecf_mock_turnstile']) && sanitize_text_field($_GET['ecf_mock_turnstile']) === '1';
    }

    private function get_turnstile_site_key(): string {
        $site_key = getenv('TURNSTILE_SITE_KEY') ?: get_option('everlum_cf_turnstile_site_key', '');
        return sanitize_text_field((string) $site_key);
    }

    private function get_turnstile_secret(): string {
        $secret = getenv('TURNSTILE_SECRET_KEY') ?: get_option('everlum_cf_turnstile_secret_key', '');
        return sanitize_text_field((string) $secret);
    }

    private function is_turnstile_configured(): bool {
        return $this->get_turnstile_site_key() !== '' && $this->get_turnstile_secret() !== '';
    }

    public function admin_turnstile_notice(): void {
        if (! current_user_can('manage_options')) {
            return;
        }

        $env = function_exists('wp_get_environment_type') ? wp_get_environment_type() : 'production';
        if (! in_array($env, ['production', 'staging'], true)) {
            return;
        }

        if ($this->is_turnstile_configured()) {
            return;
        }

        $message = esc_html__(
            'Cloudflare Turnstile keys are not fully configured. Public auth forms are currently not protected by Turnstile. Add both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in this environment.',
            'everlum-cashflow-optimizer'
        );
        echo '<div class="notice notice-warning"><p><strong>' . esc_html__('Everlum Cash Flow Optimizer', 'everlum-cashflow-optimizer') . ':</strong> ' . $message . '</p></div>';
    }

    private function verify_turnstile(string $token): bool {
        $secret = $this->get_turnstile_secret();
        if ($this->is_turnstile_mocked()) {
            return true;
        }

        if (empty($secret)) {
            return true;
        }

        if (empty($token)) {
            return false;
        }

        $response = wp_remote_post(
            'https://challenges.cloudflare.com/turnstile/v2/siteverify',
            [
                'timeout' => 15,
                'body' => [
                    'secret' => $secret,
                    'response' => $token,
                    'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
                ],
            ]
        );

        if (is_wp_error($response)) {
            return false;
        }

        $data = json_decode(wp_remote_retrieve_body($response), true);
        return !empty($data['success']);
    }

    private function can_use_money_steps(int $user_id): bool {
        if (! $user_id) {
            return false;
        }

        return apply_filters(
            'everlum_cf_money_steps_access',
            true,
            $user_id
        );
    }

    public function render_shortcode($atts = []): string {
        $defaults = [
            'title' => 'Your Path To Debt Freedom',
            'subtitle' => 'Create a personalized plan, compare strategies, and see how much time and money you can save.',
            'cta' => 'Start Your Free Plan',
            'plan_id' => 0,
        ];
        $atts = shortcode_atts($defaults, (array) $atts, 'everlum_cashflow_optimizer');

        $plan_id = isset($atts['plan_id']) ? (int) $atts['plan_id'] : 0;
        $existing_plan = null;
        if ($plan_id && is_user_logged_in()) {
            $candidate_plan = $this->get_plan_by_id($plan_id);
            if ($candidate_plan && (int) $candidate_plan['user_id'] === (int) get_current_user_id()) {
                $existing_plan = $candidate_plan;
            }
        }

        if (! $existing_plan && is_user_logged_in()) {
            $existing_plan = $this->get_latest_plan_for_current_user();
        }

        ob_start();
        ?>
        <div id="ecf-wrap" class="ecf-wrap ecf-cf-root" data-prefill-plan-id="<?php echo esc_attr((string) ($existing_plan['id'] ?? 0)); ?>" data-testid="ecf-cashflow-root">
            <header class="ecf-hero">
                <h1><?php echo esc_html((string) $atts['title']); ?></h1>
                <p><?php echo esc_html((string) $atts['subtitle']); ?></p>
                <div class="ecf-cta-row">
                    <a href="#ecf-step-budget" class="ecf-button-primary" data-testid="ecf-cta-start"><?php echo esc_html((string) $atts['cta']); ?></a>
                    <span class="ecf-trust-note">100% Free</span>
                    <span class="ecf-trust-note">No Credit Card</span>
                    <span class="ecf-trust-note">Private & Secure</span>
                </div>
            </header>

            <nav class="ecf-stepper" aria-label="Cash Flow Optimizer steps">
                <button class="ecf-stepper-btn is-active" data-step-index="0" data-testid="ecf-stepper-budget">1. Budget</button>
                <button class="ecf-stepper-btn" data-step-index="1" data-testid="ecf-stepper-debts">2. Debts</button>
                <button class="ecf-stepper-btn" data-step-index="2" data-testid="ecf-stepper-optimizer">3. Cash Flow Optimizer</button>
                <button class="ecf-stepper-btn" data-step-index="3" data-testid="ecf-stepper-results">4. Results</button>
                <button class="ecf-stepper-btn" data-step-index="4" data-testid="ecf-stepper-save">5. Save Plan</button>
                <button class="ecf-stepper-btn" data-step-index="5" data-testid="ecf-stepper-money-steps">6. Money Steps</button>
            </nav>

            <form id="ecf-form" class="ecf-form">
                <section id="ecf-step-budget" class="ecf-step is-active" data-step="0" data-testid="ecf-step-budget">
                    <h2>Budget</h2>
                    <p>Choose one budget path. The selected path is the main workspace.</p>
                    <div class="ecf-path-switcher" role="tablist">
                        <button type="button" class="ecf-path-btn is-active" data-path="summary" aria-pressed="true">Summary Budget</button>
                        <button type="button" class="ecf-path-btn" data-path="itemized" aria-pressed="false">Itemized Budget</button>
                    </div>

                    <div class="ecf-path-panel ecf-path-panel--summary is-active" data-budget-path="summary">
                        <label class="ecf-field">
                            <span>Monthly income</span>
                            <span class="ecf-tooltip" data-tooltip="Money coming in before taxes and spending.">i</span>
                            <input type="number" min="0" step="0.01" name="summaryIncome" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Monthly expenses</span>
                            <span class="ecf-tooltip" data-tooltip="All recurring expenses like rent, utilities, and subscriptions.">i</span>
                            <input type="number" min="0" step="0.01" name="summaryExpenses" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Normal savings</span>
                            <span class="ecf-tooltip" data-tooltip="Your regular savings amount before debt strategy calculations.">i</span>
                            <input type="number" min="0" step="0.01" name="summarySavings" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                    </div>

                    <div class="ecf-path-panel ecf-path-panel--itemized" data-budget-path="itemized">
                        <div class="ecf-subsection">
                            <h3>Income sources</h3>
                            <button type="button" class="ecf-inline-button" data-action="add-income-source">Add source</button>
                            <div class="ecf-list" id="ecf-income-sources" aria-live="polite"></div>
                        </div>
                        <div class="ecf-subsection">
                            <h3>Expense categories</h3>
                            <button type="button" class="ecf-inline-button" data-action="add-expense-row">Add category</button>
                            <div class="ecf-list" id="ecf-expense-list" aria-live="polite"></div>
                        </div>
                    </div>

                    <section class="ecf-common-section">
                        <h3>Big Purchase Savings <span class="ecf-tooltip" data-tooltip="Fund this goal first. Once funded, leftover cash can return to debt payoff.">i</span></h3>
                        <label class="ecf-field">
                            <span>Goal name</span>
                            <input type="text" name="bigGoalName" placeholder="Vacation, car, emergency fund">
                        </label>
                        <label class="ecf-field">
                            <span>Total amount</span>
                            <input type="number" min="0" step="0.01" name="bigGoalAmount" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <div class="ecf-two-col">
                            <label class="ecf-field">
                                <span>Date type</span>
                                <select name="bigGoalDateType">
                                    <option value="open">Open date</option>
                                    <option value="fixed">Fixed date</option>
                                </select>
                            </label>
                            <label class="ecf-field">
                                <span>Target date</span>
                                <input type="date" name="bigGoalDate">
                            </label>
                        </div>
                        <label class="ecf-field">
                            <span>Contribution method</span>
                            <select name="bigGoalContributionType">
                                <option value="fixed">Fixed dollar amount</option>
                                <option value="percent">Percent of cash flow</option>
                            </select>
                        </label>
                        <label class="ecf-field">
                            <span>Contribution amount</span>
                            <input type="number" min="0" step="0.01" name="bigGoalContributionAmount" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Contribution frequency</span>
                            <select name="bigGoalFrequency">
                                <option value="monthly">Monthly</option>
                                <option value="paycheck">Per paycheck</option>
                            </select>
                        </label>
                    </section>

                    <section class="ecf-common-section">
                        <h3>Unexpected money</h3>
                        <button type="button" class="ecf-inline-button" data-action="add-unexpected-fund">Add expected fund</button>
                        <div id="ecf-unexpected-funds" class="ecf-list" aria-live="polite"></div>
                    </section>

                    <button type="button" class="ecf-button-next" data-next data-testid="ecf-step-budget-next">Continue to Debts</button>
                </section>

                <section id="ecf-step-debts" class="ecf-step" data-step="1" data-testid="ecf-step-debts">
                    <h2>Debts</h2>
                    <button type="button" class="ecf-inline-button" data-action="add-debt-row">Add debt</button>
                    <div id="ecf-debt-list" class="ecf-list" aria-live="polite"></div>
                    <label class="ecf-checkbox">
                        <input type="checkbox" name="minimumsInExpenses" checked>
                        Minimum debt payments are already included in budget expenses.
                    </label>
                    <div class="ecf-row-actions">
                        <button type="button" class="ecf-button-secondary" data-prev>Back</button>
                        <button type="button" class="ecf-button-next" data-next data-testid="ecf-step-debts-next">Continue to Cash Flow Optimizer</button>
                    </div>
                </section>

                <section id="ecf-step-optimizer" class="ecf-step" data-step="2" data-testid="ecf-step-optimizer">
                    <h2>Cash Flow Optimizer</h2>
                    <p>Choose strategy cards to compare. Minimum Payments Only is baseline and always included.</p>
                    <div class="ecf-strategy-grid">
                        <label class="ecf-strategy-card">
                            <input type="checkbox" name="strategyMinimum" checked disabled>
                            <span>Minimum Payments Only</span>
                        </label>
                        <label class="ecf-strategy-card">
                            <input type="checkbox" name="strategyAvalanche" checked>
                            <span>Avalanche</span>
                        </label>
                        <label class="ecf-strategy-card">
                            <input type="checkbox" name="strategySnowball" checked>
                            <span>Snowball</span>
                        </label>
                        <label class="ecf-strategy-card">
                            <input type="checkbox" name="strategyCustom" checked>
                            <span>Custom Strategy</span>
                        </label>
                        <label class="ecf-strategy-card">
                            <input type="checkbox" name="strategyVelocity" checked disabled>
                            <span>Velocity Banking (Auto on)</span>
                        </label>
                        <label class="ecf-strategy-card">
                            <input type="checkbox" name="strategyInfinite" value="1">
                            <span>Infinite Banking</span>
                        </label>
                    </div>

                    <label class="ecf-field ecf-field--full">
                        <span>Custom strategy order (dragging later version)</span>
                        <input type="text" name="customOrder" placeholder="Optional manual order. e.g. Mortgage, Personal Loan, Credit Card">
                    </label>

                    <section class="ecf-common-section">
                        <h3>Velocity Banking inputs</h3>
                        <label class="ecf-field">
                            <span>Credit card name</span>
                            <button type="button" class="ecf-help" data-velocity-help="velocityCardVelocityExplanation" aria-label="Credit Card Velocity education">📖</button>
                            <input type="text" name="velocityCardName" placeholder="Card used for velocity flow" class="ecf-sensitive">
                        </label>
                        <label class="ecf-field">
                            <span>Credit card target debt</span>
                            <small class="ecf-field-note">Be accurate. The target must match one debt name exactly.</small>
                            <input type="text" name="velocityTargetDebt" placeholder="Match debt name exactly">
                        </label>
                        <label class="ecf-field">
                            <span>Timing mode
                                <span class="ecf-tooltip" data-tooltip="Generic timing is estimated. Custom timing accepts exact dates.">i</span>
                                <button type="button" class="ecf-help" data-velocity-help="velocityTimingMode" aria-label="Velocity Banking timing help">📖</button>
                            </span>
                            <span class="ecf-velocity-timing-options">
                                <label><input type="radio" name="velocityTimingMode" value="generic" checked> Generic timing</label>
                                <label><input type="radio" name="velocityTimingMode" value="custom"> Custom timing</label>
                            </span>
                        </label>
                        <p class="ecf-field-note ecf-velocity-timing-note"></p>
                        <label class="ecf-field">
                            <span>Expenses that must stay in checking <small class="ecf-field-note">(required for every month)</small>
                                <span class="ecf-tooltip" data-tooltip="These are not moved to card in phase 1.">i</span>
                                <button type="button" class="ecf-help" data-velocity-help="velocityRequiredCheckingHoldback" aria-label="What should stay in checking help">📖</button>
                            </span>
                            <input type="number" min="0" step="0.01" name="velocitySummaryCheckingHoldback" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Pay timing</span>
                            <select name="velocityPayTiming">
                                <option value="monthly">Monthly</option>
                                <option value="biweekly">Bi-weekly</option>
                                <option value="weekly">Weekly</option>
                            </select>
                        </label>
                        <label class="ecf-field">
                            <span>Credit card APR (for any card balance)</span>
                            <button type="button" class="ecf-help" data-velocity-help="velocityCardApr" aria-label="Credit card APR help">📖</button>
                            <input type="number" min="0" step="0.01" name="velocityCardApr" placeholder="29" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                            <small class="ecf-field-note">If blank, 29% is used by default with a disclaimer.</small>
                        </label>
                        <label class="ecf-field">
                            <span>Credit card balance</span>
                            <input type="number" min="0" step="0.01" name="velocityCardBalance" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Credit card limit</span>
                            <input type="number" min="0" step="0.01" name="velocityCardLimit" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Line of credit / credit tool
                                <span class="ecf-tooltip" data-tooltip="Only required for advanced LOC velocity path.">i</span>
                                <button type="button" class="ecf-help" data-velocity-help="velocityCreditToolType" aria-label="Line of credit explanation">📖</button>
                            </span>
                            <select name="velocityCreditToolType">
                                <option value="none">None</option>
                                <option value="heloc">HELOC</option>
                                <option value="personal_loc">Personal line of credit</option>
                                <option value="business_loc">Business line of credit</option>
                                <option value="margin_line">Margin line</option>
                                <option value="other">Other</option>
                            </select>
                        </label>
                        <label class="ecf-field">
                            <span>Credit tool balance</span>
                            <input type="number" min="0" step="0.01" name="velocityCreditToolBalance" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Credit tool APR</span>
                            <span class="ecf-tooltip" data-tooltip="Enter APR only if your LOC velocity path is used.">i</span>
                            <button type="button" class="ecf-help" data-velocity-help="velocityCreditToolApr" aria-label="Line of credit APR help">📖</button>
                            <input type="number" min="0" step="0.01" name="velocityCreditToolApr" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Credit tool limit</span>
                            <span class="ecf-tooltip" data-tooltip="Optional line-of-credit limit used for rough availability checks.">i</span>
                            <button type="button" class="ecf-help" data-velocity-help="velocityCreditToolLimit" aria-label="Line of credit limit help">📖</button>
                            <input type="number" min="0" step="0.01" name="velocityCreditToolLimit" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Credit tool minimum payment</span>
                            <span class="ecf-tooltip" data-tooltip="Reserve this amount before using extra LOC balance for debt payoff.">i</span>
                            <button type="button" class="ecf-help" data-velocity-help="velocityCreditToolMinimumPayment" aria-label="Credit tool minimum payment help">📖</button>
                            <input type="number" min="0" step="0.01" name="velocityCreditToolMinimumPayment" placeholder="Optional" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Credit tool due date</span>
                            <span class="ecf-tooltip" data-tooltip="Optional LOC payment due date for custom-timing estimates.">i</span>
                            <input type="date" name="velocityCreditToolDueDate">
                            <small class="ecf-field-note">Optional unless custom timing is enabled.</small>
                        </label>
                        <label class="ecf-field">
                            <span>Chunk timing</span>
                            <select name="velocityChunkTiming">
                                <option value="monthEnd">Month-end chunk</option>
                                <option value="midMonth">Mid-month chunk</option>
                            </select>
                        </label>

                        <div class="ecf-velocity-custom-section">
                        <h4>Custom timing details</h4>
                        <p class="ecf-field-note">For Custom Timing, enter exact dates from your payment sources.</p>
                        <label class="ecf-field">
                            <span>Paycheck dates</span>
                            <input type="text" name="velocityPaycheckDates" placeholder="e.g. 2026-08-10, 2026-08-25">
                        </label>
                        <label class="ecf-field">
                            <span>Credit card statement date
                                <span class="ecf-tooltip" data-tooltip="Use your statement close date for phase-1 timing.">i</span>
                                <button type="button" class="ecf-help" data-velocity-help="velocityStatementDate" aria-label="Credit card statement date help">📖</button>
                            </span>
                            <input type="date" name="velocityStatementDate">
                        </label>
                        <label class="ecf-field">
                            <span>Credit card due date
                                <span class="ecf-tooltip" data-tooltip="Set the payment due date that determines payoff timing.">i</span>
                                <button type="button" class="ecf-help" data-velocity-help="velocityCardDueDate" aria-label="Credit card due date help">📖</button>
                            </span>
                            <input type="date" name="velocityCardDueDate">
                        </label>
                        <label class="ecf-field">
                            <span>Credit card interest charge timing
                                <span class="ecf-tooltip" data-tooltip="Post date for the monthly finance/interest charge.">i</span>
                                <button type="button" class="ecf-help" data-velocity-help="velocityInterestChargeDate" aria-label="Credit card interest timing help">📖</button>
                            </span>
                            <input type="date" name="velocityInterestChargeDate">
                        </label>
                    </div>
                    </section>

                    <section class="ecf-common-section">
                        <h3>Infinite Banking (optional)</h3>
                        <label class="ecf-field">
                            <span>Monthly premium</span>
                            <input type="number" min="0" step="0.01" name="ibcPremium" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Current cash value</span>
                            <input type="number" min="0" step="0.01" name="ibcCashValue" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Policy loan rate</span>
                            <input type="number" min="0" step="0.01" name="ibcLoanRate" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Policy growth rate</span>
                            <input type="number" min="0" step="0.01" name="ibcGrowthRate" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Max loan-to-value</span>
                            <input type="number" min="0" step="0.01" name="ibcMaxLtv" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Monthly loan repayment</span>
                            <input type="number" min="0" step="0.01" name="ibcRepayment" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                        <label class="ecf-field">
                            <span>Policy loan amount</span>
                            <input type="number" min="0" step="0.01" name="ibcLoanAmount" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true">
                        </label>
                    </section>

                    <div class="ecf-row-actions">
                        <button type="button" class="ecf-button-secondary" data-prev>Back</button>
                        <button type="button" class="ecf-button-next" data-run-calculator data-clarity-event="cash_flow_optimizer_viewed" data-testid="ecf-calc-button">Calculate &amp; view Results</button>
                    </div>
                </section>

                <section id="ecf-step-results" class="ecf-step" data-step="3" data-testid="ecf-step-results">
                    <h2>Results</h2>
                    <div id="ecf-results" aria-live="polite" data-testid="ecf-results" class="ecf-sensitive">
                        <p class="ecf-empty-state">No results yet. Complete the previous steps and run the calculator.</p>
                        <div id="ecf-recommendation" class="ecf-result-card"></div>
                        <div id="ecf-result-grid" class="ecf-result-grid"></div>
                        <div id="ecf-result-visuals" class="ecf-result-visuals">
                            <div class="ecf-chart">
                                <h3>Remaining balance over time</h3>
                                <div class="ecf-chart-area" id="ecf-balance-chart"></div>
                            </div>
                            <div class="ecf-chart">
                                <h3>Income vs expense ratio</h3>
                                <div class="ecf-chart-area" id="ecf-ratio-chart"></div>
                            </div>
                        </div>
                        <p class="ecf-disclaimer">All calculations are estimates and use simplified assumptions. Verify before major financial decisions.</p>
                    </div>
                    <div class="ecf-row-actions">
                        <button type="button" class="ecf-button-secondary" data-prev>Back</button>
                        <button type="button" class="ecf-button-next" data-next data-auth-return="save" data-clarity-event="save_plan_clicked" data-testid="ecf-results-save-button">Continue to Save Plan</button>
                    </div>
                </section>

                <section id="ecf-step-save" class="ecf-step" data-step="4" data-testid="ecf-step-save">
                    <h2>Save Plan</h2>
                    <div id="ecf-save-section" class="ecf-saved-plan">
                        <p id="ecf-save-message" class="ecf-empty-state">
                            <?php echo esc_html(Everlum_Cashflow_Optimizer::build_login_message()); ?>
                        </p>
                        <label class="ecf-field">
                            <span>Plan title</span>
                            <input type="text" id="ecf-plan-title" value="My Cash Flow Plan">
                        </label>
                        <button type="button" id="ecf-save-plan-btn" class="ecf-button-primary" data-save-plan disabled>Save plan</button>
                        <p class="ecf-note">Plan save is for logged-in users only.</p>
                    </div>
                    <div class="ecf-row-actions">
                        <button type="button" class="ecf-button-secondary" data-prev>Back</button>
                        <button type="button" class="ecf-button-next" data-next data-auth-return="moneysteps" data-clarity-event="money_steps_opened" data-testid="ecf-save-money-steps-button">Continue to Money Steps</button>
                    </div>
                </section>

                <section id="ecf-step-money-steps" class="ecf-step" data-step="5" data-testid="ecf-step-money-steps">
                    <h2>Money Steps</h2>
                    <div id="ecf-money-steps-wrapper" class="ecf-money-steps" data-clarity-mask="true" data-testid="ecf-money-steps-wrapper">
                        <p class="ecf-empty-state">Money Steps are available for logged-in users.</p>
                        <div class="ecf-money-controls">
                            <label>
                                <span>Frequency</span>
                                <select id="ecf-money-frequency" data-testid="ecf-money-frequency">
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Bi-weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </label>
                            <button type="button" id="ecf-build-money-steps" class="ecf-button-primary" data-clarity-event="money_steps_opened" data-testid="ecf-build-money-steps-btn">Generate Money Steps</button>
                        </div>
                        <div class="ecf-table-wrap" data-testid="ecf-money-steps-table-wrap">
                            <table class="ecf-table" id="ecf-money-steps-table">
                                <thead>
                                    <tr>
                                        <th>Period #</th>
                                        <th>Start date</th>
                                        <th>End date</th>
                                        <th>Starting cash</th>
                                        <th>Income</th>
                                        <th>Expenses</th>
                                        <th>Normal savings</th>
                                        <th>Big purchase savings</th>
                                        <th>Minimum payments</th>
                                        <th>Extra debt payment</th>
                                        <th>Credit card charges</th>
                                        <th>Credit card payment</th>
                                        <th>Line of credit payment</th>
                                        <th>Ending cash</th>
                                        <th>Current target debt</th>
                                        <th>Remaining debt</th>
                                        <th>Credit card balance</th>
                                        <th>Credit tool balance</th>
                                        <th>Big purchase balance</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="ecf-row-actions">
                        <button type="button" class="ecf-button-secondary" data-prev>Back</button>
                    </div>
                </section>
            </form>

            <section class="ecf-account-panels">
                <h3>Account and notifications</h3>
                <div class="ecf-auth-grid">
                    <div class="ecf-account-card">
                        <h4>Create free account</h4>
                        <form id="ecf-signup-form" class="ecf-auth-form" data-testid="ecf-signup-form">
                            <label>Email<input type="email" name="email" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <label>Display name<input type="text" name="name" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <label>Password<input type="password" name="password" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <label>Confirm password<input type="password" name="password2" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <div class="ecf-turnstile" data-turnstile-target="signup"></div>
                            <button type="submit" data-clarity-event="account_created" data-testid="ecf-signup-submit">Create account</button>
                            <p class="ecf-form-message" data-form="signup"></p>
                        </form>
                    </div>
                    <div class="ecf-account-card">
                        <h4>Login</h4>
                        <form id="ecf-login-form" class="ecf-auth-form" data-testid="ecf-login-form">
                            <label>Email or username<input type="text" name="login" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <label>Password<input type="password" name="password" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <div class="ecf-turnstile" data-turnstile-target="login"></div>
                            <button type="submit" data-clarity-event="login_signin" data-testid="ecf-login-submit">Sign in</button>
                            <p class="ecf-form-message" data-form="login"></p>
                        </form>
                    </div>
                    <div class="ecf-account-card">
                        <h4>Forgot password</h4>
                        <form id="ecf-forgot-form" class="ecf-auth-form" data-testid="ecf-forgot-form">
                            <label>Email<input type="email" name="user" required class="ecf-sensitive" data-clarity-mask="true"></label>
                            <div class="ecf-turnstile" data-turnstile-target="forgot"></div>
                            <button type="submit" data-clarity-event="password_reset_requested" data-testid="ecf-forgot-submit">Send reset link</button>
                            <p class="ecf-form-message" data-form="forgot"></p>
                        </form>
                    </div>
                </div>
            </section>

            <section class="ecf-prereg">
                <h3>Want reminders, saved plan updates, and Money Steps notifications when they launch? Join the notification list.</h3>
                <form id="ecf-prereg-form" data-clarity-event="prereg_submitted" data-testid="ecf-prereg-form">
                    <label>Name<input type="text" name="name" required class="ecf-sensitive" data-clarity-mask="true"></label>
                    <label>Email<input type="email" name="email" required class="ecf-sensitive" data-clarity-mask="true"></label>
                    <div class="ecf-checkbox-grid">
                        <label><input type="checkbox" name="interests[]" value="Payment reminders">Payment reminders</label>
                        <label><input type="checkbox" name="interests[]" value="Money Steps updates">Money Steps updates</label>
                        <label><input type="checkbox" name="interests[]" value="Saved plans">Saved plans</label>
                        <label><input type="checkbox" name="interests[]" value="Everlum account/app launch">Everlum account/app launch</label>
                        <label><input type="checkbox" name="interests[]" value="All updates">All updates</label>
                    </div>
                    <div class="ecf-turnstile" data-turnstile-target="prereg"></div>
                    <button type="submit" data-testid="ecf-prereg-submit">Join notification list</button>
                    <p class="ecf-form-message" data-form="prereg"></p>
                </form>
            </section>

            <div id="ecf-velocity-help-modal" class="ecf-velocity-help-modal" aria-hidden="true" role="dialog" aria-labelledby="ecf-velocity-help-title">
                <div class="ecf-velocity-help-backdrop"></div>
                <div class="ecf-velocity-help-dialog">
                    <button id="ecf-velocity-help-close" type="button" class="ecf-velocity-help-close" aria-label="Close help">×</button>
                    <h3 id="ecf-velocity-help-title"></h3>
                    <div id="ecf-velocity-help-body" class="ecf-velocity-help-body"></div>
                </div>
            </div>

            <template id="ecf-row-income-source">
                <div class="ecf-repeat-row ecf-sensitive" data-clarity-mask="true">
                    <label>Source name <input type="text" data-field="name" required></label>
                    <label>Amount <input type="number" min="0" step="0.01" data-field="amount" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>Frequency <select data-field="frequency">
                        <option value="monthly">Monthly</option>
                        <option value="paycheck">Per paycheck</option>
                        <option value="weekly">Weekly</option>
                    </select></label>
                    <button type="button" class="ecf-delete-row" data-remove-row>Remove</button>
                </div>
            </template>

            <template id="ecf-row-expense">
                <div class="ecf-repeat-row ecf-sensitive" data-clarity-mask="true">
                    <label>Category <input type="text" data-field="name" required class="ecf-sensitive"></label>
                    <label>Amount <input type="number" min="0" step="0.01" data-field="amount" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>Frequency <select data-field="frequency">
                        <option value="monthly">Monthly</option>
                        <option value="paycheck">Per paycheck</option>
                        <option value="weekly">Weekly</option>
                    </select></label>
                    <label>Due date <input type="date" data-field="dueDate"></label>
                    <label>Credit card eligible?
                        <span class="ecf-tooltip" data-tooltip="Mark Yes only if the bill can be safely paid by card.">i</span>
                        <button type="button" class="ecf-help" data-velocity-help="velocityExpenseEligibility" aria-label="Credit card eligibility education">📖</button>
                        <small class="ecf-field-note">Be accurate here. This drives required-checking holdback and card-flow behavior.</small>
                        <select data-field="ccEligible">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                    </select></label>
                    <label>Current payment method
                        <span class="ecf-tooltip" data-tooltip="Separate from eligibility. This is how the expense is currently paid.">i</span>
                        <button type="button" class="ecf-help" data-velocity-help="velocityPaymentMethod" aria-label="Payment method education">📖</button>
                        <small class="ecf-field-note">Credit card eligible does not mean the expense must be paid by card.</small>
                        <select data-field="paymentMethod">
                            <option value="cash">Cash/Checking</option>
                            <option value="card">Credit Card</option>
                            <option value="lineOfCredit">Line of Credit</option>
                            <option value="other">Other</option>
                        </select>
                    </label>
                    <button type="button" class="ecf-delete-row" data-remove-row>Remove</button>
                </div>
            </template>

            <template id="ecf-row-unexpected">
                <div class="ecf-repeat-row ecf-sensitive" data-clarity-mask="true">
                    <label>Name <input type="text" data-field="name" required class="ecf-sensitive"></label>
                    <label>Amount <input type="number" min="0" step="0.01" data-field="amount" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>Date received <input type="date" data-field="date" required></label>
                    <label>Notes <input type="text" data-field="notes" class="ecf-sensitive"></label>
                    <button type="button" class="ecf-delete-row" data-remove-row>Remove</button>
                </div>
            </template>

            <template id="ecf-row-debt">
                <div class="ecf-repeat-row ecf-sensitive" data-clarity-mask="true">
                    <label>Debt name <input type="text" data-field="name" required class="ecf-sensitive"></label>
                    <label>Debt type
                        <select data-field="type">
                            <option>Credit Card</option>
                            <option>Personal Loan</option>
                            <option>Student Loan</option>
                            <option>Auto Loan</option>
                            <option>Mortgage</option>
                            <option>Medical Debt</option>
                            <option>Other</option>
                        </select>
                    </label>
                    <label>Balance <input type="number" min="0" step="0.01" data-field="balance" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>APR (%) <input type="number" min="0" step="0.01" data-field="apr" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>Minimum payment <input type="number" min="0" step="0.01" data-field="minimumPayment" required class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>Credit limit <input type="number" min="0" step="0.01" data-field="creditLimit" class="ecf-sensitive ecf-financial-input" data-clarity-mask="true"></label>
                    <label>Due date <input type="date" data-field="dueDate"></label>
                    <label>Interest tags
                        <span class="ecf-chip-group">
                            <label><input type="checkbox" value="Compound" data-field="interestType"> Compound</label>
                            <label><input type="checkbox" value="Variable" data-field="interestType"> Variable</label>
                            <label><input type="checkbox" value="Penalty risk" data-field="interestType"> Penalty risk</label>
                        </span>
                    </label>
                    <button type="button" class="ecf-delete-row" data-remove-row>Remove</button>
                </div>
            </template>
        </div>

        <script type="application/json" id="ecf-prefill-data">
            <?php echo wp_json_encode($existing_plan['payload'] ?? null); ?>
        </script>
        <?php
        return ob_get_clean();
    }

    public function ajax_save_plan(): void {
        if (! is_user_logged_in()) {
            wp_send_json_error(['message' => 'Please sign in to save a plan.']);
        }

        check_ajax_referer('everlum_cf_frontend', 'nonce');

        $user_id = get_current_user_id();
        $raw = stripslashes($_POST['payload'] ?? '');
        $payload = json_decode($raw, true);
        $money_steps = stripslashes($_POST['money_steps'] ?? '');
        $money_steps_data = null;

        if (! is_array($payload)) {
            wp_send_json_error(['message' => 'Invalid payload format.']);
        }

        $title = sanitize_text_field($_POST['title'] ?? 'Saved Plan');
        $status = sanitize_key($_POST['status'] ?? 'draft');
        if (! in_array($status, ['draft', 'published'], true)) {
            $status = 'draft';
        }

        $existing_plan_id = isset($_POST['plan_id']) ? (int) $_POST['plan_id'] : 0;
        if (! $existing_plan_id) {
            $latest_plan = $this->get_latest_plan_for_user($user_id);
            if (! empty($latest_plan['id'])) {
                $existing_plan_id = (int) $latest_plan['id'];
            }
        }

        if ($money_steps) {
            $decoded_steps = json_decode($money_steps, true);
            if (is_array($decoded_steps)) {
                $money_steps_data = wp_json_encode($decoded_steps);
            }
        }

        $stored_payload = wp_json_encode($payload);

        if ($existing_plan_id) {
            $existing = $this->get_plan_by_id($existing_plan_id);
            if (! $existing || (int) $existing['user_id'] !== $user_id) {
                wp_send_json_error(['message' => 'Plan not found.']);
            }

            $this->db->update(
                $this->plans_table,
                [
                    'title' => $title,
                    'status' => $status,
                    'payload' => $stored_payload,
                    'money_steps' => $money_steps_data,
                    'updated_at' => current_time('mysql'),
                ],
                [
                    'id' => $existing_plan_id,
                    'user_id' => $user_id,
                ],
                [
                    '%s',
                    '%s',
                    '%s',
                    '%s',
                    '%s',
                ],
                [
                    '%d',
                    '%d',
                ]
            );

            wp_send_json_success(['plan_id' => $existing_plan_id]);
        }

        $inserted = $this->db->insert(
            $this->plans_table,
            [
                'user_id' => $user_id,
                'title' => $title,
                'status' => $status,
                'payload' => $stored_payload,
                'money_steps' => $money_steps_data,
            ],
            [
                '%d',
                '%s',
                '%s',
                '%s',
                '%s',
            ]
        );

        if (! $inserted) {
            wp_send_json_error(['message' => 'Could not save plan.']);
        }

        wp_send_json_success(['plan_id' => (int) $this->db->insert_id]);
    }

    public function ajax_get_plan(): void {
        check_ajax_referer('everlum_cf_frontend', 'nonce');

        if (! is_user_logged_in()) {
            wp_send_json_error(['message' => 'Authentication required.']);
        }

        $user_id = get_current_user_id();
        $plan_id = isset($_POST['plan_id']) ? (int) $_POST['plan_id'] : 0;

        $plan = $plan_id ? $this->get_plan_by_id($plan_id) : $this->get_latest_plan_for_user($user_id);
        if (! $plan || (int) $plan['user_id'] !== $user_id) {
            wp_send_json_error(['message' => 'Plan not found.']);
        }

        wp_send_json_success($plan);
    }

    public function ajax_signup(): void {
        check_ajax_referer('everlum_cf_frontend', 'nonce');
        if (!$this->verify_turnstile((string) ($_POST['cf-turnstile-response'] ?? ''))) {
            wp_send_json_error(['message' => 'Turnstile validation failed.']);
        }

        $email = sanitize_email($_POST['email'] ?? '');
        $name = sanitize_text_field($_POST['name'] ?? '');
        $password = (string) ($_POST['password'] ?? '');
        $password2 = (string) ($_POST['password2'] ?? '');

        if (empty($email) || empty($name) || empty($password) || empty($password2)) {
            wp_send_json_error(['message' => 'All fields are required.']);
        }

        if (! is_email($email)) {
            wp_send_json_error(['message' => 'Please provide a valid email.']);
        }

        if ($password !== $password2) {
            wp_send_json_error(['message' => 'Passwords do not match.']);
        }

        $email_parts = explode('@', $email);
        $username = sanitize_user(strtolower(preg_replace('/[^A-Za-z0-9]/', '', $email_parts[0])), true);
        if (empty($username)) {
            $username = 'everlum_user';
        }
        if (username_exists($username)) {
            $username = $username . '-' . wp_generate_password(6, false, false);
        }

        $user_id = wp_create_user($username, $password, $email);
        if (is_wp_error($user_id)) {
            wp_send_json_error(['message' => $user_id->get_error_message()]);
        }

        wp_update_user(
            [
                'ID' => $user_id,
                'display_name' => $name,
            ]
        );

        wp_set_password($password, $user_id);
        wp_signon(
            [
                'user_login' => $email,
                'user_password' => $password,
                'remember' => true,
            ],
            is_ssl()
        );

        wp_send_json_success([
            'message' => 'Account created. You are now signed in.',
            'user_id' => $user_id,
        ]);
    }

    public function ajax_login(): void {
        check_ajax_referer('everlum_cf_frontend', 'nonce');
        if (! $this->verify_turnstile((string) ($_POST['cf-turnstile-response'] ?? ''))) {
            wp_send_json_error(['message' => 'Turnstile validation failed.']);
        }

        $creds = [
            'user_login' => sanitize_text_field($_POST['login'] ?? ''),
            'user_password' => (string) ($_POST['password'] ?? ''),
            'remember' => true,
        ];
        if (empty($creds['user_login']) || empty($creds['user_password'])) {
            wp_send_json_error(['message' => 'Missing login or password.']);
        }

        $user = wp_signon($creds, is_ssl());
        if (is_wp_error($user)) {
            wp_send_json_error(['message' => $user->get_error_message()]);
        }

        wp_send_json_success([
            'message' => 'Signed in.',
            'user_id' => $user->ID,
        ]);
    }

    public function ajax_forgot(): void {
        check_ajax_referer('everlum_cf_frontend', 'nonce');
        if (! $this->verify_turnstile((string) ($_POST['cf-turnstile-response'] ?? ''))) {
            wp_send_json_error(['message' => 'Turnstile validation failed.']);
        }

        $user_input = sanitize_text_field($_POST['user'] ?? '');
        if (empty($user_input)) {
            wp_send_json_error(['message' => 'Email is required.']);
        }

        $result = retrieve_password($user_input);
        if (is_wp_error($result)) {
            wp_send_json_error(['message' => $result->get_error_message()]);
        }

        wp_send_json_success(['message' => 'Reset email sent if account exists.']);
    }

    public function ajax_save_prereg(): void {
        check_ajax_referer('everlum_cf_frontend', 'nonce');

        if (! empty($this->get_turnstile_secret()) && ! $this->verify_turnstile((string) ($_POST['cf-turnstile-response'] ?? ''))) {
            wp_send_json_error(['message' => 'Turnstile validation failed.']);
        }

        $name = sanitize_text_field($_POST['name'] ?? '');
        $email = sanitize_email($_POST['email'] ?? '');
        $interests = isset($_POST['interests']) ? (array) $_POST['interests'] : [];
        $interests = array_map('sanitize_text_field', $interests);
        if ($interests === []) {
            $interests = ['All updates'];
        }

        if (! is_email($email) || empty($name)) {
            wp_send_json_error(['message' => 'Name and email are required.']);
        }

        $insert = $this->db->replace(
            $this->signups_table,
            [
                'name' => $name,
                'email' => $email,
                'interests' => implode(', ', $interests),
            ],
            [
                '%s',
                '%s',
                '%s',
            ]
        );

        if (! $insert) {
            wp_send_json_error(['message' => 'Could not store signup right now.']);
        }

        wp_send_json_success(['message' => 'Thanks! You are on the list.']);
    }

    private function get_plan_by_id(int $plan_id): ?array {
        $id = (int) $plan_id;
        if (! $id) {
            return null;
        }

        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT * FROM {$this->plans_table} WHERE id = %d LIMIT 1",
                $id
            ),
            ARRAY_A
        );

        return $row ?: null;
    }

    private function get_latest_plan_for_current_user(): ?array {
        if (! is_user_logged_in()) {
            return null;
        }

        return $this->get_latest_plan_for_user(get_current_user_id());
    }

    private function get_latest_plan_for_user(int $user_id): ?array {
        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT * FROM {$this->plans_table} WHERE user_id = %d ORDER BY updated_at DESC LIMIT 1",
                $user_id
            ),
            ARRAY_A
        );

        return $row ?: null;
    }

    private static function build_login_message(): string {
        return 'Create a free account to save your plan and use Money Steps.';
    }
}

register_activation_hook(__FILE__, ['Everlum_Cashflow_Optimizer', 'activate']);
register_deactivation_hook(__FILE__, ['Everlum_Cashflow_Optimizer', 'deactivate']);
add_action('plugins_loaded', [Everlum_Cashflow_Optimizer::class, 'instance']);
