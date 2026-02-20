document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    let isLightMode = false;

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
            api_server: 'API Server',
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
            tier_pro: 'Gói Chuyên Nghiệp',
            tier_agent: 'Gói Đại Lý',
            p_1key: '1 Key xác minh',
            p_20keys: '20 Keys xác minh',
            p_100keys: '100 Keys xác minh',
            p_instant: 'Hiệu lực ngay lập tức',
            p_support: 'Hỗ trợ 24/7',
            p_save15: 'Tiết kiệm 15%',
            p_priority: 'Ưu tiên hỗ trợ',
            p_best_price: 'Giá tốt nhất thị trường',
            p_partner: 'Partner ưu tiên',
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
            m_status: 'Đang chờ kết nối API...',
            m_contact: 'Nếu cần hỗ trợ gấp, vui lòng liên hệ',
            placeholder: `Nhập ID xác minh hoặc URL bên dưới, mỗi dòng một cái...
US IP + Fingerprint browser.
Đăng nhập trực tiếp không cần xác minh!!!
Khuyên dùng: Dùng IP Mỹ gốc và ít người dùng. Tránh dùng IP 'Data Center' bị nát.

I'm feeling lucky -> Sử dụng một trong các trường đã hoạt động tốt trong 2 ngày qua.
KHÔNG CẦN ĐĂNG NHẬP! HOÀN TOÀN MIỄN PHÍ!
Trang web này sẽ duy trì lâu nhất có thể.
Nếu token hết hạn hoặc đã xử lý -> Hãy thử lấy lại link ? mới.
Công cụ này chỉ dành cho Goo Student Discount Verification IDs (IP Mỹ).`
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
            api_server: 'API Server',
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
            tier_pro: 'Professional Tier',
            tier_agent: 'Reseller Tier',
            p_1key: '1 Verification Key',
            p_20keys: '20 Verification Keys',
            p_100keys: '100 Verification Keys',
            p_instant: 'Instant activation',
            p_support: '24/7 Support',
            p_save15: 'Save 15%',
            p_priority: 'Priority support',
            p_best_price: 'Best market price',
            p_partner: 'Priority Partner',
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
            m_status: 'Waiting for API connection...',
            m_contact: 'For urgent support, please contact',
            placeholder: `Enter Verification IDs or URLs below, one per line...
US IP + Fingerprint browser.
Direct login without verification!!!
Recommended: Use residential US IP. Avoid exhausted Data Center IPs.

I'm feeling lucky -> Use one of the fields that worked well in the past 2 days.
LOGIN NOT REQUIRED! COMPLETELY FREE!
This site will stay active as long as possible.
If token expired or processed -> Try getting a new link ?.
This tool is for Goo Student Discount Verification IDs only (US IP).`
        }
    };

    let currentLang = localStorage.getItem('lang') || 'vi';

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
        if (apiKey) {
            apiKeyBtn.innerHTML = `<i class="fas fa-check"></i> ${translations[currentLang].btn_api_key_set}`;
        } else {
            apiKeyBtn.innerHTML = `<i class="fas fa-key"></i> ${translations[currentLang].btn_api_key}`;
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

    // Input Handling
    const textarea = document.getElementById('verificationInput');
    const statsEntered = document.getElementById('lineCount');
    const statsAvailable = document.getElementById('slotsEmpty');
    const startBtn = document.getElementById('startBtn');
    const apiKeyBtn = document.querySelector('.btn-api-key');

    // Store API key
    let apiKey = localStorage.getItem('apiKey') || '';
    if (apiKey) {
        apiKeyBtn.classList.add('set');
        refreshQuota(); // Load quota immediately
    }

    const V2_BASE = 'https://sheeridbot.com/api/v2';

    // Quota Refresh Function
    async function refreshQuota() {
        if (!apiKey) {
            document.getElementById('quotaDisplay').style.display = 'none';
            return;
        }

        const isV2 = apiKey.startsWith('uak_');

        try {
            if (isV2) {
                const res = await fetch(`${V2_BASE}/key/info`, {
                    headers: { 'X-API-Key': apiKey }
                });
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('quotaRemaining').textContent = data.available_credits.toLocaleString();
                    document.getElementById('quotaTotal').textContent = data.total_credits.toLocaleString();
                    document.getElementById('quotaDisplay').style.display = 'flex';

                    document.getElementById('keyInfoExtra').style.display = 'block';
                    document.getElementById('keyNameDisplay').textContent = data.key_name;
                    document.getElementById('keyTypeDisplay').textContent = data.key_type === 'multi_use' ? 'Multi-use' : 'Single-use';

                    const remaining = data.available_credits;
                    const quotaElem = document.getElementById('quotaRemaining');
                    quotaElem.style.color = remaining < 1 ? '#ef4444' : (remaining < 5 ? '#f59e0b' : '#22c55e');
                } else {
                    document.getElementById('quotaDisplay').style.display = 'none';
                }
            } else {
                // Legacy Quota
                const res = await fetch(`/api/user/quota?key=${encodeURIComponent(apiKey)}`);
                if (res.ok) {
                    const data = await res.json();
                    document.getElementById('quotaRemaining').textContent = data.remaining.toLocaleString();
                    document.getElementById('quotaTotal').textContent = data.quota.toLocaleString();
                    document.getElementById('quotaDisplay').style.display = 'flex';
                    document.getElementById('keyInfoExtra').style.display = 'none';

                    const remaining = data.remaining;
                    const quotaElem = document.getElementById('quotaRemaining');
                    quotaElem.style.color = remaining < 10 ? '#ef4444' : (remaining < 100 ? '#f59e0b' : '#22c55e');
                } else {
                    document.getElementById('quotaDisplay').style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Quota fetch error:', e);
        }
    }

    // Poll quota every 10 seconds (less frequent for V2 to be polite)
    setInterval(refreshQuota, 10000);

    apiKeyBtn.addEventListener('click', () => {
        const promptMsg = currentLang === 'vi' ? 'Nhập API Key / HCaptcha Token của bạn:' : 'Enter your API Key / HCaptcha Token:';
        const input = prompt(promptMsg, apiKey);
        if (input !== null) {
            apiKey = input.trim();
            localStorage.setItem('apiKey', apiKey);
            if (apiKey) {
                apiKeyBtn.classList.add('set');
                refreshQuota(); // Refresh immediately after setting
            } else {
                apiKeyBtn.classList.remove('set');
                document.getElementById('quotaDisplay').style.display = 'none';
            }
            updateTranslations();
        }
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

    // API Integration
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
        document.getElementById('progressText').textContent = `${verificationStats.completed} / ${verificationStats.total} completed`;
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
                <button onclick="cancelItem('${id}')" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-ban"></i> Cancel
                </button>
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

    // Cancel item (placeholder - would need backend support)
    window.cancelItem = (id) => {
        updateResultItem(id, 'failed', 'Cancelled by user');
    };

    // Start Verification
    startBtn.addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text) {
            const msg = currentLang === 'vi' ? 'Vui lòng nhập ID xác minh hoặc URL' : 'Please enter Verification IDs or URLs';
            alert(msg);
            return;
        }

        if (!apiKey) {
            const msg = currentLang === 'vi' ? 'Vui lòng đặt API Key trước' : 'Please set API Key first';
            alert(msg);
            return;
        }

        const isV2 = apiKey.startsWith('uak_');

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

        if (isV2) {
            // API V2 Flow (Concurrent submission and polling)
            await handleV2Verification(verificationItems);
        } else {
            // Legacy V1 Flow (Legacy SSE)
            await handleV1Verification(verificationItems);
        }

        startBtn.disabled = false;
        startBtn.innerHTML = originalBtnHTML;
        refreshQuota();
    });

    async function handleV2Verification(items) {
        const promises = items.map(async (item) => {
            const id = item;
            resultsList.appendChild(createResultItem(id));

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
                while (!terminal) {
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
                    } else if (['failed', 'rejected', 'stale', 'invalid_link', 'cancelled'].includes(status)) {
                        updateResultItem(id, 'failed', `Error: ${status}`);
                        terminal = true;
                    } else if (status === 'processing' && pollData.progress) {
                        const progress = pollData.progress;
                        updateResultItem(id, 'processing', `[${progress.stage_number}/7] ${progress.message} (${progress.percentage}%)`);
                    } else {
                        updateResultItem(id, 'processing', status.charAt(0).toUpperCase() + status.slice(1) + '...');
                    }
                }
            } catch (err) {
                updateResultItem(id, 'failed', err.message);
            }
        });

        await Promise.all(promises);
    }

    async function handleV1Verification(verificationIds) {
        // Create pending items
        verificationIds.forEach(id => {
            resultsList.appendChild(createResultItem(id));
        });

        try {
            const response = await fetch('/api/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': window.CSRF_TOKEN
                },
                body: JSON.stringify({
                    hCaptchaToken: apiKey,
                    verificationIds: verificationIds
                })
            });

            if (!response.ok) {
                let errorText = `Lỗi server: ${response.status}`;
                try {
                    const errJson = await response.json();
                    if (errJson.error) errorText = errJson.error;
                } catch (e) { }
                throw new Error(errorText);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.replace('data: ', '');
                        try {
                            const data = JSON.parse(jsonStr);
                            handleSSEData(data);
                        } catch (e) {
                            console.error('Error parsing SSE data', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            alert('❌ ' + error.message);
        }
    }

    function handleSSEData(data) {
        if (data.verificationId) {
            const id = data.verificationId;
            const status = data.currentStep === 'success' ? 'success' :
                (data.currentStep === 'error' || data.error) ? 'failed' : 'processing';
            const message = data.message || data.currentStep || '';
            updateResultItem(id, status, message);
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

    // Upstream Status Check
    async function checkUpstreamStatus() {
        const dot = document.getElementById('upstreamStatusDot');
        const text = document.getElementById('upstreamStatusText');
        const ping = document.getElementById('upstreamPing');
        const maintenanceOverlay = document.getElementById('maintenanceOverlay');

        try {
            // Check V2 API Health (Headless request)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const healthRes = await fetch(`${V2_BASE}/key/info`, {
                method: 'HEAD',
                mode: 'no-cors', // Standard fetch to check reachability
                signal: controller.signal
            }).catch(() => ({ ok: false, status: 0 }));

            clearTimeout(timeoutId);

            // 401 is "Online" for V2 (since we don't provide a key)
            // or 0 if CORS blocks but it still "connected" (no-cors trick)
            const isV2Alive = healthRes.status === 401 || healthRes.ok || healthRes.type === 'opaque';

            if (isV2Alive) {
                if (maintenanceOverlay) maintenanceOverlay.style.display = 'none';
                if (dot) dot.style.background = '#22c55e';
                if (text) text.textContent = translations[currentLang].ready;
                if (text) text.style.color = '#22c55e';
            } else {
                if (maintenanceOverlay) maintenanceOverlay.style.display = 'flex';
                if (dot) dot.style.background = '#ef4444';
                if (text) text.textContent = translations[currentLang].m_status;
                if (text) text.style.color = '#ef4444';
            }

            // Also check our own proxy status for ping
            const res = await fetch('/api/upstream-status');
            if (res.ok) {
                const data = await res.json();
                if (data.ping && ping) {
                    ping.textContent = `(${data.ping}ms)`;
                }
            }
        } catch (e) {
            console.error('Health check error:', e);
            if (maintenanceOverlay) maintenanceOverlay.style.display = 'flex';
            if (dot) dot.style.background = '#ef4444';
            if (text) text.textContent = translations[currentLang].m_status;
            if (text) text.style.color = '#ef4444';
        }
    }

    // Initial check and auto-refresh (Every 15 seconds)
    checkUpstreamStatus();
    setInterval(checkUpstreamStatus, 15000);

    console.log('Batch Verifier UI Ready');
});
