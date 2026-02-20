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
            themeToggle.innerHTML = '<i class="fas fa-moon"></i> Chế độ tối';
        } else {
            document.documentElement.style.setProperty('--bg-dark', '#0f172a');
            document.documentElement.style.setProperty('--card-bg', '#111e36');
            document.documentElement.style.setProperty('--text-primary', '#e2e8f0');
            document.documentElement.style.setProperty('--text-secondary', '#94a3b8');
            document.documentElement.style.setProperty('--card-border', '#1e293b');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i> Chế độ sáng';
        }
    }

    // Input Handling
    const textarea = document.getElementById('verificationInput');
    const statsEntered = document.querySelector('.stats-row span:first-child');
    const statsAvailable = document.querySelector('.stats-row span:last-child');
    const startBtn = document.getElementById('startBtn');
    const apiKeyBtn = document.querySelector('.btn-api-key');

    // Store API key
    let apiKey = localStorage.getItem('apiKey') || '';
    if (apiKey) {
        apiKeyBtn.innerHTML = '<i class="fas fa-check"></i> Đã có API Key';
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
        const input = prompt('Nhập API Key / HCaptcha Token của bạn:', apiKey);
        if (input !== null) {
            apiKey = input.trim();
            localStorage.setItem('apiKey', apiKey);
            if (apiKey) {
                apiKeyBtn.innerHTML = '<i class="fas fa-check"></i> Đã có API Key';
                apiKeyBtn.classList.add('set');
                refreshQuota(); // Refresh immediately after setting
            } else {
                apiKeyBtn.innerHTML = '<i class="fas fa-key"></i> Đặt API Key';
                apiKeyBtn.classList.remove('set');
                document.getElementById('quotaDisplay').style.display = 'none';
            }
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

        statsEntered.textContent = `${lines} dòng đã nhập`;
        statsAvailable.textContent = `${1000 - lines}/1000 slot trống`;
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
            alert('Vui lòng nhập ID xác minh hoặc URL');
            return;
        }

        if (!apiKey) {
            alert('Vui lòng đặt API Key trước');
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
        const originalBtnText = startBtn.innerHTML;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

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
        startBtn.innerHTML = originalBtnText;
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
                    dotsContainer.innerHTML = '<span class="loading-dots">Chưa có hoạt động</span>';
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
                maintenanceOverlay.style.display = 'none';
                dot.style.background = '#22c55e';
                text.textContent = 'Sẵn sàng';
                text.style.color = '#22c55e';
            } else {
                maintenanceOverlay.style.display = 'flex';
                dot.style.background = '#ef4444';
                text.textContent = 'Bảo trì';
                text.style.color = '#ef4444';
            }

            // Also check our own proxy status for ping
            const res = await fetch('/api/upstream-status');
            if (res.ok) {
                const data = await res.json();
                if (data.ping) {
                    ping.textContent = `(${data.ping}ms)`;
                }
            }
        } catch (e) {
            console.error('Health check error:', e);
            maintenanceOverlay.style.display = 'flex';
            dot.style.background = '#ef4444';
            text.textContent = 'Bảo trì';
            text.style.color = '#ef4444';
        }
    }

    // Initial check and auto-refresh (Every 15 seconds)
    checkUpstreamStatus();
    setInterval(checkUpstreamStatus, 15000);

    console.log('Batch Verifier UI Ready');
});
