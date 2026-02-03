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

            // Load Master Quota
            loadMasterQuota();

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
                    <button class="btn-icon-text" onclick="topupKey('${key}')" style="color: #22c55e; border: 1px solid #22c55e33; padding: 4px 8px; margin-right: 5px;" title="Nạp thêm quota">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn-icon-text" onclick="deleteKey('${key}')" style="color: #ef4444; border: 1px solid #ef444433; padding: 4px 8px;" title="Xóa key">
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
            loadMasterQuota();
        } catch (e) { }
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
    });

    // Master Quota Functions
    async function loadMasterQuota() {
        try {
            const res = await fetch(`/admin/master-quota?secret=${adminSecret}`);
            if (res.ok) {
                const data = await res.json();
                const remaining = data.public_limit - data.used;

                document.getElementById('masterInventory').textContent = (data.inventory || 0).toLocaleString();
                document.getElementById('masterRemaining').textContent = Math.max(0, remaining).toLocaleString();
                document.getElementById('masterTotal').textContent = (data.public_limit || 0).toLocaleString();

                window.currentMasterQuota = data;

                // Color coding
                const elem = document.getElementById('masterRemaining');
                if (remaining < 10) elem.style.color = '#ef4444';
                else if (remaining < 50) elem.style.color = '#f59e0b';
                else elem.style.color = '#22c55e';
            }
        } catch (e) {
            console.error('Master quota load error:', e);
        }
    }

    // Edit Master Quota Button
    document.getElementById('editMasterQuotaBtn').addEventListener('click', async () => {
        const q = window.currentMasterQuota || { inventory: 0, public_limit: 0, used: 0 };

        const newInventory = prompt('📦 NHẬP TỔNG KHO (Số lượng Key bạn đang có):', q.inventory);
        if (newInventory === null) return;

        const newPublicLimit = prompt('🚀 TRÍCH RA BAO NHIÊU (Số lượng cấp cho User sử dụng):', q.public_limit);
        if (newPublicLimit === null) return;

        const resetUsed = confirm('Bạn có muốn RESET số lượng ĐÃ DÙNG về 0 không?\n(Chọn Cancel nếu muốn giữ nguyên tiến trình hiện tại)');

        const body = {
            secret: adminSecret,
            inventory: parseInt(newInventory),
            publicLimit: parseInt(newPublicLimit)
        };

        if (resetUsed) body.used = 0;

        try {
            const res = await fetch('/admin/master-quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                loadMasterQuota();
                alert('✅ Đã cập nhật Kho và Pool thành công!');
            } else {
                alert('❌ Lỗi cập nhật!');
            }
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    });

    // Bulk Key Generation
    document.getElementById('bulkGenerateBtn').addEventListener('click', async () => {
        const prefix = document.getElementById('keyPrefix').value.trim() || 'bulk';
        const quota = parseInt(document.getElementById('keyQuota').value) || 1000;
        const count = parseInt(document.getElementById('bulkCount').value) || 5;

        if (!confirm(`Bạn sắp tạo ${count} key với prefix "${prefix}" và quota ${quota} mỗi key. Tiếp tục?`)) return;

        try {
            const res = await fetch('/admin/bulk-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: adminSecret, prefix, quota, count })
            });

            if (res.ok) {
                const data = await res.json();
                const keysList = data.keys.map(k => k.key).join('\n');
                codeResult.textContent = keysList;
                newKeyResult.style.display = 'block';

                // Refresh keys list
                const response = await fetch(`/admin/keys?secret=${adminSecret}`);
                const keysData = await response.json();
                loadKeys(keysData.keys || keysData);
                loadMasterQuota();

                alert(`✅ Đã tạo ${data.count} key thành công!`);
            } else {
                alert('❌ Lỗi tạo key hàng loạt!');
            }
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    });

    // Top-up key quota
    window.topupKey = async (key) => {
        const addQuota = prompt(`Nhập số quota muốn NẠP THÊM cho key:\n${key}`, '100');
        if (addQuota === null || addQuota === '') return;

        try {
            const res = await fetch('/admin/topup-quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: adminSecret, key, addQuota: parseInt(addQuota) })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`✅ Đã nạp thêm ${addQuota} quota!\nTổng: ${data.newQuota} | Còn: ${data.remaining}`);

                // Refresh
                const response = await fetch(`/admin/keys?secret=${adminSecret}`);
                const keysData = await response.json();
                loadKeys(keysData.keys || keysData);
            } else {
                alert('❌ Lỗi nạp quota!');
            }
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    };

    // Search/Filter keys
    let allKeysData = {};
    const originalLoadKeys = loadKeys;

    // Override loadKeys to store data
    loadKeys = function (data) {
        allKeysData = data;
        originalLoadKeys(data);
    };

    document.getElementById('keySearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            originalLoadKeys(allKeysData);
            return;
        }

        const filtered = {};
        Object.entries(allKeysData).forEach(([key, info]) => {
            if (key.toLowerCase().includes(query)) {
                filtered[key] = info;
            }
        });
        originalLoadKeys(filtered);
    });

    // ============ Master Key Pool Management ============

    async function loadMasterKeyPool() {
        try {
            const res = await fetch(`/admin/master-keys?secret=${adminSecret}`);
            if (res.ok) {
                const data = await res.json();
                document.getElementById('masterKeyCount').textContent = `${data.active}/${data.total} active`;
                renderMasterKeys(data.keys);
            }
        } catch (e) {
            console.error('Master Key Pool load error:', e);
        }
    }

    function renderMasterKeys(keys) {
        const container = document.getElementById('masterKeysList');
        if (!container) return;

        if (keys.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p>Chưa có Master Key nào. Hãy thêm key từ Vercel Environment hoặc nút "Thêm Key".</p>
                </div>
            `;
            return;
        }

        container.innerHTML = keys.map(k => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: var(--bg-dark); border-radius: 8px; border: 1px solid var(--card-border);">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${k.enabled ? '#22c55e' : '#ef4444'};"></span>
                    <code style="font-family: monospace; color: var(--text-primary);">${k.keyPreview}</code>
                    ${k.errorCount > 0 ? `<span style="font-size: 11px; color: #f59e0b; background: rgba(245,158,11,0.1); padding: 2px 6px; border-radius: 4px;">${k.errorCount} lỗi</span>` : ''}
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="toggleMasterKey(${k.id})" class="btn-icon-text" style="padding: 4px 10px; font-size: 12px; border: 1px solid var(--card-border);">
                        <i class="fas ${k.enabled ? 'fa-pause' : 'fa-play'}"></i> ${k.enabled ? 'Tắt' : 'Bật'}
                    </button>
                    <button onclick="removeMasterKey(${k.id})" class="btn-icon-text" style="padding: 4px 10px; font-size: 12px; color: #ef4444; border: 1px solid #ef444433;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Add Master Key
    document.getElementById('addMasterKeyBtn')?.addEventListener('click', async () => {
        const newKey = prompt('Nhập Master Key mới (lấy từ web gốc sau khi mua):');
        if (!newKey || newKey.trim().length < 10) {
            alert('Key không hợp lệ!');
            return;
        }

        try {
            const res = await fetch('/admin/master-keys/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: adminSecret, key: newKey.trim() })
            });

            if (res.ok) {
                alert('✅ Đã thêm Master Key thành công!');
                loadMasterKeyPool();
            } else {
                const err = await res.json();
                alert('❌ Lỗi: ' + (err.error || 'Không thể thêm key'));
            }
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    });

    // Toggle Master Key
    window.toggleMasterKey = async (keyIndex) => {
        try {
            const res = await fetch('/admin/master-keys/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: adminSecret, keyIndex })
            });

            if (res.ok) {
                loadMasterKeyPool();
            }
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    };

    // Remove Master Key
    window.removeMasterKey = async (keyIndex) => {
        if (!confirm('⚠️ Bạn có chắc muốn xóa Master Key này khỏi Pool?\n(Key chỉ bị xóa khỏi bộ nhớ, không ảnh hưởng Vercel Environment)')) return;

        try {
            const res = await fetch('/admin/master-keys/remove', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret: adminSecret, keyIndex })
            });

            if (res.ok) {
                alert('✅ Đã xóa Master Key khỏi Pool!');
                loadMasterKeyPool();
            }
        } catch (e) {
            alert('❌ Lỗi: ' + e.message);
        }
    };

    // Load Master Key Pool on page load (after successful login)
    const originalVerifyAndLoad = verifyAndLoad;
    verifyAndLoad = async function (secret) {
        await originalVerifyAndLoad(secret);
        loadMasterKeyPool();
    };
});
