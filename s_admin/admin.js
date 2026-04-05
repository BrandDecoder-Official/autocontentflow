// s_admin/admin.js

import { CONFIG } from '../js/config.js';

const adminApp = {
    token: null,
    chartInstance: null,
    tenantsData: [], // 💡 新增：用來記憶全站客戶名單，給日誌比對用

    init() {
        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: this.handleCredentialResponse.bind(this)
        });
        google.accounts.id.renderButton(
            document.getElementById("googleButtonContainer"),
            { theme: "filled_black", size: "large", type: "standard", shape: "pill" }
        );
    },

    async handleCredentialResponse(response) {
        this.token = response.credential;
        document.getElementById('loginSection').innerHTML = '<div class="text-white animate-pulse">驗證身分中...</div>';
        await this.fetchDashboardData();
    },

    async fetchDashboardData() {
        try {
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/admin/dashboard`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || '權限不足');

            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('dashboardSection').classList.remove('hidden');
            
            // 💡 將客戶名單存進記憶體
            this.tenantsData = data.data.tenants;
            
            this.renderDashboard(data.data);
            this.fetchLogs(); 
            
        } catch (error) {
            console.error(error);
            const loginSec = document.getElementById('loginSection');
            loginSec.innerHTML = `
                <div class="text-4xl mb-4">⛔</div>
                <h1 class="text-xl font-bold text-red-500 mb-2">存取被拒</h1>
                <p class="text-sm text-gray-400 mb-4">${error.message}</p>
                <button onclick="location.reload()" class="bg-gray-800 text-white px-4 py-2 rounded">重新登入</button>
            `;
            loginSec.classList.remove('hidden');
        }
    },

    renderDashboard(data) {
        const { stats, tenants } = data;

        let sumTokens = 0; let sumPoints = 0;
        stats.forEach(s => {
            sumTokens += (s.totalTokensUsed || 0);
            sumPoints += (s.totalPointsConsumed || 0);
        });
        document.getElementById('statTotalTokens').innerText = sumTokens.toLocaleString();
        document.getElementById('statTotalPoints').innerText = sumPoints.toLocaleString();
        document.getElementById('statActiveUsers').innerText = tenants.length;

        this.drawChart(stats);

        const tbody = document.getElementById('tenantTableBody');
        tbody.innerHTML = '';
        tenants.forEach(t => {
            const lastLogin = t.lastLoginAt ? new Date(t.lastLoginAt).toLocaleDateString() : '從未登入';
            const statusColor = t.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400';
            
            const roleBadge = t.role === 'SUPER_ADMIN' 
                ? `<span class="bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-700/50">👑 管理員</span>`
                : `<span class="bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-700/50">👤 一般用戶</span>`;
            
            let actionButtons = `
                <button onclick="adminApp.openTopupModal('${t.uid}', '${t.name}')" class="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded text-xs font-bold border border-indigo-600/50 mr-1 transition-colors">
                    💰 儲值
                </button>
            `;

            if (t.status === 'PENDING' || t.status === 'SUSPENDED') {
                actionButtons += `
                    <button onclick="adminApp.changeUserStatus('${t.uid}', '${t.name}', 'ACTIVE', '開通放行')" class="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 py-1 rounded text-xs font-bold border border-green-600/50 transition-colors">
                        ✅ 放行
                    </button>
                `;
            } else if (t.status === 'ACTIVE') {
                actionButtons += `
                    <button onclick="adminApp.changeUserStatus('${t.uid}', '${t.name}', 'SUSPENDED', '停權禁用')" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-xs font-bold border border-red-600/50 transition-colors">
                        ⛔ 停權
                    </button>
                `;
            }

            tbody.innerHTML += `
                <tr class="hover:bg-gray-800/80 transition-colors group">
                    <td class="px-4 py-3">
                        <div class="font-bold text-gray-200">${t.name}</div>
                        <div class="text-[10px] text-gray-500">${t.email}</div>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap">${roleBadge}</td>
                    <td class="px-4 py-3 font-mono text-yellow-400 font-bold">${t.totalPoints.toLocaleString()} ⚡</td>
                    <td class="px-4 py-3 text-xs font-bold ${statusColor}">${t.status} <br><span class="text-[9px] text-gray-600 font-normal">登入: ${lastLogin}</span></td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        ${actionButtons}
                    </td>
                </tr>
            `;
        });
    },

    drawChart(stats) {
        const sortedStats = [...stats].reverse();
        const labels = sortedStats.map(s => s.date.split('-').slice(1).join('/')); 
        const pointsData = sortedStats.map(s => s.totalPointsConsumed || 0);

        const ctx = document.getElementById('trendChart').getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '消耗算力 ⚡',
                    data: pointsData,
                    borderColor: '#a855f7', 
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(75, 85, 99, 0.2)' }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(75, 85, 99, 0.2)' }, ticks: { color: '#9ca3af' }, beginAtZero: true }
                }
            }
        });
    },

    async changeUserStatus(tenantId, name, newStatus, actionText) {
        if (!confirm(`⚠️ 確定要對客戶 [${name}] 執行「${actionText}」嗎？`)) return;

        try {
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/admin/tenant/status`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ targetTenantId: tenantId, newStatus: newStatus })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            alert(`✅ 帳號 [${name}] 已成功 ${actionText}！`);
            this.fetchDashboardData(); 

        } catch (error) {
            alert(`❌ 操作失敗: ${error.message}`);
        }
    },

    openTopupModal(tenantId, name) {
        document.getElementById('topupTargetName').innerText = `目標帳號：${name} (${tenantId})`;
        document.getElementById('topupTenantId').value = tenantId;
        document.getElementById('topupAmount').value = '';
        document.getElementById('topupNote').value = '';
        document.getElementById('topupModal').classList.remove('hidden');
    },
    closeTopupModal() {
        document.getElementById('topupModal').classList.add('hidden');
    },
    async submitTopup() {
        const tenantId = document.getElementById('topupTenantId').value;
        const amount = document.getElementById('topupAmount').value;
        const note = document.getElementById('topupNote').value;
        const btn = document.getElementById('btnSubmitTopup');

        if (!amount) return alert('請輸入金額！');

        btn.innerText = '處理中...'; btn.disabled = true;

        try {
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/admin/topup`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ targetTenantId: tenantId, amount, note })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            alert(`✅ ${data.message}`);
            this.closeTopupModal();
            this.fetchDashboardData(); 
            this.fetchLogs(); 
        } catch (error) {
            alert(`❌ 儲值失敗: ${error.message}`);
        } finally {
            btn.innerText = '確認送出'; btn.disabled = false;
        }
    },

    // ==========================================
    // 8. 獲取稽核日誌 (支援 Email 篩選)
    // ==========================================
    async fetchLogs() {
        const tbody = document.getElementById('logTableBody');
        if (!tbody) return; 
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-indigo-400 animate-pulse font-bold">📡 撈取系統日誌中...</td></tr>';
        
        try {
            // 💡 抓取 Email 篩選器條件
            const emailFilter = document.getElementById('logEmailFilter') ? document.getElementById('logEmailFilter').value.trim() : '';
            const type = document.getElementById('logTypeFilter') ? document.getElementById('logTypeFilter').value : '';
            const startDate = document.getElementById('logStartDate') ? document.getElementById('logStartDate').value : '';
            const endDate = document.getElementById('logEndDate') ? document.getElementById('logEndDate').value : '';
            
            let queryUrl = `${CONFIG.CLOUD_RUN_URL}/api/admin/logs?limitCount=50`;
            if (emailFilter) queryUrl += `&email=${encodeURIComponent(emailFilter)}`;
            if (type) queryUrl += `&type=${type}`;
            if (startDate) queryUrl += `&startDate=${startDate}`;
            if (endDate) queryUrl += `&endDate=${endDate}`;

            const res = await fetch(queryUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message);
            
            this.renderLogs(data.data);
            
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-400 font-bold">❌ 獲取日誌失敗: ${error.message}</td></tr>`;
        }
    },

    // ==========================================
    // 9. 渲染日誌表格 (動態對照姓名與信箱)
    // ==========================================
    renderLogs(logs) {
        const tbody = document.getElementById('logTableBody');
        if (!tbody) return; 
        tbody.innerHTML = '';
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500 font-bold">目前沒有符合條件的歷史紀錄。</td></tr>';
            return;
        }

        logs.forEach(log => {
            const timeStr = new Date(log.createdAt).toLocaleString('zh-TW', { hour12: false });
            
            // 💡 從記憶體 (tenantsData) 中找出這個 log.tenantId 對應的客戶資料
            const user = this.tenantsData.find(t => t.uid === log.tenantId);
            const userName = user ? user.name : '未命名用戶';
            const userEmail = user ? user.email : `${log.tenantId.substring(0,8)}...`;
            
            let typeBadge = `<span class="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-600/50">${log.type || 'UNKNOWN'}</span>`;
            if (log.type === 'SYSTEM_TOP_UP') typeBadge = `<span class="text-[10px] bg-indigo-900/50 text-indigo-400 px-2 py-0.5 rounded border border-indigo-700/50">💰 加值</span>`;
            if (log.type === 'SYSTEM_STATUS_CHANGE') typeBadge = `<span class="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded border border-green-700/50">🛡️ 權限</span>`;
            if (log.type && log.type.startsWith('GENERATE')) typeBadge = `<span class="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded border border-blue-700/50">🤖 生成</span>`;

            let amountHtml = `<span class="text-gray-500">-</span>`;
            if (log.amount > 0) amountHtml = `<span class="text-red-400 font-bold font-mono">-${log.amount}</span>`;
            else if (log.type === 'SYSTEM_TOP_UP') amountHtml = `<span class="text-green-400 font-bold font-mono">+${log.metrics?.addedPoints || 0}</span>`;

            tbody.innerHTML += `
                <tr class="hover:bg-gray-800/80 transition-colors">
                    <td class="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">${timeStr}</td>
                    <td class="px-4 py-3">
                        <div class="font-bold text-gray-200">${userName}</div>
                        <div class="text-[10px] text-gray-500 mb-1">${userEmail}</div>
                        ${typeBadge}
                    </td>
                    <td class="px-4 py-3 text-xs text-gray-300">${log.description || '-'}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        ${amountHtml}
                        ${log.balanceAfter !== null && log.balanceAfter !== undefined ? `<div class="text-[10px] text-gray-500 mt-1">餘額: ${log.balanceAfter.toLocaleString()}</div>` : ''}
                    </td>
                </tr>
            `;
        });
    },

    logout() {
        this.token = null;
        location.reload();
    }
};

window.adminApp = adminApp;
window.onload = () => adminApp.init();
