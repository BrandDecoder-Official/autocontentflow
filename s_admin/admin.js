// s_admin/admin.js

// 🌟 1. 改為動態讀取上一層的 config.js，不再寫死！
import { CONFIG } from '../js/config.js';

const adminApp = {
    token: null,
    chartInstance: null,

    // 1. 初始化 Google 登入按鈕
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

    // 2. 登入回傳處理
    async handleCredentialResponse(response) {
        this.token = response.credential;
        document.getElementById('loginSection').innerHTML = '<div class="text-white animate-pulse">驗證身分中...</div>';
        
        // 嘗試撈取戰情資料 (順便當作權限驗證)
        await this.fetchDashboardData();
    },

    // 3. 呼叫 Dashboard API (使用 CONFIG.CLOUD_RUN_URL)
    async fetchDashboardData() {
        try {
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/admin/dashboard`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || '權限不足');

            // 驗證成功，切換畫面
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('dashboardSection').classList.remove('hidden');
            
            this.renderDashboard(data.data);

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

    // 4. 繪製畫面
    renderDashboard(data) {
        const { stats, tenants } = data;

        // --- A. 更新頂部卡片 ---
        let sumTokens = 0; let sumPoints = 0;
        stats.forEach(s => {
            sumTokens += (s.totalTokensUsed || 0);
            sumPoints += (s.totalPointsConsumed || 0);
        });
        document.getElementById('statTotalTokens').innerText = sumTokens.toLocaleString();
        document.getElementById('statTotalPoints').innerText = sumPoints.toLocaleString();
        document.getElementById('statActiveUsers').innerText = tenants.length;

        // --- B. 繪製折線圖 ---
        this.drawChart(stats);

        // --- C. 渲染客戶列表 ---
        const tbody = document.getElementById('tenantTableBody');
        tbody.innerHTML = '';
        tenants.forEach(t => {
            const lastLogin = t.lastLoginAt ? new Date(t.lastLoginAt).toLocaleDateString() : '從未登入';
            const statusColor = t.status === 'ACTIVE' ? 'text-green-400' : 'text-red-400';
            
            // 💡 角色專屬 Badge
            const roleBadge = t.role === 'SUPER_ADMIN' 
                ? `<span class="bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-700/50">👑 管理員</span>`
                : `<span class="bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-700/50">👤 一般用戶</span>`;
            
            // 💡 操作區：儲值功能常駐
            let actionButtons = `
                <button onclick="adminApp.openTopupModal('${t.uid}', '${t.name}')" class="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded text-xs font-bold border border-indigo-600/50 mr-1 transition-colors">
                    💰 儲值
                </button>
            `;

            // 💡 狀態判斷：PENDING(待審核) 或 SUSPENDED(已停權) -> 顯示綠色「放行」
            if (t.status === 'PENDING' || t.status === 'SUSPENDED') {
                actionButtons += `
                    <button onclick="adminApp.changeUserStatus('${t.uid}', '${t.name}', 'ACTIVE', '開通放行')" class="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white px-3 py-1 rounded text-xs font-bold border border-green-600/50 transition-colors">
                        ✅ 放行
                    </button>
                `;
            } 
            // 💡 狀態判斷：ACTIVE(使用中) -> 顯示紅色「停權」
            else if (t.status === 'ACTIVE') {
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

    // 5. 繪製 Chart.js
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

    // 6. 萬用客戶狀態切換 (開通 / 停權)
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

    // 7. 手動儲值系統 Modal 控制
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
        } catch (error) {
            alert(`❌ 儲值失敗: ${error.message}`);
        } finally {
            btn.innerText = '確認送出'; btn.disabled = false;
        }
    },

    logout() {
        this.token = null;
        location.reload();
    }
};

// 🌟 核心防呆：因為使用了 import (module)，必須把 app 掛載到全域 window 上
// 這樣 HTML 裡面的 onclick="adminApp.xxx" 才找得到函數！
window.adminApp = adminApp;
window.onload = () => adminApp.init();
