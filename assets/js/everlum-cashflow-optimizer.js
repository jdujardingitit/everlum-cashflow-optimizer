(function () {
    const cfg = window.EverlumCF || {};
    const root = document.getElementById('ecf-wrap');
    if (!root) {
        return;
    }

    const state = {
        currentStep: 0,
        lastResult: null,
        lastMoneySteps: [],
        debounceTimer: 0,
    };

    const clarityEvents = [];
    const clarityEventBus = window.__ecfClarityEvents || [];

    const $ = (sel, el = document) => el.querySelector(sel);
    const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
    const asNumber = (value) => Number.parseFloat(value || 0) || 0;
    const asText = (value) => (typeof value === 'string' ? value.trim() : '');
    const STORAGE_KEY = 'ecf-progress-draft-v1';
    const VELOCITY_HELP_TEXT = {
        velocityTimingMode: {
            title: 'Velocity Banking timing',
            body: 'Choose Generic Timing when you do not have exact dates. Choose Custom Timing when you can provide paycheck dates, expense due dates, statement date, due date, and interest charge timing.',
        },
        velocitySummaryCheckingHoldback: {
            title: 'What should stay in checking?',
            body: 'This is the amount that must remain in checking before credit-card transfer each period. Include bills that are cash-only, require guaranteed on-time payment, or can’t be safely floated.',
        },
        velocityCardName: {
            title: 'Credit card name',
            body: 'Give the card a label so the simulation can reflect the account used in credit-card velocity.',
        },
        velocityCardApr: {
            title: 'Credit card APR',
            body: 'If missing, Credit Card Velocity uses 29% as an estimate. Enter your actual APR for more accurate results.',
        },
        velocityStatementDate: {
            title: 'Credit card statement date',
            body: 'The statement close date anchors when monthly charges are bundled. It improves timing accuracy for payment planning.',
        },
        velocityCardDueDate: {
            title: 'Credit card due date',
            body: 'Credit card interest is usually avoided when the posted balance is fully paid before this date.',
        },
        velocityInterestChargeDate: {
            title: 'How to Find When Your Credit Card Charges Interest',
            body: '<p>To make Velocity Banking more accurate, you can check when your credit card charges interest.</p><ol><li>Log in to your credit card account.</li><li>Go to Transactions, Activity, or Statements.</li><li>Search for terms like:</li><ul><li>Interest</li><li>Interest Charge</li><li>Purchase Interest</li><li>Finance Charge</li><li>Cash Advance Interest</li></ul><li>Look at the date the interest charge was posted.</li><li>Also check your statement closing date and payment due date.</li><li>Enter those dates in Custom Timing for a more accurate Velocity Banking estimate.</li></ol><p>Each credit card company may label interest differently. If you cannot find the exact date, you can use Generic Timing.</p>',
        },
        velocityRequiredCheckingHoldback: {
            title: 'What Should Stay in Checking?',
            body: 'Not every bill can safely stay on a card. Rent, mortgage, cash-only bills, and high-fee bills can make a check-first holdback essential.',
        },
        velocityExpenseEligibility: {
            title: 'Why Credit Card Eligibility Matters',
            body: 'Credit Card Eligibility determines whether an expense is safe for card use. Current payment method is separate and can still be Cash/Checking even if eligible.',
        },
        velocityPaymentMethod: {
            title: 'Current payment method',
            body: 'Current payment method sets how that bill is paid now. Eligibility tells whether it can be paid by card if you choose that path.',
        },
        velocityCreditToolBalance: {
            title: 'Credit tool balance',
            body: 'Enter the current line-of-credit balance if LOC Velocity is used. A positive balance is debt on the tool.',
        },
        velocityCreditToolType: {
            title: 'Line of Credit Velocity Explained',
            body: 'Line-of-credit tools are optional and advanced. In Phase 1, Credit Card Velocity is the default. LOC Velocity is only calculated when credit-tool fields are provided.',
        },
        velocityCreditToolApr: {
            title: 'Line of Credit APR',
            body: 'Enter an APR only when LOC Velocity is being modeled. Missing APR limits precision for LOC interest math.',
        },
        velocityCreditToolLimit: {
            title: 'Line of Credit Limit',
            body: 'Optional LOC limit is used for rough availability checks only.',
        },
        velocityCreditToolMinimumPayment: {
            title: 'Line of Credit Minimum Payment',
            body: 'Optional minimum payment helps reserve cash before any extra LOC payoff allocation.',
        },
        velocityCreditToolDueDate: {
            title: 'Line of Credit Due Date',
            body: 'Optional LOC due date can improve custom-timing estimates.',
        },
        velocityCardVelocityExplanation: {
            title: 'Credit Card Velocity Explained',
            body: 'Credit Card Velocity uses income timing, required checking holdback, and credit-card expense scheduling to reduce the average card balance that carries interest. It does not change APR; it changes when cash is exposed on the card.',
        },
        velocityGenericTimingDisclaimer: {
            title: 'Velocity Banking timing',
            body: 'Velocity Banking results are estimated using generic timing. For a more accurate result, enter your actual paycheck dates, bill due dates, statement date, due date, and interest charge timing.',
        },
        velocityCustomTimingNotice: {
            title: 'Custom timing currently estimated',
            body: 'Custom Timing uses your entered dates to improve the estimate. Full date-by-date simulation is still pending.',
        },
    };

    const form = $('#ecf-form');
    const stepEls = $$('.ecf-step', form);
    const stepButtons = $$('.ecf-stepper-btn');
    const prefillScript = $('#ecf-prefill-data');

    const fieldNodes = {
        summaryIncome: $('[name="summaryIncome"]', root),
        summaryExpenses: $('[name="summaryExpenses"]', root),
        summarySavings: $('[name="summarySavings"]', root),
        minimumsInExpenses: $('[name="minimumsInExpenses"]', root),
        bigGoalName: $('[name="bigGoalName"]', root),
        bigGoalAmount: $('[name="bigGoalAmount"]', root),
        bigGoalDateType: $('[name="bigGoalDateType"]', root),
        bigGoalDate: $('[name="bigGoalDate"]', root),
        bigGoalContributionType: $('[name="bigGoalContributionType"]', root),
        bigGoalContributionAmount: $('[name="bigGoalContributionAmount"]', root),
        bigGoalFrequency: $('[name="bigGoalFrequency"]', root),
        customOrder: $('[name="customOrder"]', root),
        strategyInfinite: $('[name="strategyInfinite"]', root),
        velocityPayTiming: $('[name="velocityPayTiming"]', root),
        velocityTimingMode: $$('[name="velocityTimingMode"]', root),
        velocityPaycheckDates: $('[name="velocityPaycheckDates"]', root),
        velocitySummaryCheckingHoldback: $('[name="velocitySummaryCheckingHoldback"]', root),
        velocityCardName: $('[name="velocityCardName"]', root),
        velocityCardApr: $('[name="velocityCardApr"]', root),
        velocityStatementDate: $('[name="velocityStatementDate"]', root),
        velocityCardDueDate: $('[name="velocityCardDueDate"]', root),
        velocityInterestChargeDate: $('[name="velocityInterestChargeDate"]', root),
        velocityCurrentPaymentMethod: $('[name="velocityCurrentPaymentMethod"]', root),
        velocityCardBalance: $('[name="velocityCardBalance"]', root),
        velocityCardLimit: $('[name="velocityCardLimit"]', root),
        velocityCreditToolType: $('[name="velocityCreditToolType"]', root),
        velocityCreditToolApr: $('[name="velocityCreditToolApr"]', root),
        velocityCreditToolLimit: $('[name="velocityCreditToolLimit"]', root),
        velocityCreditToolMinimumPayment: $('[name="velocityCreditToolMinimumPayment"]', root),
        velocityCreditToolDueDate: $('[name="velocityCreditToolDueDate"]', root),
        velocityCreditToolBalance: $('[name="velocityCreditToolBalance"]', root),
        velocityChunkTiming: $('[name="velocityChunkTiming"]', root),
        velocityTargetDebt: $('[name="velocityTargetDebt"]', root),
        velocityHelpModal: $('#ecf-velocity-help-modal', root),
        velocityHelpModalTitle: $('#ecf-velocity-help-title', root),
        velocityHelpModalBody: $('#ecf-velocity-help-body', root),
        velocityHelpModalClose: $('#ecf-velocity-help-close', root),
        velocityCustomSection: $('.ecf-velocity-custom-section', root),
        velocityTimingNote: $('.ecf-velocity-timing-note', root),
        ibcPremium: $('[name="ibcPremium"]', root),
        ibcCashValue: $('[name="ibcCashValue"]', root),
        ibcLoanRate: $('[name="ibcLoanRate"]', root),
        ibcGrowthRate: $('[name="ibcGrowthRate"]', root),
        ibcMaxLtv: $('[name="ibcMaxLtv"]', root),
        ibcRepayment: $('[name="ibcRepayment"]', root),
        ibcLoanAmount: $('[name="ibcLoanAmount"]', root),
        saveMessage: $('#ecf-save-message', root),
        saveBtn: $('#ecf-save-plan-btn', root),
        planTitle: $('#ecf-plan-title', root),
        resultContainer: $('#ecf-results', root),
        recommendation: $('#ecf-recommendation', root),
        resultGrid: $('#ecf-result-grid', root),
        moneyFrequency: $('#ecf-money-frequency', root),
        buildMoneyStepsBtn: $('#ecf-build-money-steps', root),
        moneyStepsBody: $('#ecf-money-steps-table tbody', root),
        moneyStepsWrapper: $('#ecf-money-steps-wrapper', root),
        signupForm: $('#ecf-signup-form', root),
        loginForm: $('#ecf-login-form', root),
        forgotForm: $('#ecf-forgot-form', root),
        preregForm: $('#ecf-prereg-form', root),
    };

    const templates = {
        incomeSource: $('#ecf-row-income-source', root),
        expense: $('#ecf-row-expense', root),
        unexpected: $('#ecf-row-unexpected', root),
        debt: $('#ecf-row-debt', root),
    };

    const containers = {
        incomeSources: $('#ecf-income-sources', root),
        expenseList: $('#ecf-expense-list', root),
        unexpectedList: $('#ecf-unexpected-funds', root),
        debtList: $('#ecf-debt-list', root),
    };

    const planResultState = {
        payload: null,
        results: null,
    };

    init();

    function init() {
        window.__ecfClarityEvents = clarityEventBus;
        window.__ecfGetClarityEvents = () => clarityEventBus;
        trackClarityEvent('budget_started');
        setupTurnstile();
        bindNavigation();
        bindRepeatButtons();
        bindPathSwitcher();
        bindButtons();
        bindAuthHandlers();
        bindPrereg();
        bindVelocityEducation();
        bindVelocityTimingMode();
        addSeedRows();
        loadDraft();
        loadFromServerPrefill();
        configureSaveButton();
        setTimeout(() => autosaveDraft(), 100);
    }

    function trackClarityEvent(name) {
        const eventName = asText(name);
        if (!eventName) {
            return;
        }

        const entry = { name: eventName, at: Date.now() };
        clarityEvents.push(entry);
        clarityEventBus.push(entry);

        if (cfg.e2eMode) {
            return;
        }

        if (cfg.clarityEnabled && typeof window.clarity === 'function') {
            try {
                window.clarity('event', eventName);
            } catch (error) {
                // keep local queue for diagnostics only
            }
        }
    }

    function setupTurnstile() {
        if (!cfg.turnstileSiteKey) {
            return;
        }

        const turnstileNodes = Array.from(
            new Set([
                ...$$('[data-turnstile-target="login"]', root),
                ...$$('[data-turnstile-target="signup"]', root),
                ...$$('[data-turnstile-target="forgot"]', root),
                ...$$('[data-turnstile-target="prereg"]', root),
                ...$$('[data-turnstile-target="public"]', root),
                ...$$('[data-turnstile-target="public-form"]', root),
                ...$$('.ecf-turnstile', root),
            ])
        );

        turnstileNodes.forEach((node) => {
            node.setAttribute('class', 'cf-turnstile ecf-turnstile');
            node.setAttribute('data-sitekey', cfg.turnstileSiteKey);
            node.setAttribute('data-size', 'compact');
            node.setAttribute('data-theme', 'dark');
        });
    }

    function bindButtons() {
        $$('[data-next]', root).forEach((button) => {
            button.addEventListener('click', (event) => {
                const explicitSource = event.currentTarget.getAttribute('data-auth-return');
                if (explicitSource) {
                    setAuthReturnContext(explicitSource);
                }
                const nextIndex = state.currentStep + 1;
                if (state.currentStep === 0 && nextIndex === 1) {
                    trackClarityEvent('budget_completed');
                }

                if (state.currentStep === 1 && nextIndex === 2) {
                    trackClarityEvent('debts_completed');
                }

                const explicitEvent = event.currentTarget.getAttribute('data-clarity-event');
                if (explicitEvent) {
                    trackClarityEvent(explicitEvent);
                }

                goToStep(nextIndex);
            });
        });
        $$('[data-prev]', root).forEach((button) => {
            button.addEventListener('click', () => {
                goToStep(state.currentStep - 1);
            });
        });
        root.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-clarity-event]');
            if (!trigger || !root.contains(trigger)) {
                return;
            }
            if (trigger.matches('[data-next]') || trigger.matches('[data-run-calculator]')) {
                return;
            }
            trackClarityEvent(trigger.getAttribute('data-clarity-event'));
        });
        $('[data-run-calculator]', root).addEventListener('click', () => {
            const explicitRunEvent = $('[data-run-calculator]', root).getAttribute('data-clarity-event');
            if (explicitRunEvent) {
                trackClarityEvent(explicitRunEvent);
            }

            const payload = gatherPayload();
            const results = runCalculations(payload);
            state.lastResult = results;
            planResultState.payload = payload;
            planResultState.results = results;
            renderResults(results, payload);
            goToStep(3);
            trackClarityEvent('results_viewed');
            autosaveDraft();
        });

        fieldNodes.saveBtn.addEventListener('click', () => savePlan());
        if (fieldNodes.buildMoneyStepsBtn) {
            fieldNodes.buildMoneyStepsBtn.addEventListener('click', () => {
                renderMoneySteps();
            });
        }

        stepButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                goToStep(index);
            });
        });

        form.addEventListener('input', () => {
            window.clearTimeout(state.debounceTimer);
            state.debounceTimer = window.setTimeout(() => {
                autosaveDraft();
            }, 450);
        });
    }

    function bindNavigation() {
        stepButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                setAuthReturnContext(getAuthReturnSourceFromStep(index));
                goToStep(index);
            });
        });
    }

    function bindVelocityEducation() {
        const openHelp = (trigger) => {
            const key = trigger.getAttribute('data-velocity-help');
            if (!key || !VELOCITY_HELP_TEXT[key]) {
                return;
            }
            trackClarityEvent('velocity_educational_note_opened');
            if (key === 'velocityExpenseEligibility') {
                trackClarityEvent('credit_card_eligibility_note_opened');
            }
            const text = VELOCITY_HELP_TEXT[key];
            if (fieldNodes.velocityHelpModalTitle) {
                fieldNodes.velocityHelpModalTitle.textContent = text.title;
            }
            if (fieldNodes.velocityHelpModalBody) {
                fieldNodes.velocityHelpModalBody.innerHTML = text.body;
            }
            if (fieldNodes.velocityHelpModal) {
                fieldNodes.velocityHelpModal.classList.add('is-open');
                fieldNodes.velocityHelpModal.setAttribute('aria-hidden', 'false');
                fieldNodes.velocityHelpModalClose?.focus();
            }
        };

        root.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-velocity-help]');
            if (!trigger || !root.contains(trigger)) {
                return;
            }
            event.preventDefault();
            openHelp(trigger);
        });

        root.addEventListener('keydown', (event) => {
            const trigger = event.target.closest('[data-velocity-help]');
            if (!trigger || !root.contains(trigger)) {
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openHelp(trigger);
            }
        });

        if (fieldNodes.velocityHelpModalClose) {
            fieldNodes.velocityHelpModalClose.addEventListener('click', closeVelocityHelp);
        }
        if (fieldNodes.velocityHelpModal) {
            fieldNodes.velocityHelpModal.addEventListener('click', (event) => {
                const target = event.target;
                if (target === fieldNodes.velocityHelpModal || target?.classList?.contains('ecf-velocity-help-backdrop')) {
                    closeVelocityHelp();
                }
            });
            fieldNodes.velocityHelpModal.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closeVelocityHelp();
                }
            });
        }
    }

    function closeVelocityHelp() {
        if (!fieldNodes.velocityHelpModal) {
            return;
        }
        fieldNodes.velocityHelpModal.classList.remove('is-open');
        fieldNodes.velocityHelpModal.setAttribute('aria-hidden', 'true');
    }

    function bindVelocityTimingMode() {
        const section = fieldNodes.velocityCustomSection;
        const update = () => {
            const mode = [...fieldNodes.velocityTimingMode].find((node) => node.checked)?.value || 'generic';
            if (section) {
                section.style.display = mode === 'custom' ? '' : 'none';
            }
            if (fieldNodes.velocityTimingNote) {
                fieldNodes.velocityTimingNote.textContent = mode === 'generic'
                    ? 'Generic Timing uses estimated credit card dates. For a more accurate Velocity Banking result, check your credit card transactions or statement and enter your real statement date, due date, and interest charge timing.'
                    : 'Custom Timing uses your entered dates to improve the estimate. Full date-by-date simulation is still pending.';
            }
        };

        if (section) {
            [...fieldNodes.velocityTimingMode].forEach((mode) => {
                mode.addEventListener('change', update);
            });
            update();
        }
    }

    function goToStep(index) {
        if (index < 0 || index >= stepEls.length) {
            return;
        }

        state.currentStep = index;
        setAuthReturnContext(getAuthReturnSourceFromStep(index));
        stepEls.forEach((step, i) => step.classList.toggle('is-active', i === index));
        stepButtons.forEach((btn, i) => btn.classList.toggle('is-active', i === index));
        if (index === 2) {
            trackClarityEvent('cash_flow_optimizer_viewed');
        }

        if (index === 3) {
            trackClarityEvent('results_viewed');
        }

        if (typeof updateSaveAccessibility === 'function') {
            updateSaveAccessibility();
            return;
        }

        configureSaveButton();
    }

    function bindPathSwitcher() {
        $$('.ecf-path-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.path;
                const activePanel = $('.ecf-path-panel.is-active', root);
                const nextPanel = $(`.ecf-path-panel[data-budget-path="${target}"]`, root);
                const activePath = activePanel ? activePanel.dataset.budgetPath : 'summary';

                if (target === activePath) {
                    return;
                }

                if (!isCurrentPathEmpty(activePath) && !window.confirm('Switching budget paths will clear the current path values. Continue?')) {
                    return;
                }

                $$('.ecf-path-btn', root).forEach((other) => other.classList.remove('is-active'));
                btn.classList.add('is-active');
                btn.setAttribute('aria-pressed', 'true');

                if (nextPanel) {
                    $('.ecf-path-panel.is-active', root).classList.remove('is-active');
                    nextPanel.classList.add('is-active');
                }
            });
        });
    }

    function bindRepeatButtons() {
        $('[data-action="add-income-source"]').addEventListener('click', () => addIncomeRow());
        $('[data-action="add-expense-row"]').addEventListener('click', () => addExpenseRow());
        $('[data-action="add-unexpected-fund"]').addEventListener('click', () => addUnexpectedRow());
        $('[data-action="add-debt-row"]').addEventListener('click', () => addDebtRow());

        root.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-remove-row]');
            if (trigger) {
                trigger.closest('.ecf-repeat-row')?.remove();
                autosaveDraft();
                return;
            }

            if (event.target.matches('.ecf-inline-button')) {
                event.preventDefault();
            }
        });

        root.addEventListener('change', (event) => {
            if (event.target && event.target.matches('[data-field="ccEligible"]')) {
                const row = event.target.closest('.ecf-repeat-row');
                if (!row) {
                    return;
                }

                const method = row.querySelector('[data-field="paymentMethod"]');
                const creditOption = [...method.options].find((option) => option.value === 'card');
                if (!creditOption) {
                    return;
                }

                if (event.target.value === 'no') {
                    method.value = 'cash';
                    creditOption.hidden = true;
                    method.classList.add('ecf-disabled');
                } else {
                    creditOption.hidden = false;
                    method.classList.remove('ecf-disabled');
                }
            }
        });
    }

    function addSeedRows() {
        if (containers.incomeSources.children.length === 0) {
            addIncomeRow();
        }

        if (containers.expenseList.children.length === 0) {
            addExpenseRow();
        }

        if (containers.unexpectedList.children.length === 0) {
            addUnexpectedRow();
        }

        if (containers.debtList.children.length === 0) {
            addDebtRow();
        }
    }

    function cloneNode(id) {
        const source = templates[id];
        return source.content.firstElementChild.cloneNode(true);
    }

    function addIncomeRow(data = null) {
        const row = cloneNode('incomeSource');
        if (data) {
            row.querySelector('[data-field="name"]').value = data.name || '';
            row.querySelector('[data-field="amount"]').value = data.amount || '';
            row.querySelector('[data-field="frequency"]').value = data.frequency || 'monthly';
        }
        containers.incomeSources.appendChild(row);
    }

    function addExpenseRow(data = null) {
        const row = cloneNode('expense');
        if (data) {
            row.querySelector('[data-field="name"]').value = data.name || '';
            row.querySelector('[data-field="amount"]').value = data.amount || '';
            row.querySelector('[data-field="frequency"]').value = data.frequency || 'monthly';
            row.querySelector('[data-field="dueDate"]').value = data.dueDate || '';
            const ccEligible = data.ccEligible || 'no';
            let paymentMethod = data.paymentMethod || 'cash';
            row.querySelector('[data-field="ccEligible"]').value = ccEligible;
            if (ccEligible === 'no' && paymentMethod === 'card') {
                paymentMethod = 'cash';
            }
            row.querySelector('[data-field="paymentMethod"]').value = paymentMethod;
            if (ccEligible === 'no') {
                const paymentMethod = row.querySelector('[data-field="paymentMethod"]');
                const creditOption = [...paymentMethod.options].find((option) => option.value === 'card');
                if (creditOption) {
                    creditOption.hidden = true;
                }
                if (paymentMethod.value === 'card') {
                    paymentMethod.value = 'cash';
                }
            }
        }
        containers.expenseList.appendChild(row);
    }

    function addUnexpectedRow(data = null) {
        const row = cloneNode('unexpected');
        if (data) {
            row.querySelector('[data-field="name"]').value = data.name || '';
            row.querySelector('[data-field="amount"]').value = data.amount || '';
            row.querySelector('[data-field="date"]').value = data.date || '';
            row.querySelector('[data-field="notes"]').value = data.notes || '';
        }
        containers.unexpectedList.appendChild(row);
    }

    function addDebtRow(data = null) {
        const row = cloneNode('debt');
        if (data) {
            row.querySelector('[data-field="name"]').value = data.name || '';
            row.querySelector('[data-field="type"]').value = data.type || 'Credit Card';
            row.querySelector('[data-field="balance"]').value = data.balance || '';
            row.querySelector('[data-field="apr"]').value = data.apr || '';
            row.querySelector('[data-field="minimumPayment"]').value = data.minimumPayment || '';
            row.querySelector('[data-field="creditLimit"]').value = data.creditLimit || '';
            row.querySelector('[data-field="dueDate"]').value = data.dueDate || '';
            if (data.interestType && data.interestType.length) {
                const inputs = row.querySelectorAll('[data-field="interestType"]');
                inputs.forEach((input) => {
                    if (data.interestType.includes(input.value)) {
                        input.checked = true;
                    }
                });
            }
        }
        containers.debtList.appendChild(row);
    }

    function isCurrentPathEmpty(path) {
        if (path === 'summary') {
            return !asNumber(fieldNodes.summaryIncome.value)
                + !asNumber(fieldNodes.summaryExpenses.value)
                + !asNumber(fieldNodes.summarySavings.value) === 3;
        }

        if (path === 'itemized') {
            return containers.incomeSources.children.length === 0 && containers.expenseList.children.length === 0;
        }

        return false;
    }

    function gatherPayload() {
        const budgetPath = $('.ecf-path-btn.is-active', root)?.dataset.path || 'summary';
        const rawVelocityCardApr = asText(fieldNodes.velocityCardApr.value || '');
        const rawVelocitySummaryHoldback = asNumber(fieldNodes.velocitySummaryCheckingHoldback?.value || 0);
        const velocityModeNode = [...fieldNodes.velocityTimingMode].find((node) => node.checked);
        const rawVelocityMode = (velocityModeNode && velocityModeNode.value) ? velocityModeNode.value : 'generic';
        const statementDate = asText(fieldNodes.velocityStatementDate?.value || '');
        const cardDueDate = asText(fieldNodes.velocityCardDueDate?.value || '');
        const interestChargeDate = asText(fieldNodes.velocityInterestChargeDate?.value || '');
        const paycheckDates = parseDateList(asText(fieldNodes.velocityPaycheckDates?.value || ''));
        const velocityTimingMissing = rawVelocityMode === 'custom' ? {
            statementDate: !statementDate,
            cardDueDate: !cardDueDate,
            interestChargeDate: !interestChargeDate,
            paycheckDates: !paycheckDates.length,
        } : {
            statementDate: false,
            cardDueDate: false,
            interestChargeDate: false,
            paycheckDates: false,
        };
        const fallbackToGeneric = rawVelocityMode === 'custom' && (velocityTimingMissing.statementDate || velocityTimingMissing.cardDueDate || velocityTimingMissing.interestChargeDate || velocityTimingMissing.paycheckDates);
        const summaryHoldback = Math.max(0, Math.min(rawVelocitySummaryHoldback, asNumber(fieldNodes.summaryExpenses?.value || 0)));
        const pathSummary = {
            income: asNumber(fieldNodes.summaryIncome.value),
            expenses: asNumber(fieldNodes.summaryExpenses.value),
            savings: asNumber(fieldNodes.summarySavings.value),
        };

        const incomeSources = [];
        containers.incomeSources.querySelectorAll('.ecf-repeat-row').forEach((row) => {
            incomeSources.push({
                name: asText(row.querySelector('[data-field="name"]').value),
                amount: asNumber(row.querySelector('[data-field="amount"]').value),
                frequency: row.querySelector('[data-field="frequency"]').value,
            });
        });

        const expenses = [];
        containers.expenseList.querySelectorAll('.ecf-repeat-row').forEach((row) => {
            const expense = {
                name: asText(row.querySelector('[data-field="name"]').value),
                amount: asNumber(row.querySelector('[data-field="amount"]').value),
                frequency: row.querySelector('[data-field="frequency"]').value,
                dueDate: row.querySelector('[data-field="dueDate"]').value || null,
                ccEligible: row.querySelector('[data-field="ccEligible"]').value,
                paymentMethod: row.querySelector('[data-field="paymentMethod"]').value,
            };
            if (expense.ccEligible !== 'yes' && expense.paymentMethod === 'card') {
                expense.paymentMethod = 'cash';
            }
            expenses.push(expense);
        });

        const unexpectedFunds = [];
        containers.unexpectedList.querySelectorAll('.ecf-repeat-row').forEach((row) => {
            unexpectedFunds.push({
                name: asText(row.querySelector('[data-field="name"]').value),
                amount: asNumber(row.querySelector('[data-field="amount"]').value),
                date: row.querySelector('[data-field="date"]').value || null,
                notes: asText(row.querySelector('[data-field="notes"]').value),
            });
        });

        const debts = [];
        containers.debtList.querySelectorAll('.ecf-repeat-row').forEach((row) => {
            const selectedInterest = [];
            row.querySelectorAll('[data-field="interestType"]').forEach((checkbox) => {
                if (checkbox.checked) {
                    selectedInterest.push(checkbox.value);
                }
            });

            debts.push({
                name: asText(row.querySelector('[data-field="name"]').value) || 'Debt',
                type: row.querySelector('[data-field="type"]').value,
                balance: asNumber(row.querySelector('[data-field="balance"]').value),
                apr: asNumber(row.querySelector('[data-field="apr"]').value),
                minimumPayment: asNumber(row.querySelector('[data-field="minimumPayment"]').value),
                creditLimit: asNumber(row.querySelector('[data-field="creditLimit"]').value),
                dueDate: row.querySelector('[data-field="dueDate"]').value || null,
                interestType: selectedInterest,
            });
        });

        const totalIncome = budgetPath === 'summary'
            ? pathSummary.income
            : incomeSources.reduce((sum, item) => sum + normalizeByFrequency(item.amount, item.frequency), 0);

        const totalExpenses = budgetPath === 'summary'
            ? pathSummary.expenses
            : expenses
                .filter((expense) => expense.name.toLowerCase() !== 'normal savings')
                .reduce((sum, item) => sum + normalizeByFrequency(item.amount, item.frequency), 0);

        const normalSavings = budgetPath === 'summary'
            ? pathSummary.savings
            : expenses
                .filter((expense) => expense.name.toLowerCase() === 'normal savings')
                .reduce((sum, item) => sum + normalizeByFrequency(item.amount, item.frequency), 0);

        const velocityAllocation = budgetPath === 'summary'
            ? {
                cashExpenseMonthly: summaryHoldback,
                cardExpenseMonthly: Math.max(0, totalExpenses - summaryHoldback),
                requiredCheckingHoldback: summaryHoldback,
            }
            : summarizeVelocityExpenseAllocation(expenses);

        const bigPurchaseAmount = asNumber(fieldNodes.bigGoalAmount.value);
        const bigContribution = asNumber(fieldNodes.bigGoalContributionAmount.value);
        const bigContributionType = fieldNodes.bigGoalContributionType.value;
        const bigContributionFrequency = fieldNodes.bigGoalFrequency.value;
        const computedBigContribution = bigContributionType === 'percent'
            ? (totalIncome === 0 ? 0 : (totalIncome * (bigContribution / 100)))
            : bigContribution;
        const bigMonthlyContribution = bigContributionFrequency === 'paycheck'
            ? computedBigContribution / 2
            : computedBigContribution;

        return {
            budgetPath,
            pathSummary,
            incomeSources,
            expenses,
            unexpectedFunds,
            normalSavings,
            totalIncome,
            totalExpenses,
            bigPurchase: {
                active: bigPurchaseAmount > 0,
                name: asText(fieldNodes.bigGoalName.value) || 'Big Purchase Goal',
                targetAmount: bigPurchaseAmount,
                dateType: fieldNodes.bigGoalDateType.value,
                targetDate: fieldNodes.bigGoalDate.value || null,
                contributionType: bigContributionType,
                contributionAmount: bigContribution,
                contributionFrequency: bigContributionFrequency,
                monthlyContribution: bigMonthlyContribution,
            },
            debts,
            minimumsInExpenses: fieldNodes.minimumsInExpenses.checked,
            optimizer: {
                minimum: true,
                avalanche: $('[name="strategyAvalanche"]', root).checked,
                snowball: $('[name="strategySnowball"]', root).checked,
                custom: $('[name="strategyCustom"]', root).checked,
                velocity: $('[name="strategyVelocity"]', root).checked,
                customOrder: asText(fieldNodes.customOrder.value),
            },
            velocity: {
                enabled: true,
                payTiming: fieldNodes.velocityPayTiming.value,
                timingMode: rawVelocityMode,
                timingEstimated: rawVelocityMode === 'generic' || fallbackToGeneric,
                timingFallback: fallbackToGeneric,
                timingMissing: velocityTimingMissing,
                payFrequency: fieldNodes.velocityPayTiming.value || 'monthly',
                paycheckDates,
                cardName: asText(fieldNodes.velocityCardName?.value || ''),
                cardApr: rawVelocityCardApr ? asNumber(rawVelocityCardApr) : 29,
                cardAprEstimated: !rawVelocityCardApr,
                statementDate: statementDate || null,
                cardDueDate,
                interestChargeDate,
                chunkTiming: fieldNodes.velocityChunkTiming.value,
                targetDebt: asText(fieldNodes.velocityTargetDebt.value) || null,
                currentPaymentMethod: asText(fieldNodes.velocityCurrentPaymentMethod?.value || 'cash'),
                cardBalance: asNumber(fieldNodes.velocityCardBalance?.value),
                cardLimit: asNumber(fieldNodes.velocityCardLimit?.value),
                creditToolBalance: asNumber(fieldNodes.velocityCreditToolBalance?.value),
                creditToolType: asText(fieldNodes.velocityCreditToolType?.value || 'none'),
                creditToolApr: asNumber(fieldNodes.velocityCreditToolApr?.value),
                creditToolLimit: asNumber(fieldNodes.velocityCreditToolLimit?.value),
                creditToolMinimumPayment: asNumber(fieldNodes.velocityCreditToolMinimumPayment?.value),
                creditToolDueDate: asText(fieldNodes.velocityCreditToolDueDate?.value || ''),
                summaryCheckingHoldback: rawVelocitySummaryHoldback || 0,
                requiredCheckingHoldback: asNumber(velocityAllocation.requiredCheckingHoldback),
                cashExpenseMonthly: asNumber(velocityAllocation.cashExpenseMonthly),
                cardExpenseMonthly: asNumber(velocityAllocation.cardExpenseMonthly),
                missingData: [],
            },
            infiniteBanking: {
                enabled: fieldNodes.strategyInfinite.checked,
                monthlyPremium: asNumber(fieldNodes.ibcPremium.value),
                cashValue: asNumber(fieldNodes.ibcCashValue.value),
                loanRate: asNumber(fieldNodes.ibcLoanRate.value),
                growthRate: asNumber(fieldNodes.ibcGrowthRate.value),
                maxLtv: asNumber(fieldNodes.ibcMaxLtv.value),
                monthlyRepayment: asNumber(fieldNodes.ibcRepayment.value),
                loanAmount: asNumber(fieldNodes.ibcLoanAmount.value),
                missingData: [],
            },
            generatedAt: new Date().toISOString(),
        };
    }

    function normalizeByFrequency(value, frequency) {
        switch (frequency) {
            case 'weekly':
                return value * 4.333;
            case 'paycheck':
                return value * 2;
            default:
                return value;
        }
    }

    function summarizeVelocityExpenseAllocation(expenses) {
        const totals = {
            cashExpenseMonthly: 0,
            cardExpenseMonthly: 0,
            requiredCheckingHoldback: 0,
        };

        expenses.forEach((expense) => {
            const monthly = normalizeByFrequency(expense.amount, expense.frequency);
            const isCheckedCardEligible = expense.ccEligible === 'yes' && expense.paymentMethod === 'card';
            if (isCheckedCardEligible) {
                totals.cardExpenseMonthly += monthly;
            } else {
                totals.cashExpenseMonthly += monthly;
            }

            if (
                expense.ccEligible !== 'yes'
                || expense.paymentMethod === 'cash'
                || expense.paymentMethod === 'other'
            ) {
                totals.requiredCheckingHoldback += monthly;
            }
        });

        return totals;
    }

    function parseDateList(value) {
        if (!value) {
            return [];
        }

        return String(value)
            .split(/[,\n]/)
            .map((item) => item.trim())
            .filter((item) => item)
            .filter((item) => !Number.isNaN(Date.parse(item)))
            .sort((a, b) => new Date(a) - new Date(b))
            .map((item) => item);
    }

    function runCalculations(payload) {
        const summary = buildBaseSummary(payload);
        payload.summary = summary;
        const strategies = [];

        if (payload.optimizer.minimum) {
            strategies.push(simulateStrategy('Minimum Payments Only', payload, 'minimum'));
        }
        if (payload.optimizer.avalanche) {
            strategies.push(simulateStrategy('Avalanche', payload, 'avalanche'));
        }
        if (payload.optimizer.snowball) {
            strategies.push(simulateStrategy('Snowball', payload, 'snowball'));
        }
        if (payload.optimizer.custom) {
            const custom = simulateStrategy('Custom Strategy', payload, 'custom');
            custom.orderHint = payload.optimizer.customOrder || 'Manual input order';
            strategies.push(custom);
        }

        if (payload.optimizer.velocity) {
            const statusCard = velocityReadiness(payload, 'card');
            const statusLoc = velocityReadiness(payload, 'loc');

            if (statusCard.ready) {
                const velocityCard = simulateStrategy('Credit Card Velocity', payload, 'velocityCard');
                velocityCard.timingEstimated = statusCard.timingEstimated;
                velocityCard.missingTiming = statusCard.timingMissing;
                if (velocityCard && statusCard.timingMissing.length) {
                    velocityCard.timingMissing = statusCard.timingMissing;
                }
                strategies.push(velocityCard);
            }

            if (statusLoc.ready) {
                const velocityLoc = simulateStrategy('LOC Velocity', payload, 'velocityLoc');
                velocityLoc.timingEstimated = statusLoc.timingEstimated;
                if (velocityLoc && statusLoc.timingMissing.length) {
                    velocityLoc.timingMissing = statusLoc.timingMissing;
                }
                strategies.push(velocityLoc);
            } else {
                strategies.push({
                    name: 'LOC Velocity: N/A',
                    status: 'na',
                    missing: statusLoc.missing || [],
                    errorMessage: 'LOC Velocity: N/A',
                    note: statusLoc.missing.length ? `More information needed: ${statusLoc.missing.join(', ')}` : 'LOC Velocity: N/A',
                });
            }

            if (statusCard.ready && statusLoc.ready) {
                const velocityCombo = simulateStrategy('Credit Card + LOC Velocity', payload, 'velocityCombo');
                velocityCombo.timingEstimated = statusCard.timingEstimated || statusLoc.timingEstimated;
                strategies.push(velocityCombo);
            }

            if (!statusCard.ready && !statusLoc.ready) {
                const missing = Array.from(new Set([...statusCard.missing, ...statusLoc.missing]));
                strategies.push({
                    name: 'Velocity Banking',
                    status: 'missing',
                    missing: missing,
                    errorMessage: cfg.strings.velocityMissing,
                    note: missing.length
                        ? `More information needed: ${missing.join(', ')}`
                        : 'Velocity Banking is not available from the current inputs.',
                });
            }
        }

        if (payload.infiniteBanking.enabled) {
            const ibcCheck = infiniteBankingReadiness(payload);
            if (ibcCheck.ready) {
                strategies.push({
                    name: 'Infinite Banking',
                    status: 'na',
                    errorMessage: cfg.strings.ibcNa,
                    note: 'IBC optional / placeholder logic only. Distinct IBC engine pending future scope.',
                });
            } else {
                strategies.push({
                    name: 'Infinite Banking',
                    status: 'na',
                    errorMessage: cfg.strings.ibcNa,
                    note: ibcCheck.reason,
                });
            }
        } else {
            strategies.push({
                name: 'Infinite Banking',
                status: 'na',
                errorMessage: cfg.strings.ibcNa,
            });
        }

        const comparable = strategies
            .filter((item) => item.status === 'ok')
            .sort((a, b) => {
                if ((a.months || 9999) === (b.months || 9999)) {
                    return (a.totalInterest || 0) - (b.totalInterest || 0);
                }
                return (a.months || 9999) - (b.months || 9999);
            });

        const top = comparable[0] || null;

        return {
            summary,
            strategies,
            recommended: top,
            disclaimer: [
                'Calculations are estimates.',
                'No result is a financial recommendation; always confirm with a planner.',
            ],
        };
    }

    function buildBaseSummary(payload) {
        const base = asNumber(payload.totalIncome) - asNumber(payload.totalExpenses) - asNumber(payload.normalSavings);
        const bigMonthly = payload.bigPurchase.active ? asNumber(payload.bigPurchase.monthlyContribution) : 0;
        const availableForDebt = Math.max(0, base - bigMonthly);

        return {
            totalIncome: asNumber(payload.totalIncome),
            totalExpenses: asNumber(payload.totalExpenses),
            normalSavings: asNumber(payload.normalSavings),
            availableCashFlow: base,
            bigPurchaseMonthly: bigMonthly,
            afterBigPurchase: availableForDebt,
            debtCount: payload.debts.length,
            totalMinimum: payload.debts.reduce((sum, debt) => sum + asNumber(debt.minimumPayment), 0),
            totalBalance: payload.debts.reduce((sum, debt) => sum + asNumber(debt.balance), 0),
        };
    }

    function velocityReadiness(payload, mode) {
        const missing = [];
        const timingMissing = [];

        if (!payload.totalIncome || payload.totalIncome <= 0) {
            missing.push('Income');
        }

        if (!payload.debts.length) {
            missing.push('Debt entries');
        } else if (!payload.velocity.targetDebt) {
            missing.push('Target debt name');
        } else if (!payload.debts.some((debt) => debt.name.toLowerCase() === payload.velocity.targetDebt.toLowerCase())) {
            missing.push('Target debt not found');
        }

        if (mode === 'card') {
            const hasCCEligibleExpense = payload.budgetPath === 'summary'
                ? (asNumber(payload.totalExpenses) - asNumber(payload.velocity?.summaryCheckingHoldback) > 0)
                : payload.expenses.some((expense) => expense.ccEligible === 'yes' && Number(expense.amount) > 0);
            if (!hasCCEligibleExpense) {
                missing.push('Credit-card-eligible expense');
            }
            if (payload.velocity.timingMode === 'custom') {
                const ccExpenseDueMissing = payload.expenses.some((expense) => expense.ccEligible === 'yes' && expense.paymentMethod === 'card' && !expense.dueDate);
                if (ccExpenseDueMissing) {
                    timingMissing.push('Credit card expense due date');
                }
                if (!payload.velocity.statementDate) {
                    timingMissing.push('Credit card statement date');
                }
                if (!payload.velocity.cardDueDate) {
                    timingMissing.push('Credit card due date');
                }
                if (!payload.velocity.interestChargeDate) {
                    timingMissing.push('Credit card interest charge date');
                }
                if (!payload.velocity.paycheckDates || payload.velocity.paycheckDates.length === 0) {
                    timingMissing.push('Paycheck dates');
                }
                if (payload.budgetPath === 'summary' && !payload.velocity.summaryCheckingHoldback) {
                    timingMissing.push('Estimated card-expense mix');
                }
            }
            if (payload.budgetPath === 'itemized') {
                const hasCardDueDates = payload.expenses
                    .filter((expense) => expense.ccEligible === 'yes' && expense.paymentMethod === 'card')
                    .some((expense) => !!expense.dueDate);
                if (payload.velocity.timingMode === 'custom' && !hasCardDueDates) {
                    timingMissing.push('Credit card expense due dates');
                }
            }
        }

        if (mode === 'loc') {
            if (!payload.velocity.creditToolType || payload.velocity.creditToolType === 'none') {
                missing.push('Credit tool type');
            }
            if (!payload.velocity.creditToolBalance && !payload.velocity.creditToolLimit && !payload.velocity.creditToolApr) {
                missing.push('Credit tool data');
            }
            if (payload.velocity.timingMode === 'custom' && !payload.velocity.creditToolDueDate) {
                timingMissing.push('Credit tool due date');
            }
        }

        return {
            ready: missing.length === 0,
            missing,
            timingMissing,
            timingEstimated: payload.velocity.timingMode === 'generic' || timingMissing.length > 0,
        };
    }

    function infiniteBankingReadiness(payload) {
        const missing = [];
        if (!payload.infiniteBanking.monthlyPremium) {
            missing.push('Monthly premium');
        }
        if (!payload.infiniteBanking.cashValue) {
            missing.push('Current cash value');
        }
        if (!payload.infiniteBanking.loanRate) {
            missing.push('Policy loan rate');
        }
        if (!payload.infiniteBanking.growthRate) {
            missing.push('Policy growth rate');
        }

        return {
            ready: missing.length === 0,
            reason: missing.join(', ') || 'Missing values',
        };
    }

    function simulateStrategy(name, payload, mode) {
        const maxMonths = 600;
        const baseSummary = buildBaseSummary(payload);
        const baseCashFlow = Math.max(0, baseSummary.availableCashFlow);
        const isVelocityCard = (mode === 'velocityCard' || mode === 'velocityCombo');
        const isVelocityLoc = (mode === 'velocityLoc' || mode === 'velocityCombo');
        const isVelocity = (isVelocityCard || isVelocityLoc) && payload.velocity.enabled;
        const velocity = payload.velocity || {};
        const velocityTimingEstimated = isVelocity ? velocity.timingEstimated : false;
        const isCustomVelocity = velocity.timingMode === 'custom';
        const velocityCardApr = Number.isFinite(Number(velocity.cardApr)) ? Number(velocity.cardApr) : 29;
        const velocityCardLimit = Number(velocity.cardLimit || 0);
        const velocityLocApr = Number.isFinite(Number(velocity.creditToolApr)) ? Number(velocity.creditToolApr) : 0;
        const cardMonthlyRate = Math.max(0, velocityCardApr) / 100 / 12;
        const locMonthlyRate = Math.max(0, velocityLocApr) / 100 / 12;

        const strategy = {
            name,
            status: 'ok',
            months: 0,
            totalInterest: 0,
            totalPaidMinimum: 0,
            totalPaidExtra: 0,
            finalMonthBalance: 0,
            payoffLine: [],
            monthlyRecords: [],
        };

        const debts = payload.debts.map((debt) => ({
            ...debt,
            balance: Number(debt.balance || 0),
            apr: Math.max(0, Number(debt.apr || 0)),
            minimumPayment: Math.max(0, Number(debt.minimumPayment || 0)),
        })).filter((debt) => debt.balance > 0);

        if (!debts.length) {
            strategy.status = 'missing';
            strategy.note = 'No debt entries found.';
            return strategy;
        }

        const ccMonthlyCharge = payload.budgetPath === 'summary'
            ? asNumber(payload.velocity?.cardExpenseMonthly)
            : payload.expenses
                .filter((expense) => expense.ccEligible === 'yes' && expense.paymentMethod === 'card')
                .reduce((sum, expense) => sum + normalizeByFrequency(expense.amount, expense.frequency), 0);

        let bigRemaining = asNumber(payload.bigPurchase.targetAmount);
        let velocityCardBalance = isVelocity ? Math.max(0, asNumber(velocity.cardBalance)) : 0;
        let creditToolBalance = isVelocity ? Math.max(0, asNumber(velocity.creditToolBalance)) : 0;

        const targetDebtName = payload.velocity.targetDebt || '';
        let order = getDebtOrder(debts, mode, payload.optimizer.customOrder, targetDebtName);
        const unexpectedMap = buildUnexpectedBuckets(payload.unexpectedFunds);
        const bigMonthly = payload.bigPurchase.active ? asNumber(payload.bigPurchase.monthlyContribution) : 0;

        for (let month = 1; month <= maxMonths; month += 1) {
            const monthRecord = {
                month,
                targetDebt: order.length ? debts[order[0]].name : '',
                remaining: [],
                balances: {},
                totalBalance: 0,
                interest: 0,
                extraApplied: 0,
                minimumApplied: 0,
                minimumTotal: 0,
                minimumPaid: 0,
                minimumShortfall: 0,
                velocityWarnings: [],
                velocityCreditCardBalance: 0,
                creditToolBalance: 0,
            };

            const debtsByOrder = order
                .map((idx) => debts[idx])
                .filter((debt) => debt && debt.balance > 0);

            let monthlyCash = baseCashFlow;

            const unexpected = unexpectedMap[month] || 0;
            monthlyCash += unexpected;

            let paidToBig = 0;
            if (bigRemaining > 0 && payload.bigPurchase.active) {
                paidToBig = Math.min(monthlyCash, bigMonthly, bigRemaining);
                bigRemaining = Math.max(0, bigRemaining - paidToBig);
                monthlyCash = Math.max(0, monthlyCash - paidToBig);
            }
            monthRecord.paidToBigPurchase = paidToBig;

            debts.forEach((debt) => {
                if (debt.balance <= 0) {
                    return;
                }
                const debtMonthlyRate = (debt.apr || 0) / 12 / 100;
                const debtInterest = debt.balance * debtMonthlyRate;
                debt.balance += debtInterest;
                monthRecord.interest += debtInterest;
                strategy.totalInterest += debtInterest;
            });

            const requiredCheckingHoldback = asNumber(velocity.requiredCheckingHoldback || velocity.summaryCheckingHoldback || 0);
            const safeCash = Math.max(0, monthlyCash - requiredCheckingHoldback);

            const minimumTotal = debtsByOrder.reduce((sum, debt) => sum + Math.min(debt.balance, debt.minimumPayment), 0);
            monthRecord.minimumTotal = Number(minimumTotal.toFixed(2));

            const minimumPaid = Math.min(safeCash, minimumTotal);
            let minimumPool = minimumPaid;
            monthRecord.minimumPaid = Number(minimumPaid.toFixed(2));
            monthRecord.minimumShortfall = Number(Math.max(0, minimumTotal - minimumPaid).toFixed(2));

            debtsByOrder.forEach((debt) => {
                if (minimumPool <= 0 || debt.balance <= 0) {
                    return;
                }
                const minPay = Math.min(debt.minimumPayment, debt.balance, minimumPool);
                debt.balance -= minPay;
                minimumPool -= minPay;
                monthRecord.minimumApplied += minPay;
                strategy.totalPaidMinimum += minPay;
            });

            let extraCash = Math.max(0, safeCash - minimumPaid);
            let transferToCard = 0;
            let transferToLoc = 0;
            let cardPaidBeforeDue = false;

            if (isVelocityCard) {
                const cardLimitSpace = velocityCardLimit ? Math.max(0, velocityCardLimit - velocityCardBalance) : Number.POSITIVE_INFINITY;
                transferToCard = Math.min(extraCash, cardLimitSpace);
                velocityCardBalance += transferToCard;
                extraCash -= transferToCard;
                monthRecord.velocityCardTransfer = transferToCard;

                if (cardLimitSpace <= 0 && ccMonthlyCharge > 0) {
                    monthRecord.velocityWarnings.push('Not enough available credit for planned credit-card expenses.');
                }
            }

            if (isVelocityLoc) {
                const locMinimumPayment = Math.max(0, asNumber(velocity.creditToolMinimumPayment || 0));
                const locMinimumReserved = Math.min(extraCash, locMinimumPayment);
                if (locMinimumReserved > 0) {
                    monthRecord.velocityLocMinimumReserve = locMinimumReserved;
                    extraCash = Math.max(0, extraCash - locMinimumReserved);
                }

                transferToLoc = Math.min(extraCash, creditToolBalance);
                creditToolBalance -= transferToLoc;
                extraCash -= transferToLoc;
                monthRecord.creditToolTransfer = transferToLoc;
            }

            const cardChargeProfile = calculateMonthCardCharges(payload, month);
            if (isVelocityCard && cardChargeProfile.total > 0) {
                const chargeSpace = velocityCardLimit ? Math.max(0, velocityCardLimit - velocityCardBalance) : Number.POSITIVE_INFINITY;
                if (cardChargeProfile.total > chargeSpace) {
                    monthRecord.velocityWarnings.push('Not enough available credit for planned credit-card expenses.');
                }
                const cardCharges = Math.min(cardChargeProfile.total, chargeSpace);
                velocityCardBalance += cardCharges;
                monthRecord.velocityCardCharges = cardCharges;
                if (cardCharges < cardChargeProfile.total) {
                    monthRecord.velocityCardChargeShortfall = cardChargeProfile.total - cardCharges;
                }
            }

            const targetDebt = debtsByOrder[0];
            if (isVelocityCard) {
                const prePayBalance = velocityCardBalance;
                const payCard = targetDebt ? Math.min(velocityCardBalance, extraCash) : 0;
                velocityCardBalance -= payCard;
                extraCash -= payCard;
                strategy.totalPaidExtra += payCard;
                monthRecord.extraApplied += payCard;
                monthRecord.velocityCardPayment = payCard;

                cardPaidBeforeDue = shouldPayCardBeforeDue(velocity, prePayBalance, payCard, month);
                monthRecord.cardPaidBeforeDue = cardPaidBeforeDue;
            }

            if (velocityCardBalance > 0 && !cardPaidBeforeDue && isVelocityCard) {
                const cardInterest = velocityCardBalance * cardMonthlyRate;
                velocityCardBalance += cardInterest;
                monthRecord.interest += cardInterest;
                strategy.totalInterest += cardInterest;
                monthRecord.velocityCardInterest = cardInterest;
            }

            if (mode !== 'minimum') {
                const debtTarget = debtsByOrder[0];
                if (debtTarget && unexpected > 0 && extraCash > 0) {
                    const extraUnexpected = Math.min(debtTarget.balance, unexpected, extraCash);
                    debtTarget.balance -= extraUnexpected;
                    extraCash -= extraUnexpected;
                    strategy.totalPaidExtra += extraUnexpected;
                    monthRecord.extraApplied += extraUnexpected;
                    monthRecord.unexpectedApplied = extraUnexpected;
                }

                debtsByOrder.forEach((debt) => {
                    if (extraCash <= 0 || debt.balance <= 0) {
                        return;
                    }
                    const extraPay = Math.min(extraCash, debt.balance);
                    debt.balance -= extraPay;
                    extraCash -= extraPay;
                    strategy.totalPaidExtra += extraPay;
                    monthRecord.extraApplied += extraPay;
                });
            }

            if (isVelocityCard && isVelocityLoc && mode === 'velocityCombo') {
                monthRecord.velocityMode = 'card+loc';
            } else if (isVelocityCard) {
                monthRecord.velocityMode = 'card';
            } else if (isVelocityLoc) {
                monthRecord.velocityMode = 'loc';
            }

            if (isVelocityLoc && creditToolBalance > 0) {
                const locInterest = creditToolBalance * locMonthlyRate;
                if (locInterest > 0) {
                    creditToolBalance += locInterest;
                    monthRecord.interest += locInterest;
                    strategy.totalInterest += locInterest;
                    monthRecord.velocityLocInterest = locInterest;
                }
            }

            if (isVelocity && isVelocityCard && payload.velocity.cardAprEstimated && monthRecord.interest > 0) {
                monthRecord.velocityAprWarning = '29% is an average estimate. Please enter your actual credit card APR for more accurate results.';
            }

            if (velocityTimingEstimated) {
                monthRecord.timingEstimated = true;
            }

            let remainingTotal = 0;
            debts.forEach((debt, index) => {
                const remaining = Math.max(0, debt.balance);
                monthRecord.remaining.push({
                    name: debt.name,
                    remaining,
                });
                monthRecord.balances[index] = remaining;
                remainingTotal += remaining;
            });

            const totalDebtBalance = Number(remainingTotal.toFixed(2));
            const debtTotalPositive = totalDebtBalance > 0.01;
            const cardPositive = velocityCardBalance > 0.01;
            const locPositive = creditToolBalance > 0.01;
            const combinedBalance = totalDebtBalance + velocityCardBalance + creditToolBalance;
            monthRecord.velocityCreditCardBalance = velocityCardBalance;
            monthRecord.creditToolBalance = creditToolBalance;
            monthRecord.totalBalance = Number(combinedBalance.toFixed(2));
            monthRecord.velocityTransferToCard = transferToCard;
            monthRecord.velocityTransferToLoc = transferToLoc;
            monthRecord.debtBalance = totalDebtBalance;
            monthRecord.minimumReserved = requiredCheckingHoldback;
            strategy.payoffLine.push({
                totalRemaining: monthRecord.totalBalance,
                interest: Number(monthRecord.interest.toFixed(2)),
            });
            strategy.monthlyRecords.push(monthRecord);

            if (combinedBalance <= 0.01) {
                strategy.months = month;
                strategy.finalMonthBalance = 0;
                strategy.finalDebtBalance = 0;
                strategy.finalCardBalance = velocityCardBalance;
                strategy.finalLocBalance = creditToolBalance;
                strategy.status = 'ok';
                break;
            }

            if (month === maxMonths) {
                strategy.months = maxMonths;
                strategy.finalMonthBalance = combinedBalance;
                strategy.finalDebtBalance = totalDebtBalance;
                strategy.finalCardBalance = velocityCardBalance;
                strategy.finalLocBalance = creditToolBalance;
                strategy.status = 'incomplete';
            }
        }

        if (!strategy.months && strategy.monthlyRecords.length > 0) {
            strategy.months = strategy.monthlyRecords.length;
        }

        if (!strategy.monthlyRecords.length) {
            strategy.months = 0;
            strategy.status = 'incomplete';
            strategy.note = 'Not enough cash flow to pay debt off in simulation window.';
        }

        strategy.debtOrder = order
            .map((index) => debts[index]?.name)
            .filter(Boolean);
        if (name === 'Minimum Payments Only') {
            strategy.note = `Months to payoff: ${strategy.months || 'N/A'}; minimum payments only`;
        } else if (name === 'Infinite Banking') {
            strategy.note = `Months to payoff: ${strategy.months || 'N/A'}; IBC optional / placeholder logic only. Distinct IBC engine pending future scope.`;
        } else if (name === 'Credit Card Velocity' || name === 'LOC Velocity' || name === 'Credit Card + LOC Velocity') {
            const debtBalance = strategy.monthlyRecords.length ? strategy.monthlyRecords[strategy.monthlyRecords.length - 1].debtBalance || 0 : 0;
            const cardBalance = strategy.monthlyRecords.length ? strategy.monthlyRecords[strategy.monthlyRecords.length - 1].velocityCreditCardBalance || 0 : 0;
            const locBalance = strategy.monthlyRecords.length ? strategy.monthlyRecords[strategy.monthlyRecords.length - 1].creditToolBalance || 0 : 0;

            let debtState = '';
            if (name === 'LOC Velocity') {
                if (debtBalance > 0.01) {
                    debtState = 'Consumer debts remain.';
                } else if (locBalance > 0.01) {
                    debtState = 'Consumer debts cleared, but credit tool balance remains.';
                } else {
                    debtState = 'Debt-free.';
                }
            } else if (name === 'Credit Card Velocity' || name === 'Credit Card + LOC Velocity') {
                if (debtBalance > 0.01) {
                    debtState = 'Consumer debts remain.';
                } else if (cardBalance > 0.01) {
                    debtState = 'Consumer debts cleared, but credit card balance remains.';
                } else if (locBalance > 0.01) {
                    debtState = 'Consumer debts cleared, but credit tool balance remains.';
                } else {
                    debtState = 'Debt-free.';
                }
            }

            strategy.note = `Months to payoff: ${strategy.months || 'N/A'}; ${debtState}`;

            if (velocity && velocityTimingEstimated) {
                strategy.note += ' Velocity Banking results are estimated.';
            }

            if (isVelocityCard && velocity.cardAprEstimated) {
                strategy.note += ' 29% is an average estimate. Please enter your actual credit card APR for more accurate results.';
            }

            if (velocity.timingMode === 'generic') {
                strategy.note += ` ${VELOCITY_HELP_TEXT.velocityGenericTimingDisclaimer.body}`;
            }

            if (isCustomVelocity && isVelocityCard) {
                strategy.note += ` ${VELOCITY_HELP_TEXT.velocityCustomTimingNotice.body}`;
            }
            } else {
                strategy.note = `Months to payoff: ${strategy.months || 'N/A'}; paid with minimums and extra strategy flow`;
            }

            return strategy;
        }

    function calculateMonthCardCharges(payload, month) {
        const isCustom = payload.velocity.timingMode === 'custom';
        const maxDays = getMonthLengthForOffset(month);
        const chargeRows = payload.expenses.filter((expense) => expense.ccEligible === 'yes' && expense.paymentMethod === 'card');
        const rowBasedCharge = chargeRows.reduce((sum, expense) => sum + normalizeByFrequency(expense.amount, expense.frequency), 0);
        const summaryCardCharge = Math.max(0, asNumber(payload.velocity?.cardExpenseMonthly));
        const baseCharge = rowBasedCharge > 0 ? rowBasedCharge : summaryCardCharge;

        if (!isCustom || !chargeRows.length) {
            return {
                total: baseCharge,
                events: [
                    {
                        day: Math.min(15, maxDays),
                        amount: baseCharge,
                    },
                ],
            };
        }

        const buckets = {};
        chargeRows.forEach((expense) => {
            const target = monthDateFromTemplate(month, expense.dueDate);
            if (!target) {
                return;
            }

            const monthDay = target.getDate();
            const safeDay = Math.min(maxDays, Math.max(1, monthDay));
            buckets[safeDay] = (buckets[safeDay] || 0) + normalizeByFrequency(expense.amount, expense.frequency);
        });

        const orderedDays = Object.keys(buckets).map((day) => Number(day)).sort((a, b) => a - b);
        if (!orderedDays.length) {
            return {
                total: baseCharge,
                events: [
                    {
                        day: Math.min(15, maxDays),
                        amount: baseCharge,
                    },
                ],
            };
        }

        const total = orderedDays.reduce((sum, day) => sum + buckets[day], 0);
        const events = orderedDays.map((day) => ({
            day,
            amount: buckets[day],
        }));
        return {
            total,
            events,
        };
    }

    function shouldPayCardBeforeDue(velocity, prePayBalance, payCard, month) {
        if (!prePayBalance || prePayBalance <= 0) {
            return true;
        }
        if (payCard <= 0) {
            return false;
        }
        if (velocity.timingMode !== 'custom') {
            return payCard >= prePayBalance;
        }

        const dueDate = monthDateFromTemplate(month, velocity.cardDueDate);
        if (!dueDate) {
            return payCard >= prePayBalance;
        }

        const payoffCutoff = (() => {
            const chargeDate = monthDateFromTemplate(month, velocity.interestChargeDate);
            return chargeDate ? chargeDate : dueDate;
        })();

        const paycheckDates = (velocity.paycheckDates || [])
            .map((date) => monthDateFromTemplate(month, date))
            .filter(Boolean);

        const hasPaycheckByCutoff = paycheckDates.some((date) => date.getTime() <= payoffCutoff.getTime());
        if (!hasPaycheckByCutoff) {
            return false;
        }

        return payCard >= prePayBalance;
    }

    function monthDateFromTemplate(month, rawDate) {
        if (!rawDate) {
            return null;
        }
        const template = new Date(rawDate);
        if (Number.isNaN(template.getTime())) {
            return null;
        }
        const today = new Date();
        const target = new Date(today.getFullYear(), today.getMonth() + month - 1, 1);
        const day = Math.min(template.getDate(), getMonthLengthForOffset(month));
        target.setDate(day);
        return target;
    }

    function getMonthLengthForOffset(month) {
        const today = new Date();
        const d = new Date(today.getFullYear(), today.getMonth() + month, 0);
        return d.getDate();
    }

    function getDebtOrder(debts, mode, customOrderText, velocityTargetDebt) {
        if (!debts.length) {
            return [];
        }

        const indexes = debts.map((_, i) => i);
        if (mode === 'avalanche') {
            return [...indexes].sort((a, b) => (debts[b].apr || 0) - (debts[a].apr || 0));
        }

        if (mode === 'snowball') {
            return [...indexes].sort((a, b) => (debts[a].balance || 0) - (debts[b].balance || 0));
        }

        if (mode === 'custom') {
            const custom = customOrderText.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
            const ordered = [];
            custom.forEach((name) => {
                const find = debts.findIndex((debt) => debt.name.toLowerCase() === name);
                if (find !== -1) {
                    ordered.push(find);
                }
            });
            indexes.forEach((i) => {
                if (!ordered.includes(i)) {
                    ordered.push(i);
                }
            });
            return ordered;
        }

        if ((mode === 'velocityCard' || mode === 'velocityLoc' || mode === 'velocityCombo') && velocityTargetDebt) {
            const target = velocityTargetDebt.toLowerCase();
            const targetIndex = debts.findIndex((debt) => debt.name.toLowerCase() === target);
            if (targetIndex !== -1) {
                return [
                    targetIndex,
                    ...indexes.filter((index) => index !== targetIndex),
                ];
            }
        }

        return indexes;
    }

    function buildUnexpectedBuckets(unexpectedFunds) {
        if (!unexpectedFunds.length) {
            return {};
        }

        const map = {};
        unexpectedFunds.forEach((fund) => {
            if (!fund.date) {
                return;
            }
            const index = fundToMonthIndex(fund.date);
            map[index] = (map[index] || 0) + asNumber(fund.amount);
        });
        return map;
    }

    function fundToMonthIndex(dateInput) {
        const today = new Date();
        const target = new Date(dateInput);
        const months = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
        if (months < 0) {
            return 1;
        }
        return months + 1;
    }

    function resolveResultLabel(result, payload) {
        const mode = payload?.velocity?.timingMode || 'generic';
        const isCustom = mode === 'custom';
        switch (result.name) {
            case 'Credit Card Velocity':
                return isCustom ? 'Custom Timing Velocity Estimate' : 'Estimated Credit Card Velocity Result';
            case 'LOC Velocity':
                return 'Advanced LOC Velocity Estimate';
            case 'Credit Card + LOC Velocity':
                return `${isCustom ? 'Custom Timing Velocity Estimate' : 'Estimated Credit Card Velocity Result'} + Advanced LOC Velocity Estimate`;
            case 'LOC Velocity: N/A':
                return 'LOC Velocity: N/A';
            case 'Velocity Banking':
            case 'Velocity Banking: More information needed.':
            case 'LOC Velocity is not available':
                return cfg.strings.velocityMissing;
            default:
                return result.name || 'Result';
        }
    }

    function isVelocityStrategy(result) {
        return typeof result?.name === 'string'
            && (result.name.includes('Velocity') || result.name === 'Credit Card + LOC Velocity');
    }

    function getVelocityRecommendationText(result, payload) {
        if (!isVelocityStrategy(result)) {
            return result?.note || 'Recommended by faster payoff and lower interest profile.';
        }

        const mode = payload?.velocity?.timingMode || 'generic';
        if (mode === 'custom') {
            return 'Velocity Banking is recommended using your entered timing details, but full date-by-date simulation is still pending.';
        }

        return 'Velocity Banking is recommended based on estimated timing. For a more accurate result, complete the Custom Timing fields and verify in Money Steps.';
    }

    function renderResults(results, payload) {
        fieldNodes.resultContainer.classList.remove('ecf-empty');
        fieldNodes.resultGrid.innerHTML = '';
        fieldNodes.recommendation.innerHTML = '';

        if (!results || !results.strategies.length) {
            fieldNodes.resultGrid.innerHTML = '<p>No comparison output.</p>';
            return;
        }

        const recommended = results.recommended;
        fieldNodes.recommendation.innerHTML = `
            <h3>Recommended strategy: ${recommended ? resolveResultLabel(recommended, payload) : 'No complete strategy computed'}</h3>
            <p>${recommended ? getVelocityRecommendationText(recommended, payload) : ''}</p>
            <p>Available cash flow: $${payload.summary.availableCashFlow.toFixed(2)}</p>
        `;

        const table = document.createElement('table');
        table.className = 'ecf-result-table';
        table.setAttribute('data-testid', 'ecf-result-table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Strategy</th>
                    <th>Months</th>
                    <th>Total interest</th>
                    <th>Payoff status</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${results.strategies.map((item) => `
                    <tr>
                        <td>${resolveResultLabel(item, payload)}</td>
                        <td>${item.months || 'N/A'}</td>
                        <td>${item.totalInterest ? `$${Number(item.totalInterest).toFixed(2)}` : 'N/A'}</td>
                        <td>${item.status}</td>
                        <td>${item.note || item.errorMessage || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        fieldNodes.resultGrid.appendChild(table);

        const chartContainer = $('#ecf-balance-chart');
        const ratioContainer = $('#ecf-ratio-chart');
        if (chartContainer && recommended && recommended.monthlyRecords) {
            renderBalanceBars(chartContainer, recommended.monthlyRecords);
        }
        if (ratioContainer && payload.summary.totalIncome > 0) {
            ratioContainer.innerHTML = `
                <p>Income: ${money(results.summary.totalIncome)} / Expenses: ${money(results.summary.totalExpenses)} / Savings: ${money(results.summary.normalSavings)}</p>
                <p>Income vs expense ratio: ${Number(results.summary.totalIncome / Math.max(results.summary.totalExpenses, 1)).toFixed(2)}</p>
            `;
        }

        configureSaveButton();
    }

    function renderBalanceBars(container, records) {
        const maxValue = Math.max(...records.map((record) => record.totalRemaining || 0), 1);
        const bars = records.slice(0, 24).map((record) => {
            const width = (1 - ((record.totalRemaining || 0) / maxValue)) * 100;
            return `<div style="margin: 8px 0;">
                <div style="display:flex; justify-content:space-between; font-size: .86rem;">
                    <span>M${record.month}</span>
                    <span>${money(record.totalRemaining || 0)}</span>
                </div>
                <div style="height: 10px; border-radius: 999px; background: #101a2d; overflow:hidden;">
                    <div style="height: 100%; width:${Math.max(2, width)}%; background: linear-gradient(90deg, #5f40ea, #9f86ff);"></div>
                </div>
            </div>`;
        });
        container.innerHTML = bars.join('');
    }

    function money(amount) {
        return `${cfg.currencySymbol || '$'}${Number(amount || 0).toFixed(2)}`;
    }

    function renderMoneySteps() {
        if (!cfg.canUseMoneySteps) {
            fieldNodes.moneyStepsWrapper.innerHTML = '<p>Create a free account to use Money Steps.</p>';
            return;
        }

        if (!state.lastResult || !state.lastResult.recommended || !state.lastResult.recommended.monthlyRecords?.length) {
            fieldNodes.moneyStepsBody.innerHTML = '';
            return;
        }

        const result = state.lastResult.recommended;
        const payload = planResultState.payload;
        const frequency = fieldNodes.moneyFrequency.value;
        const perMonth = frequency === 'weekly' ? 4.33 : frequency === 'biweekly' ? 2 : 1;
        const periods = Math.max(1, Math.ceil((result.months || 1) * perMonth));
        const startDate = new Date();
        const rows = [];

        const monthlyIncome = payload.totalIncome;
        const monthlyExpenses = payload.totalExpenses;
        const normalSavings = payload.normalSavings;
        const bigMonthly = payload.bigPurchase.active ? payload.bigPurchase.monthlyContribution : 0;
        const minPerMonth = result.payoffLine[0]
            ? (payload.totalMinimum || 0)
            : 0;

        let periodStart = new Date(startDate);
        let startingCash = 0;

        for (let i = 1; i <= periods; i += 1) {
            const periodDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
            const periodEnd = new Date(periodStart);
            periodEnd.setDate(periodEnd.getDate() + periodDays - 1);
            const monthRecord = result.monthlyRecords[Math.min(result.monthlyRecords.length - 1, Math.floor((i - 1) / perMonth))];
            const totalRemaining = monthRecord ? monthRecord.totalRemaining : 0;
            const ending = startingCash + (monthlyIncome / perMonth) - (monthlyExpenses / perMonth) - (normalSavings / perMonth) - (bigMonthly / perMonth);

            rows.push(`
                <tr>
                    <td>${i}</td>
                    <td>${formatDate(periodStart)}</td>
                    <td>${formatDate(periodEnd)}</td>
                    <td>${money(startingCash)}</td>
                    <td>${money(monthlyIncome / perMonth)}</td>
                    <td>${money(monthlyExpenses / perMonth)}</td>
                    <td>${money(normalSavings / perMonth)}</td>
                    <td>${money(bigMonthly / perMonth)}</td>
                    <td>${money(minPerMonth / perMonth)}</td>
                    <td>${money(Math.max(0, payload.summary?.afterBigPurchase || 0) / perMonth)}</td>
                    <td>${money(0)}</td>
                    <td>${money(0)}</td>
                    <td>${money(0)}</td>
                    <td>${money(ending)}</td>
                    <td>${result.debtOrder?.[0] || 'N/A'}</td>
                    <td>${money(totalRemaining)}</td>
                    <td>${money(payload.velocity.enabled ? payload.velocity.cardApr : 0)}</td>
                    <td>${money(0)}</td>
                    <td>${money(payload.bigPurchase.active ? Math.max(0, payload.bigPurchase.targetAmount) : 0)}</td>
                </tr>
            `);
            startingCash = ending;
            periodStart = new Date(periodEnd);
            periodStart.setDate(periodStart.getDate() + 1);
        }

        state.lastMoneySteps = rows;
        fieldNodes.moneyStepsBody.innerHTML = rows.join('');
    }

    function formatDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function configureSaveButton() {
        if (!cfg.isLoggedIn) {
            fieldNodes.saveBtn.disabled = true;
            fieldNodes.saveMessage.textContent = cfg.strings.loginHint;
            return;
        }

        fieldNodes.saveBtn.disabled = false;
        if (state.lastResult) {
            fieldNodes.saveMessage.textContent = 'Plan is ready to save.';
        } else {
            fieldNodes.saveMessage.textContent = 'Run the optimizer, then save your plan.';
        }
    }

    function savePlan() {
        if (!cfg.isLoggedIn) {
            return;
        }

        const payload = planResultState.payload || gatherPayload();
        const moneySteps = {
            currency: cfg.currencySymbol || '$',
            rows: state.lastMoneySteps,
        };

        const planId = parseInt(root.dataset.prefillPlanId || '0', 10) || 0;
        const formData = new FormData();
        formData.append('action', 'everlum_cf_save_plan');
        formData.append('nonce', cfg.nonce || '');
        formData.append('payload', JSON.stringify(payload));
        formData.append('money_steps', JSON.stringify(moneySteps));
        formData.append('title', fieldNodes.planTitle.value || 'My Cash Flow Plan');
        formData.append('status', 'draft');
        if (planId) {
            formData.append('plan_id', String(planId));
        }

        fieldNodes.saveBtn.disabled = true;
        fetch(cfg.ajaxUrl, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
        }).then((response) => response.json())
            .then((response) => {
                if (!response || !response.success) {
                    throw new Error(response?.data?.message || 'Plan not saved.');
                }
                root.dataset.prefillPlanId = String(response.data.plan_id);
                trackClarityEvent('plan_saved');
                fieldNodes.saveMessage.textContent = 'Plan saved.';
            })
            .catch((error) => {
                fieldNodes.saveMessage.textContent = error.message;
            })
            .finally(() => {
                if (cfg.isLoggedIn) {
                    fieldNodes.saveBtn.disabled = false;
                }
            });
    }

    function bindAuthHandlers() {
        bindAuthForm(fieldNodes.signupForm, 'everlum_cf_signup', 'signup');
        bindAuthForm(fieldNodes.loginForm, 'everlum_cf_login', 'login');
        bindAuthForm(fieldNodes.forgotForm, 'everlum_cf_forgot', 'forgot');
    }

    function bindPrereg() {
        bindAuthForm(fieldNodes.preregForm, 'everlum_cf_save_prereg', 'prereg');
    }

    function getAuthReturnSourceFromStep(index) {
        if (index === 4) {
            return 'save';
        }

        if (index === 5) {
            return 'moneysteps';
        }

        if (index === 3) {
            return 'results';
        }

        return 'calculator';
    }

    function normalizeAuthReturnValue(value) {
        return asText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function setAuthReturnContext(rawSource) {
        const source = normalizeAuthReturnValue(rawSource);
        if (!source) {
            return;
        }

        root.dataset.authReturnSource = source;

        const params = new URLSearchParams(window.location.search);
        params.set('ecf_auth_return', source);
        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({ path: nextUrl }, '', nextUrl);
    }

    function getAuthReturnStep() {
        const searchParams = new URLSearchParams(window.location.search);
        const rawSource = searchParams.get('ecf_auth_return') || root.dataset.authReturnSource || '';
        const normalized = normalizeAuthReturnValue(rawSource);

        const sourceMap = {
            saveplan: 4,
            save: 4,
            moneysteps: 5,
            money: 5,
            result: 3,
            results: 3,
            progress: 3,
            calculator: 3,
            calc: 3,
        };

        if (Object.prototype.hasOwnProperty.call(sourceMap, normalized)) {
            return sourceMap[normalized];
        }

        const stepMatch = normalized.match(/\d+/);
        if (stepMatch) {
            const value = Number.parseInt(stepMatch[0], 10);
            if (!Number.isNaN(value) && value >= 0 && value <= 5) {
                return value;
            }
        }

        if (state.currentStep === 4) {
            return 4;
        }

        if (state.currentStep === 5) {
            return 5;
        }

        if (state.currentStep >= 3) {
            return 3;
        }

        return state.currentStep;
    }

    function bindAuthForm(form, action, key) {
        if (!form) {
            return;
        }
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            setAuthReturnContext(root.dataset.authReturnSource || getAuthReturnSourceFromStep(state.currentStep));
            const data = new FormData(form);
            const messageNode = $(`.ecf-form-message[data-form="${key}"]`, root);
            const token = form.querySelector('[name="cf-turnstile-response"]')?.value || '';

            if (cfg.turnstileSiteKey && !token) {
                if (messageNode) {
                    messageNode.textContent = 'Please complete the security check.';
                }
                return;
            }

            data.append('action', action);
            data.append('nonce', cfg.nonce || '');
            data.append('cf-turnstile-response', token || '');

            messageNode.textContent = 'Submitting...';
            fetch(cfg.ajaxUrl, {
                method: 'POST',
                body: data,
                credentials: 'same-origin',
            }).then((response) => response.json())
                .then((result) => {
                    if (!result || !result.success) {
                        throw new Error(result?.data?.message || 'Request failed.');
                    }
                    messageNode.textContent = result.data.message || 'Done.';
                    if (action === 'everlum_cf_login' || action === 'everlum_cf_signup') {
                        trackClarityEvent(action === 'everlum_cf_login' ? 'login_signin' : 'account_created');
                        cfg.isLoggedIn = true;
                        cfg.userId = Number(result.data.user_id || cfg.userId || 0);
                        if (Object.prototype.hasOwnProperty.call(result.data, 'can_use_money_steps')) {
                            cfg.canUseMoneySteps = Boolean(result.data.can_use_money_steps);
                        }
                        if (result.data.nonce) {
                            cfg.nonce = result.data.nonce;
                        }
                        configureSaveButton();
                        goToStep(getAuthReturnStep());
                    } else {
                        const explicitEvent = form.getAttribute('data-clarity-event') || (action === 'everlum_cf_save_prereg' ? 'prereg_submitted' : null);
                        if (explicitEvent) {
                            trackClarityEvent(explicitEvent);
                        }
                    }
                })
                .catch((error) => {
                    messageNode.textContent = error.message;
                });
        });
    }

    function autosaveDraft() {
        if (cfg.isLoggedIn) {
            return;
        }
        const payload = gatherPayload();
        const text = JSON.stringify(payload);
        try {
            localStorage.setItem(STORAGE_KEY, text);
        } catch (error) {
            // Ignore storage errors
        }
    }

    function loadDraft() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return;
        }

        try {
            const parsed = JSON.parse(stored);
            if (!parsed || typeof parsed !== 'object') {
                return;
            }
            hydrateFromPayload(parsed);
        } catch (error) {
            // ignore invalid draft JSON
        }
    }

    function loadFromServerPrefill() {
        const scriptData = prefillScript ? prefillScript.textContent.trim() : '';
        if (!scriptData) {
            return;
        }

        try {
            const raw = JSON.parse(scriptData);
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed && typeof parsed === 'object') {
                hydrateFromPayload(parsed);
            }
        } catch (error) {
            // Ignore invalid prefill json
        }
    }

    function hydrateFromPayload(data) {
        if (!data) {
            return;
        }
        if (data.budgetPath === 'itemized') {
            const btn = $('.ecf-path-btn[data-path="itemized"]', root);
            if (btn) {
                btn.click();
            }
            containers.incomeSources.innerHTML = '';
            containers.expenseList.innerHTML = '';
            (data.incomeSources || []).forEach((item) => addIncomeRow(item));
            (data.expenses || []).forEach((expense) => addExpenseRow(expense));
        } else {
            fieldNodes.summaryIncome.value = data.pathSummary?.income || '';
            fieldNodes.summaryExpenses.value = data.pathSummary?.expenses || '';
            fieldNodes.summarySavings.value = data.pathSummary?.savings || '';
        }

        fieldNodes.bigGoalName.value = data.bigPurchase?.name || '';
        fieldNodes.bigGoalAmount.value = data.bigPurchase?.targetAmount || '';
        fieldNodes.bigGoalDateType.value = data.bigPurchase?.dateType || 'open';
        fieldNodes.bigGoalDate.value = data.bigPurchase?.targetDate || '';
        fieldNodes.bigGoalContributionType.value = data.bigPurchase?.contributionType || 'fixed';
        fieldNodes.bigGoalContributionAmount.value = data.bigPurchase?.contributionAmount || '';
        fieldNodes.bigGoalFrequency.value = data.bigPurchase?.contributionFrequency || 'monthly';
        fieldNodes.customOrder.value = data.optimizer?.customOrder || '';
        $('[name="strategyAvalanche"]', root).checked = !!data.optimizer?.avalanche;
        $('[name="strategySnowball"]', root).checked = !!data.optimizer?.snowball;
        $('[name="strategyCustom"]', root).checked = !!data.optimizer?.custom;
        $('[name="strategyInfinite"]', root).checked = !!data.optimizer?.infinite;
        containers.unexpectedList.innerHTML = '';
        (data.unexpectedFunds || []).forEach((item) => addUnexpectedRow(item));

        fieldNodes.minimumsInExpenses.checked = !!data.minimumsInExpenses;
        containers.debtList.innerHTML = '';
        (data.debts || []).forEach((debt) => addDebtRow(debt));

        const timingMode = data.velocity?.timingMode || 'generic';
        const timingRadio = [...fieldNodes.velocityTimingMode].find((radio) => radio.value === timingMode);
        if (timingRadio) {
            timingRadio.checked = true;
        }
        fieldNodes.velocityPayTiming.value = data.velocity?.payTiming || 'monthly';
        if (fieldNodes.velocityPaycheckDates) {
            fieldNodes.velocityPaycheckDates.value = (data.velocity?.paycheckDates || []).join(', ');
        }
        fieldNodes.velocityCardApr.value = data.velocity?.cardApr || '';
        fieldNodes.velocityStatementDate.value = data.velocity?.statementDate || '';
        fieldNodes.velocityCardDueDate.value = data.velocity?.cardDueDate || '';
        fieldNodes.velocityInterestChargeDate.value = data.velocity?.interestChargeDate || '';
        if (fieldNodes.velocityCurrentPaymentMethod) {
            fieldNodes.velocityCurrentPaymentMethod.value = data.velocity?.currentPaymentMethod || 'cash';
        }
        fieldNodes.velocitySummaryCheckingHoldback.value = data.velocity?.summaryCheckingHoldback || '';
        if (fieldNodes.velocityCreditToolType) {
            const creditToolType = asText(data.velocity?.creditToolType || 'none');
            const creditToolRadio = [...fieldNodes.velocityCreditToolType.options].find((option) => option.value === creditToolType);
            if (creditToolRadio) {
                fieldNodes.velocityCreditToolType.value = creditToolType;
            }
        }
        fieldNodes.velocityCreditToolApr.value = data.velocity?.creditToolApr || '';
        fieldNodes.velocityCreditToolLimit.value = data.velocity?.creditToolLimit || '';
        fieldNodes.velocityCreditToolMinimumPayment.value = data.velocity?.creditToolMinimumPayment || '';
        fieldNodes.velocityCardBalance.value = data.velocity?.cardBalance || '';
        fieldNodes.velocityCardLimit.value = data.velocity?.cardLimit || '';
        fieldNodes.velocityCreditToolBalance.value = data.velocity?.creditToolBalance || '';
        if (fieldNodes.velocityCreditToolDueDate) {
            fieldNodes.velocityCreditToolDueDate.value = data.velocity?.creditToolDueDate || '';
        }
        fieldNodes.velocityChunkTiming.value = data.velocity?.chunkTiming || 'monthEnd';
        fieldNodes.velocityTargetDebt.value = data.velocity?.targetDebt || '';

        if (data.infiniteBanking) {
            fieldNodes.ibcPremium.value = data.infiniteBanking.monthlyPremium || '';
            fieldNodes.ibcCashValue.value = data.infiniteBanking.cashValue || '';
            fieldNodes.ibcLoanRate.value = data.infiniteBanking.loanRate || '';
            fieldNodes.ibcGrowthRate.value = data.infiniteBanking.growthRate || '';
            fieldNodes.ibcMaxLtv.value = data.infiniteBanking.maxLtv || '';
            fieldNodes.ibcRepayment.value = data.infiniteBanking.monthlyRepayment || '';
            fieldNodes.ibcLoanAmount.value = data.infiniteBanking.loanAmount || '';
        }
    }
})();
