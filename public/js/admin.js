document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('loginOverlay');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminSecretInput = document.getElementById('adminSecretInput');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Key Gen Elements
    const keyPrefix = document.getElementById('keyPrefix');
    const keyQuota = document.getElementById('keyQuota');
    const generateBtn = document.getElementById('generateBtn');
    const newKeyResult = document.getElementById('newKeyResult');
    const codeResult = document.getElementById('codeResult');
    const copyNewKey = document.getElementById('copyNewKey');

    // Table Elements
    const keysTableBody = document.getElementById('keysTableBody');
    const refreshBtn = document.getElementById('refreshBtn');

    let adminSecret = sessionStorage.getItem('adminSecret');

    // 1. Check Login
    if (adminSecret) {
        verifyAndLoad(adminSecret);
    }

    loginBtn.addEventListener('click', () => {
        const secret = adminSecretInput.value.trim();
        if (!secret) return alert('Vui lòng nhập mã bí mật!');
        verifyAndLoad(secret);
    });

    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminSecret');
        location.reload();
    });

    // 2. Verify Function
    async function verifyAndLoad(secret) {
        try {
            const response = await fetch(`/admin/keys?secret=${secret}`);
            if (response.status === 403) {
                alert('Mã bí mật không đúng!');
                sessionStorage.removeItem('adminSecret');
                return;
            }
            if (!response.ok) throw new Error('Lỗi kết nối');

            // Success
            adminSecret = secret;
            sessionStorage.setItem('adminSecret', secret);

            // Show UI
            loginOverlay.style.display = 'none';
            adminDashboard.style.display = 'block';

            // Load Data
            const data = await response.json();
            loadKeys(data.keys || data);

        } catch (error) {
            console.error(error);
            alert('Có lỗi xảy ra: ' + error.message);
        }
    }

    // 3. Load Keys Table
    function loadKeys(data) {
        keysTableBody.innerHTML = '';
        // data structure: { "key1": { quota, used, ... }, ... }

        Object.entries(data).reverse().forEach(([key, info]) => {
            const row = document.createElement('tr');

            // Calculate percentage
            const percent = Math.min(100, Math.round((info.used / info.quota) * 100));
            let progressBarColor = '#3b82f6';
            if (percent > 80) progressBarColor = '#f59e0b';
            if (percent >= 100) progressBarColor = '#ef4444';

            row.innerHTML = `
                <td>
                    <div style="font-family: monospace; font-weight: bold;">${key}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">${new Date(info.created_at).toLocaleDateString()}</div>
                </td>
                <td>
                    ${info.used}
                    <div style="width: 100%; height: 4px; background: var(--bg-dark); border-radius: 2px; margin-top: 4px;">
                        <div style="width: ${percent}%; height: 100%; background: ${progressBarColor}; border-radius: 2px;"></div>
                    </div>
                </td>
                <td style="font-weight: bold; color: ${info.quota - info.used < 100 ? '#ef4444' : 'var(--text-primary)'}">
                    ${(info.quota - info.used).toLocaleString()}
                </td>
                <td>${info.quota.toLocaleString()}</td>
                <td>
                    <span class="badge ${info.active ? 'badge-active' : 'badge-inactive'}">
                        ${info.active ? 'Active' : 'Locked'}
                    </span>
                </td>
                <td>
                    <button class="btn-icon-text" onclick="deleteKey('${key}')" style="color: #ef4444; border: 1px solid #ef444433; padding: 4px 8px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            keysTableBody.appendChild(row);
        });
    }

    // Expose delete function to window
    window.deleteKey = async (key) => {
        if (!confirm(`⚠️ Bạn có chắc muốn xóa vĩnh viễn key:\n${key}\nHành động này không thể hoàn tác!`)) return;

        try {
            const response = await fetch('/admin/delete-key', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: adminSecret,
                    key: key
                })
            });

            if (!response.ok) throw new Error('Không thể xóa key');

            // Refresh
            const refreshResp = await fetch(`/admin/keys?secret=${adminSecret}`);
            const data = await refreshResp.json();
            loadKeys(data.keys || data);

        } catch (error) {
            alert('Lỗi: ' + error.message);
        }
    };

    // 4. Generate Key
    generateBtn.addEventListener('click', async () => {
        const prefix = keyPrefix.value.trim();
        const quota = parseInt(keyQuota.value);

        if (!quota || quota <= 0) return alert('Quota không hợp lệ');

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';

        try {
            const response = await fetch('/admin/generate-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    secret: adminSecret,
                    quota: quota,
                    prefix: prefix
                })
            });

            if (!response.ok) throw new Error('Không thể tạo key');

            const data = await response.json();

            // Show result
            newKeyResult.style.display = 'block';
            codeResult.textContent = data.key;

            // Refresh list
            const refreshResp = await fetch(`/admin/keys?secret=${adminSecret}`);
            const listData = await refreshResp.json();
            loadKeys(listData.keys || listData);

        } catch (error) {
            alert('Lỗi: ' + error.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Tạo Key Ngay';
        }
    });

    // Copy to clipboard
    copyNewKey.addEventListener('click', () => {
        navigator.clipboard.writeText(codeResult.textContent);
        const originalIcon = copyNewKey.innerHTML;
        copyNewKey.innerHTML = '<i class="fas fa-check" style="color: #22c55e"></i>';
        setTimeout(() => {
            copyNewKey.innerHTML = originalIcon;
        }, 2000);
    });

    // Refresh button
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const response = await fetch(`/admin/keys?secret=${adminSecret}`);
            const data = await response.json();
            loadKeys(data.keys || data);
        } catch (e) { }
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    });

});
