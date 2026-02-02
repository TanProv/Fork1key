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

    // Quota Refresh Function
    async function refreshQuota() {
        if (!apiKey) {
            document.getElementById('quotaDisplay').style.display = 'none';
            return;
        }
        try {
            const res = await fetch(`/api/user/quota?key=${encodeURIComponent(apiKey)}`);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('quotaRemaining').textContent = data.remaining.toLocaleString();
                document.getElementById('quotaTotal').textContent = data.quota.toLocaleString();
                document.getElementById('quotaDisplay').style.display = 'flex';
                document.getElementById('quotaDisplay').style.alignItems = 'center';
                document.getElementById('quotaDisplay').style.gap = '6px';

                // Color coding
                const remaining = data.remaining;
                const quotaElem = document.getElementById('quotaRemaining');
                if (remaining < 10) {
                    quotaElem.style.color = '#ef4444';
                } else if (remaining < 100) {
                    quotaElem.style.color = '#f59e0b';
                } else {
                    quotaElem.style.color = '#22c55e';
                }
            } else {
                document.getElementById('quotaDisplay').style.display = 'none';
            }
        } catch (e) {
            console.error('Quota fetch error:', e);
        }
    }

    // Poll quota every 5 seconds
    setInterval(refreshQuota, 5000);

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
    const clearBtn = document.querySelector('.btn-icon-text:first-child'); // First button in right header is Clear
    const exportBtn = document.querySelector('.btn-icon-text:last-child');

    // Clear Results
    clearBtn.addEventListener('click', () => {
        resultsBody.innerHTML = `
            <div class="empty-content">
                <i class="fas fa-gift pulse-icon"></i>
                <h3>Chưa có kết quả</h3>
                <p>Nhập ID xác minh và bấm Bắt đầu</p>
            </div>
        `;
        // Make empty content visible again (remove any specific result list styles if added)
        resultsBody.classList.add('empty-state');
        resultsBody.style.display = 'flex'; // Reset display to flex for centering
    });

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

        // Parse IDs/URLs
        const verificationIds = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Simple extraction logic: if contains URL, try extract ID? 
                // For now send the line as is, backend or user assumes it's ID
                return line;
            });

        if (verificationIds.length === 0) {
            return;
        }

        // UI Prep
        startBtn.disabled = true;
        const originalBtnText = startBtn.innerHTML;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';

        // Prepare Results Area
        if (resultsBody.querySelector('.empty-content')) {
            resultsBody.innerHTML = '<div class="results-list" style="width:100%; overflow-y:auto; max-height: 500px;"></div>';
            resultsBody.classList.remove('empty-state');
            resultsBody.style.display = 'block';
        }
        const listContainer = resultsBody.querySelector('.results-list');

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
                // Try to get error text
                let errorText = `Lỗi server: ${response.status}`;
                try {
                    const errJson = await response.json();
                    if (errJson.error) errorText = errJson.error;
                } catch (e) { }
                throw new Error(errorText);
            }

            // Read SSE Stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const lines = buffer.split('\n\n');
                // Keep the last partial line in buffer
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.replace('data: ', '');
                        try {
                            const data = JSON.parse(jsonStr);
                            handleSSEData(data, listContainer);
                        } catch (e) {
                            console.error('Error parsing SSE data', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Fetch error:', error);
            const errDiv = document.createElement('div');
            errDiv.className = 'result-item error';
            errDiv.innerHTML = `<i class="fas fa-circle-exclamation" style="color:#ef4444; margin-right:8px;"></i> ${error.message}`;
            errDiv.style.padding = '10px';
            errDiv.style.color = '#ef4444';
            listContainer.appendChild(errDiv);
        } finally {
            startBtn.disabled = false;
            startBtn.innerHTML = originalBtnText;
        }
    });

    // Stats Polling
    async function refreshStats() {
        try {
            const res = await fetch('/api/stats/recent');
            if (res.ok) {
                const data = await res.json();
                document.getElementById('statsSuccess').textContent = data.success;
                document.getElementById('statsFail').textContent = data.fail;
            }
        } catch (e) {
            console.error('Stats fetch error:', e);
        }
    }
    // Poll every 30s
    refreshStats();
    setInterval(refreshStats, 30000);

    function handleSSEData(data, container) {

        if (data.verificationId) {
            // Item result
            const itemDiv = document.createElement('div');
            itemDiv.className = `result-item ${data.currentStep === 'success' ? 'success' : 'error'}`;
            itemDiv.style.padding = '10px';
            itemDiv.style.borderBottom = '1px solid var(--card-border)';
            itemDiv.style.display = 'flex';
            itemDiv.style.justifyContent = 'space-between';
            itemDiv.style.fontSize = '0.9rem';

            const icon = data.currentStep === 'success' ? '<i class="fas fa-check" style="color:#22c55e"></i>' : '<i class="fas fa-times" style="color:#ef4444"></i>';

            itemDiv.innerHTML = `
                <div style="display:flex; gap:10px; align-items:center;">
                    ${icon} 
                    <span style="font-family:monospace; color:var(--text-primary)">${data.verificationId}</span>
                </div>
                <span style="color:var(--text-secondary)">${data.message}</span>
            `;

            container.appendChild(itemDiv);
            // Auto scroll to bottom
            container.scrollTop = container.scrollHeight;
        }
    }

    console.log('Batch Verifier UI Ready');
});
