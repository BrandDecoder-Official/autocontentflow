// s_admin/admin.js
import { CONFIG } from '../js/config.js'; // 👈 完美引用上一層的全域設定

const adminApp = {
    token: null,
    chartInstance: null,

    // 1. 初始化 Google 登入按鈕
    init() {
        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID, // 👈 使用 config.js 的參數
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

    // 3. 呼叫 Dashboard API
    async fetchDashboardData() {
        try {
            // 👈 使用 config.js 的 CLOUD_RUN_URL
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
            
            tbody.innerHTML += `
                <tr class="hover:bg-gray-800/80 transition-colors group">
                    <td class="px-4 py-3">
                        <div class="font-bold text-gray-200">${t.name}</div>
                        <div class="text-[10px] text-gray-500">${t.email}</div>
                    </td>
                    <td class="px-4 py-3 font-mono text-yellow-400 font-bold">${t.totalPoints.toLocaleString()} ⚡</td>
                    <td class="px-4 py-3 text-xs font-bold ${statusColor}">${t.status} <br><span class="text-[9px] text-gray-600 font-normal">登入: ${lastLogin}</span></td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="adminApp.openTopupModal('${t.uid}', '${t.name}')" class="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded text-xs font-bold border border-indigo-600/50">
                            💰 儲值
                        </button>
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

    // 6. 儲值系統 Modal 控制
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

    // 7. 送出儲值 API
    async submitTopup() {
        const tenantId = document.getElementById('topupTenantId').value;
        const amount = document.getElementById('topupAmount').value;
        const note = document.getElementById('topupNote').value;
        const btn = document.getElementById('btnSubmitTopup');

        if (!amount) return alert('請輸入金額！');

        btn.innerText = '處理中...'; btn.disabled = true;

        try {
            // 👈 使用 config.js 的 CLOUD_RUN_URL
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

// 🌟 因為使用 module 載入，必須將 app 掛載到 window 上，HTML 裡的 onclick 才能執行
window.adminApp = adminApp;

window.onload = () => adminApp.init();
