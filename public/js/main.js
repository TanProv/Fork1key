document.addEventListener('DOMContentLoaded', () => {
    // State & Data
    let currentLang = localStorage.getItem('lang') || 'vi';
    let apiKey = localStorage.getItem('apiKey') || '';
    let currentKeyInfo = null;
    let isLightMode = false;
    const V2_BASE = 'https://sheeridbot.com/api/v2';

    // UI Elements
    const themeToggle = document.getElementById('themeToggle');
    const textarea = document.getElementById('verificationInput');
    const statsEntered = document.getElementById('lineCount');
    const statsAvailable = document.getElementById('slotsEmpty');
    const startBtn = document.getElementById('startBtn');
    const apiKeyBtn = document.getElementById('apiKeyBtn');

    // Check localStorage for theme preference
    if (localStorage.getItem('theme') === 'light') {
        isLightMode = true;
        applyTheme(true);
    }

    themeToggle.addEventListener('click', () => {
        isLightMode = !isLightMode;
        applyTheme(isLightMode);
        localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
    });

    function applyTheme(light) {
        if (light) {
            document.documentElement.style.setProperty('--bg-dark', '#f8fafc');
            document.documentElement.style.setProperty('--card-bg', '#ffffff');
            document.documentElement.style.setProperty('--text-primary', '#0f172a');
            document.documentElement.style.setProperty('--text-secondary', '#64748b');
            document.documentElement.style.setProperty('--card-border', '#e2e8f0');
        } else {
            document.documentElement.style.setProperty('--bg-dark', '#0f172a');
            document.documentElement.style.setProperty('--card-bg', '#111e36');
            document.documentElement.style.setProperty('--text-primary', '#e2e8f0');
            document.documentElement.style.setProperty('--text-secondary', '#94a3b8');
            document.documentElement.style.setProperty('--card-border', '#1e293b');
        }
        updateTranslations(); // Refreshes button text
    }

    // Language i18n
    const translations = {
        vi: {
            theme_light: 'Chế độ sáng',
            theme_dark: 'Chế độ tối',
            header_desc: 'Xác minh SheerID hàng loạt siêu tốc',
            btn_guide: 'Hướng dẫn xác minh',
            guide_warn: '⚠️ Phải đọc trước khi thực hiện',
            stats_label: 'Hoạt động gần đây (10 phút)',
            success: 'thành công',
            fail: 'thất bại',
            checking: 'Đang kiểm tra...',
            ready: 'Sẵn sàng',
            m_status: 'Bảo trì',
            input_title: 'Nhập Dữ Liệu',
            input_hint: 'Dán trực tiếp URL - hệ thống sẽ tự động trích xuất ID xác minh',
            btn_api_key: 'Đặt API Key',
            btn_api_key_set: 'Đã có API Key',
            balance: 'Số dư:',
            lines_entered: 'dòng đã nhập',
            slots_empty: 'slot trống',
            btn_start: 'Bắt Đầu Xác Minh',
            results_title: 'Kết Quả',
            btn_clear: 'Xóa',
            btn_export: 'Xuất file',
            completed: 'hoàn tất',
            no_results: 'Chưa có kết quả',
            empty_hint: 'Nhập ID xác minh và bấm Bắt đầu',
            pricing_title: 'Bảng Giá Key Xác Minh',
            pricing_desc: 'Chọn gói phù hợp để nâng cấp tài khoản của bạn ngay hôm nay',
            tier_personal: 'Gói Cá Nhân',
            p_1key: '1 Key xác minh',
            p_instant: 'Hiệu lực ngay lập tức',
            p_support: 'Hỗ trợ 24/7',
            buy_tg: 'Mua Key qua Telegram: @leo_dfx',
            buy_discord: 'Mua Key qua Discord',
            faq_title: 'Câu hỏi thường gặp (FAQ)',
            faq_warn: 'Nếu tác vụ thất bại, vui lòng lấy liên kết mới. Không nên gửi lại cùng một liên kết nhiều lần.',
            faq_1_q: 'Lấy lại liên kết mới',
            faq_1_a: 'Tắt VPN, Truy cập lại trang ưu đãi dành cho sinh viên để bắt đầu lại quy trình xác thực.',
            faq_2_q: 'Sao chép đúng cách',
            faq_2_a: 'Khi nút hoặc liên kết xác thực hiện ra, hãy nhấp chuột phải và chọn "Sao chép địa chỉ liên kết" (Copy link address). Tuyệt đối không nhấp chuột trái để tránh làm kích hoạt mã token một lần.',
            faq_3_q: 'API Key lấy ở đâu?',
            faq_3_a: 'Vui lòng liên hệ Admin để nhận mã API Key hợp lệ cho việc sử dụng công cụ xác minh này.',
            m_title: 'Hệ thống đang bảo trì',
            m_desc: 'API SheerID hiện đang tạm ngưng để cập nhật hoặc bảo trì định kỳ. Hệ thống sẽ tự động mở lại khi dịch vụ sẵn sàng.',
            pending: 'Đang chờ...',
            reserved: 'Đang giữ:',
            used: 'Đã dùng:',
            mode: 'Chế độ:',
            history_title: 'Lịch Sử Xác Minh',
            btn_refresh: 'Làm mới',
            history_empty: 'Chưa có lịch sử hoặc chưa nhập API Key',
            modal_key_desc: 'Nhập mã API Key (bắt đầu bằng uak_) để sử dụng dịch vụ.',
            btn_save: 'Lưu lại',
            err_unauthorized: 'Key không hợp lệ',
            err_maintenance: 'Key không hợp lệ',
            err_unknown: 'Lỗi kết nối API. Vui lòng thử lại sau.'
        },
        en: {
            theme_light: 'Light Mode',
            theme_dark: 'Dark Mode',
            header_desc: 'Lightning Fast SheerID Batch Verifier',
            btn_guide: 'Verification Guide',
            guide_warn: '⚠️ Must read before proceeding',
            stats_label: 'Recent activity (10 mins)',
            success: 'success',
            fail: 'failed',
            checking: 'Checking...',
            ready: 'Ready',
            m_status: 'Maintenance',
            input_title: 'Input Data',
            input_hint: 'Paste URL directly - system extracts verification ID automatically',
            btn_api_key: 'Set API Key',
            btn_api_key_set: 'API Key Set',
            balance: 'Balance:',
            lines_entered: 'lines entered',
            slots_empty: 'slots available',
            btn_start: 'Start Verification',
            results_title: 'Results',
            btn_clear: 'Clear',
            btn_export: 'Export',
            completed: 'completed',
            no_results: 'No results yet',
            empty_hint: 'Enter Verification ID and click Start',
            pricing_title: 'Verification Key Pricing',
            pricing_desc: 'Choose a package to upgrade your account today',
            tier_personal: 'Personal Tier',
            p_1key: '1 Verification Key',
            p_instant: 'Instant activation',
            p_support: '24/7 Support',
            buy_tg: 'Buy Key via Telegram: @leo_dfx',
            buy_discord: 'Buy Key via Discord',
            faq_title: 'Frequently Asked Questions (FAQ)',
            faq_warn: 'If a task fails, please get a new link. Do not resubmit the same link multiple times.',
            faq_1_q: 'Get a new link',
            faq_1_a: 'Turn off VPN, re-access the student offer page to restart the verification process.',
            faq_2_q: 'Copying correctly',
            faq_2_a: 'When the button or link appears, right-click and select "Copy link address". Do not left-click to avoid triggering one-time tokens.',
            faq_3_q: 'Where to get API Key?',
            faq_3_a: 'Please contact Admin to receive a valid API Key for using this verification tool.',
            m_title: 'System Maintenance',
            m_desc: 'The SheerID API is currently suspended for updates or regular maintenance. The system will unlock once the service is ready.',
            pending: 'Pending...',
            reserved: 'Reserved:',
            used: 'Used:',
            mode: 'Mode:',
            history_title: 'Verification History',
            btn_refresh: 'Refresh',
            history_empty: 'No history or API Key not set',
            modal_key_desc: 'Enter API Key (starting with uak_) to use the service.',
            btn_save: 'Save Changes',
            btn_cancel: 'Cancel',
            placeholder: `...`,
            err_unauthorized: 'Invalid Key',
            err_maintenance: 'Invalid Key',
            err_unknown: 'API connection error. Please try again later.'
        }
    };


    function updateTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key === 'theme_light' || key === 'theme_dark') {
                const icon = isLightMode ? '<i class="fas fa-moon"></i> ' : '<i class="fas fa-sun"></i> ';
                el.innerHTML = icon + translations[currentLang][isLightMode ? 'theme_dark' : 'theme_light'];
            } else if (translations[currentLang][key]) {
                el.innerHTML = translations[currentLang][key];
            }
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (translations[currentLang][key]) {
                el.placeholder = translations[currentLang][key];
            }
        });

        // API Key button special handling
        const apiKeyBtnEl = document.getElementById('apiKeyBtn');
        if (apiKeyBtnEl) {
            if (apiKey) {
                apiKeyBtnEl.innerHTML = `<i class="fas fa-check"></i> ${translations[currentLang].btn_api_key_set}`;
            } else {
                apiKeyBtnEl.innerHTML = `<i class="fas fa-key"></i> ${translations[currentLang].btn_api_key}`;
            }
        }
    }

    // Initialize Language Switcher Buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            setLanguage(lang);
        });
    });

    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);

        // Update Active Class
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
        });

        updateTranslations();
    }

    // Initial translation call
    setLanguage(currentLang);


    if (apiKey) {
        apiKeyBtn.classList.add('set');
        refreshQuota(); // Load quota immediately
    }


    // Quota Refresh Function
    async function refreshQuota() {
        if (!apiKey) {
            document.getElementById('quotaDisplay').style.display = 'none';
            return;
        }

        try {
            const res = await fetch(`${V2_BASE}/key/info`, {
                headers: { 'X-API-Key': apiKey }
            });

            if (res.ok) {
                const data = await res.json();
                currentKeyInfo = data; // Store for verification logic

                document.getElementById('quotaRemaining').textContent = data.available_credits.toLocaleString();
                document.getElementById('quotaReserved').textContent = data.reserved_credits.toLocaleString();
                document.getElementById('quotaUsed').textContent = data.used_credits.toLocaleString();

                const modeText = data.multi_processing ? `Multi (${data.max_concurrent})` : `Seq (${data.cooldown_seconds}s)`;
                document.getElementById('pmodeDisplay').textContent = modeText;

                document.getElementById('keyNameDisplay').textContent = data.key_name || 'Active Key';
                const typeBadge = document.getElementById('keyTypeBadge');
                if (typeBadge) {
                    typeBadge.textContent = data.key_type.replace('_', '-');
                }

                document.getElementById('quotaDisplay').style.display = 'flex';
                // Hide error if shown
                const errBox = document.getElementById('apiErrorBox');
                if (errBox) errBox.style.display = 'none';

                const remaining = data.available_credits;
                const quotaElem = document.getElementById('quotaRemaining');
                quotaElem.style.color = remaining < 1 ? '#ef4444' : (remaining < 5 ? '#f59e0b' : '#22c55e');

                // If info ok, also fetch history
                fetchHistory();
            } else {
                handleApiError(res.status);
            }
        } catch (e) {
            console.error('Quota fetch error:', e);
            handleApiError(0);
        }
    }

    function handleApiError(status) {
        const quotaDisplay = document.getElementById('quotaDisplay');
        const errBox = document.getElementById('apiErrorBox');
        if (!errBox) return;

        quotaDisplay.style.display = 'none';
        errBox.style.display = 'flex';
        currentKeyInfo = null;

        let msgKey = 'err_unknown';
        if (status === 401) msgKey = 'err_unauthorized';
        if (status === 503) msgKey = 'err_maintenance';

        errBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${translations[currentLang][msgKey]}</span>`;
    }


    async function fetchHistory() {
        if (!apiKey) return;
        const historyContainer = document.getElementById('historyList');
        if (!historyContainer) return;

        try {
            const res = await fetch(`${V2_BASE}/key/history`, {
                headers: { 'X-API-Key': apiKey }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.history && data.history.length > 0) {
                    historyContainer.innerHTML = data.history.map(item => {
                        const date = new Date(item.created_at).toLocaleString();
                        const statusClass = item.status === 'success' ? 'success' : 'fail';
                        const icon = item.status === 'success' ? 'fa-check-circle' : 'fa-times-circle';
                        return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid var(--card-border); font-size: 13px;">
                            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 15px;">
                                <div style="font-weight: 500; color: var(--text-primary); cursor: pointer;" title="${item.url}" onclick="navigator.clipboard.writeText('${item.url}')">${item.url}</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">${date}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">${item.credits_cost} <i class="fas fa-coins" style="font-size: 9px;"></i></span>
                                <span class="badge ${statusClass}" style="min-width: 80px; text-align: center; border-radius: 4px; padding: 3px 8px; background: ${item.status === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${item.status === 'success' ? '#22c55e' : '#ef4444'};">
                                    <i class="fas ${icon}"></i> ${item.status}
                                </span>
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    historyContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-secondary);"><p data-i18n="history_empty">Chưa có lịch sử</p></div>`;
                }
            }
        } catch (e) {
            console.error('History fetch error:', e);
        }
    }

    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', () => {
            refreshHistoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            fetchHistory().finally(() => {
                refreshHistoryBtn.innerHTML = `<i class="fas fa-sync-alt"></i> <span data-i18n="btn_refresh">${translations[currentLang].btn_refresh}</span>`;
            });
        });
    }

    // Poll quota every 10 seconds
    setInterval(refreshQuota, 10000);

    // Modal logic
    const apiKeyModal = document.getElementById('apiKeyModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const cancelKeyBtn = document.getElementById('cancelKeyBtn');
    const closeKeyModal = document.getElementById('closeKeyModal');

    apiKeyBtn.addEventListener('click', () => {
        console.log('Opening API Key Modal');
        apiKeyInput.value = apiKey;
        apiKeyModal.style.display = 'flex';
        apiKeyInput.focus();
    });

    const closeModal = () => {
        apiKeyModal.style.display = 'none';
    };

    cancelKeyBtn.addEventListener('click', closeModal);
    closeKeyModal.addEventListener('click', closeModal);
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) closeModal();
    });

    saveKeyBtn.addEventListener('click', () => {
        const input = apiKeyInput.value.trim();
        apiKey = input;
        localStorage.setItem('apiKey', apiKey);

        if (apiKey) {
            apiKeyBtn.classList.add('set');
            refreshQuota();
        } else {
            apiKeyBtn.classList.remove('set');
            if (document.getElementById('quotaDisplay')) {
                document.getElementById('quotaDisplay').style.display = 'none';
            }
        }
        updateTranslations();
        closeModal();
    });

    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveKeyBtn.click();
    });

    textarea.addEventListener('input', () => {
        updateStats();
    });

    // Initialize stats
    updateStats();

    function updateStats() {
        const text = textarea.value.trim();
        const lines = text ? text.split('\n').filter(line => line.trim()).length : 0;

        if (statsEntered) statsEntered.textContent = lines;
        if (statsAvailable) statsAvailable.textContent = 1000 - lines;
    }

    // UI elements for results
    const resultsBody = document.getElementById('resultsBody');
    const clearBtn = document.getElementById('clearResultsBtn');
    const exportBtn = document.getElementById('exportResultsBtn');
    const progressSection = document.getElementById('resultsProgress');
    const emptyState = document.getElementById('emptyState');
    const resultsList = document.getElementById('resultsList');

    // Stats tracking
    let verificationStats = { success: 0, failed: 0, total: 0, completed: 0 };
    let resultItems = {}; // Track items by ID

    // Clear Results
    clearBtn.addEventListener('click', () => {
        progressSection.style.display = 'none';
        emptyState.style.display = 'flex';
        resultsList.innerHTML = '';
        verificationStats = { success: 0, failed: 0, total: 0, completed: 0 };
        resultItems = {};
        updateStatsUI();
    });

    function updateStatsUI() {
        document.getElementById('statSuccess').textContent = verificationStats.success;
        document.getElementById('statFailed').textContent = verificationStats.failed;
        document.getElementById('statTotal').textContent = verificationStats.total;
        document.getElementById('progressText').textContent = `${verificationStats.completed} / ${verificationStats.total} ${translations[currentLang].completed}`;
    }

    function createResultItem(id, status = 'pending') {
        const shortId = id.length > 20 ? id.substring(0, 20) + '...' : id;
        const div = document.createElement('div');
        div.id = `result-${id}`;
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; margin-bottom: 8px;';
        div.innerHTML = `
            <div>
                <div style="font-weight: 500; color: var(--text-primary);">${shortId}</div>
                <div id="status-${id}" style="font-size: 12px; color: var(--text-secondary);">Waiting...</div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span id="badge-${id}" style="background: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 6px 12px; border-radius: 6px; font-size: 12px;">
                    <i class="fas fa-clock"></i> pending
                </span>
            </div>
        `;
        resultItems[id] = { element: div, status: 'pending' };
        return div;
    }

    function updateResultItem(id, status, message) {
        const statusEl = document.getElementById(`status-${id}`);
        const badgeEl = document.getElementById(`badge-${id}`);

        if (!statusEl || !badgeEl) return;

        statusEl.textContent = message || status;

        if (status === 'success') {
            badgeEl.style.background = 'rgba(34, 197, 94, 0.2)';
            badgeEl.style.color = '#22c55e';
            badgeEl.innerHTML = '<i class="fas fa-check"></i> success';
            if (resultItems[id]?.status !== 'success') {
                verificationStats.success++;
                verificationStats.completed++;
                resultItems[id].status = 'success';
            }
        } else if (status === 'failed' || status === 'error') {
            badgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
            badgeEl.style.color = '#ef4444';
            badgeEl.innerHTML = '<i class="fas fa-times"></i> failed';
            if (resultItems[id]?.status !== 'failed') {
                verificationStats.failed++;
                verificationStats.completed++;
                resultItems[id].status = 'failed';
            }
        } else if (status === 'processing') {
            badgeEl.style.background = 'rgba(59, 130, 246, 0.2)';
            badgeEl.style.color = '#3b82f6';
            badgeEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> processing';
        }

        updateStatsUI();
    }

    // Start Verification
    startBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) {
            const msg = currentLang === 'vi' ? 'Vui lòng nhập ID xác minh hoặc URL' : 'Please enter Verification IDs or URLs';
            alert(msg);
            return;
        }

        if (!apiKey || !apiKey.startsWith('uak_')) {
            const msg = currentLang === 'vi' ? 'Hệ thống hiện chỉ hỗ trợ Key V2 (uak_)' : 'V2 Keys (uak_) required';
            alert(msg);
            return;
        }

        // Parse IDs/URLs
        let verificationItems = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (verificationItems.length === 0) return;

        // UI Prep
        startBtn.disabled = true;
        const originalBtnHTML = startBtn.innerHTML;
        startBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${translations[currentLang].checking}`;

        // Show progress UI
        emptyState.style.display = 'none';
        progressSection.style.display = 'block';
        resultsList.innerHTML = '';
        verificationStats = { success: 0, failed: 0, total: verificationItems.length, completed: 0 };
        resultItems = {};
        updateStatsUI();

        // API V2 Flow
        await handleV2Verification(verificationItems);

        startBtn.disabled = false;
        startBtn.innerHTML = originalBtnHTML;
        refreshQuota();
    });

    async function handleV2Verification(items) {
        if (!currentKeyInfo) {
            const msg = currentLang === 'vi' ? 'Không có thông tin Key!' : 'No Key info!';
            alert(msg);
            return;
        }

        const isMulti = currentKeyInfo.multi_processing;
        const concurrency = isMulti ? Math.max(1, currentKeyInfo.max_concurrent) : 1;
        const cooldown = isMulti ? 0 : (currentKeyInfo.cooldown_seconds || 0) * 1000;

        let currentIndex = 0;

        const worker = async () => {
            while (currentIndex < items.length) {
                const index = currentIndex++;
                const item = items[index];
                resultsList.appendChild(createResultItem(item));

                await processV2Item(item);

                if (cooldown > 0 && currentIndex < items.length) {
                    await new Promise(r => setTimeout(r, cooldown));
                }
            }
        };

        const workers = Array.from({ length: concurrency }, () => worker());
        await Promise.all(workers);
    }

    async function processV2Item(item) {
        const id = item;
        // Normalize URL
        let url = item;
        if (!url.startsWith('http')) {
            url = `https://services.sheerid.com/verify/${item}`;
        }

        try {
            // 1. Submit
            const submitRes = await fetch(`${V2_BASE}/verify`, {
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            const submitData = await submitRes.json();
            if (!submitRes.ok) throw new Error(submitData.error?.message || 'Submission failed');

            const jobId = submitData.job_id;
            updateResultItem(id, 'processing', 'Queued...');

            // 2. Poll
            let terminal = false;
            let attempts = 0;
            while (!terminal) {
                attempts++;
                await new Promise(r => setTimeout(r, 2500));

                const pollRes = await fetch(`${V2_BASE}/verify/${jobId}`, {
                    headers: { 'X-API-Key': apiKey }
                });
                const pollData = await pollRes.json();

                if (!pollRes.ok) throw new Error(pollData.error?.message || 'Polling failed');

                const status = pollData.status;
                if (status === 'success') {
                    updateResultItem(id, 'success', 'Verified successfully!');
                    terminal = true;
                    // Record stat event for dots
                    fetch('/api/stats/record', {
                        method: 'POST',
                        body: JSON.stringify({ success: true }),
                        headers: { 'Content-Type': 'application/json' }
                    }).catch(() => { });
                } else if (['failed', 'rejected', 'stale', 'invalid_link', 'cancelled'].includes(status)) {
                    updateResultItem(id, 'failed', `Status: ${status}`);
                    terminal = true;
                    fetch('/api/stats/record', {
                        method: 'POST',
                        body: JSON.stringify({ success: false }),
                        headers: { 'Content-Type': 'application/json' }
                    }).catch(() => { });
                } else if (status === 'processing' && pollData.progress) {
                    const progress = pollData.progress;
                    updateResultItem(id, 'processing', `[${progress.stage_number}/7] ${progress.message} (${progress.percentage}%)`);
                } else {
                    updateResultItem(id, 'processing', status.charAt(0).toUpperCase() + status.slice(1) + '...');
                }

                // Safety timeout
                if (attempts > 120) throw new Error('Timeout: Verification taking too long');
            }
        } catch (err) {
            updateResultItem(id, 'failed', err.message);
        }
    }

    // Stats Polling
    async function refreshStats() {
        try {
            const res = await fetch('/api/stats/recent');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('statsSuccess').textContent = data.success;
                document.getElementById('statsFail').textContent = data.fail;

                // Render Dots
                const dotsContainer = document.getElementById('statsDots');
                if (data.events && data.events.length > 0) {
                    dotsContainer.innerHTML = '';
                    data.events.forEach(status => {
                        const dot = document.createElement('span');
                        dot.className = `dot ${status === 1 ? 'success' : 'fail'}`;
                        dotsContainer.appendChild(dot);
                    });
                } else {
                    dotsContainer.innerHTML = `<span class="loading-dots">${translations[currentLang].no_results}</span>`;
                }
            }
        } catch (e) {
            console.error('Stats fetch error:', e);
        }
    }
    // Poll every 15s for "live" feel
    refreshStats();
    setInterval(refreshStats, 15000);

    // Maintenance Status Check
    async function checkMaintenanceStatus() {
        const maintenanceOverlay = document.getElementById('maintenanceOverlay');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            // Use X-API-Key if available to avoid 401, or use a dummy key that fails gracefully
            const headers = apiKey ? { 'X-API-Key': apiKey } : {};

            const healthRes = await fetch(`${V2_BASE}/key/info`, {
                method: 'HEAD',
                headers: headers,
                signal: controller.signal
            }).catch(() => ({ ok: false, status: 0 }));

            clearTimeout(timeoutId);

            // 401 means API is UP but key is missing/bad. 503 means UP but busy. Both mean system is "alive".
            const isV2Alive = healthRes.status === 401 || healthRes.status === 503 || healthRes.ok || healthRes.type === 'opaque';
            if (maintenanceOverlay) {
                maintenanceOverlay.style.display = isV2Alive ? 'none' : 'flex';
            }
        } catch (e) {
            // Only show maintenance if it's a real connection error
            if (maintenanceOverlay) maintenanceOverlay.style.display = 'flex';
        }
    }

    // Initial check and auto-refresh
    checkMaintenanceStatus();
    setInterval(checkMaintenanceStatus, 15000);

    console.log('Batch Verifier UI Ready (V2 Focused)');
});
