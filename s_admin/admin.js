// s_admin/admin.js

import { CONFIG } from '../js/config.js';

const adminApp = {
    token: null,
    chartInstance: null,
    tenantsData: [], 
    pricingConfig: null, // 💡 新增：用來存放動態定價表

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
        await this.fetchPricingData(); // 💡 新增：登入後去抓價目表
    },

    // ==========================================
    // 📊 儀表板與 CRM
    // ==========================================
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

    // ==========================================
    // 💰 儲值系統
    // ==========================================
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
    // 🛡️ 動態定價與毛利精算 (Pricing Engine)
    // ==========================================
    async fetchPricingData() {
        try {
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/admin/pricing`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            const data = await res.json();
            
            if (res.ok && data.data) {
                this.pricingConfig = data.data;
            } else {
                throw new Error('API 尚未準備好');
            }
        } catch(e) {
            console.warn("後端 API 尚未開通，啟用前端模擬定價資料展示");
            // 💡 貼心防呆：如果總編還沒寫後端，給一組預設資料讓 UI 不會壞掉
            this.pricingConfig = {
                globalProfitMultiplier: 4.0,
                actions: {
                    CREATE_CHARACTER: { name: "建立專屬角色", baseCostTWD: 5.2, retailPoints: 7 },
                    GENERATE_DRAFT: { name: "AI 撰寫貼文腳本", baseCostTWD: 5.5, retailPoints: 8 },
                    GENERATE_IMAGE: { name: "AI 雲端算圖", baseCostTWD: 6.1, retailPoints: 6 },
                    PUBLISH_POST: { name: "社群發射與排程", baseCostTWD: 6.5, retailPoints: 8 },
                    UPLOAD_IMAGE: { name: "原圖上傳", baseCostTWD: 0.0, retailPoints: 0 }
                }
            };
        }
        
        // 初始化 UI
        if(this.pricingConfig.globalProfitMultiplier) {
            document.getElementById('globalMultiplier').value = this.pricingConfig.globalProfitMultiplier;
        }
        this.updatePricingUI();
    },

    updatePricingUI() {
        if (!this.pricingConfig) return;
        
        const multiplier = parseFloat(document.getElementById('globalMultiplier').value);
        document.getElementById('multiplierValue').innerText = `${multiplier.toFixed(1)}x`;
        
        const tbody = document.getElementById('pricingTableBody');
        tbody.innerHTML = '';

        // 🌟 關鍵修正：告訴戰情室目前的匯率 (1 TWD = 1000 點)
        const TWD_TO_POINTS = 1000;
        
        for(const [actionKey, data] of Object.entries(this.pricingConfig.actions)) {
            
            // 1. 先把 DB 裡的台幣成本，換算成「點數成本」
            const baseCostPoints = data.baseCostTWD * TWD_TO_POINTS;

            // 2. 計算建議售價 (點數成本 * 倍率，無條件進位)
            const suggested = Math.ceil(baseCostPoints * multiplier);
            const retail = data.retailPoints || 0;
            
            // 3. 毛利計算 (統一用點數相減：售價點數 - 成本點數)
            const profitPoints = retail - baseCostPoints;
            const margin = retail > 0 ? (profitPoints / retail) * 100 : (profitPoints < 0 ? -100 : 0);
            
            let statusHtml = '';
            let rowClass = 'transition-colors';
            
            // 🚨 毛利防呆視覺判定
            if (profitPoints < 0) {
                statusHtml = `<div class="bg-red-900/50 text-red-400 px-2 py-1 rounded text-[10px] font-bold border border-red-700/50 inline-block text-center w-full">🚨 嚴重虧損</div>`;
                rowClass = 'bg-red-900/20 border-l-4 border-red-500';
            } else if (margin < 50) {
                statusHtml = `<div class="bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded text-[10px] font-bold border border-yellow-700/50 inline-block text-center w-full">⚠️ 利潤偏低</div>`;
                rowClass = 'bg-yellow-900/10 border-l-4 border-yellow-500';
            } else {
                statusHtml = `<div class="bg-green-900/50 text-green-400 px-2 py-1 rounded text-[10px] font-bold border border-green-700/50 inline-block text-center w-full">✅ 健康獲利</div>`;
                rowClass = 'border-l-4 border-transparent hover:bg-gray-800/80';
            }

            tbody.innerHTML += `
                <tr class="${rowClass}">
                    <td class="px-4 py-3 font-bold text-gray-200">${data.name} <br><span class="text-[9px] text-gray-500 font-mono tracking-wider">${actionKey}</span></td>
                    <td class="px-4 py-3 text-gray-400 font-mono">${data.baseCostTWD.toFixed(2)} <span class="text-[10px]">TWD</span></td>
                    <td class="px-4 py-3 text-indigo-400 font-mono font-bold">${suggested}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                            <input type="number" id="retail_${actionKey}" value="${retail}" onchange="adminApp.handleRetailChange('${actionKey}')" class="w-20 bg-gray-900 border border-gray-600 rounded p-1 text-white font-mono text-center focus:border-indigo-500 focus:outline-none text-sm">
                            <button onclick="adminApp.applySuggested('${actionKey}', ${suggested})" class="text-[10px] bg-indigo-600/20 text-indigo-400 px-2 py-1.5 rounded hover:bg-indigo-600 hover:text-white transition-colors font-bold border border-indigo-500/30 shadow-sm whitespace-nowrap">👉 套用</button>
                        </div>
                    </td>
                    <td class="px-4 py-3">
                        <div class="font-bold font-mono ${profitPoints < 0 ? 'text-red-400' : 'text-green-400'}">${profitPoints > 0 ? '+' : ''}${Math.round(profitPoints)} <span class="text-[10px]">點</span></div>
                        <div class="text-[10px] ${margin < 50 ? 'text-yellow-400' : 'text-gray-500'}">利潤率: ${margin.toFixed(1)}%</div>
                    </td>
                    <td class="px-4 py-3 flex justify-center items-center h-full">${statusHtml}</td>
                </tr>
            `;
        }
    },

    handleRetailChange(actionKey) {
        const input = document.getElementById(`retail_${actionKey}`);
        let val = parseInt(input.value) || 0;
        this.pricingConfig.actions[actionKey].retailPoints = val;
        this.updatePricingUI(); // 重新計算毛利
    },

    applySuggested(actionKey, suggestedValue) {
        this.pricingConfig.actions[actionKey].retailPoints = suggestedValue;
        this.updatePricingUI(); // 重新計算毛利
    },

    async savePricing() {
        try {
            this.pricingConfig.globalProfitMultiplier = parseFloat(document.getElementById('globalMultiplier').value);
            
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/admin/pricing`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.pricingConfig)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.message || 'API 未連線');
            
            alert('✅ 定價與毛利設定已成功儲存至資料庫！');
        } catch(e) {
            alert(`❌ 儲存失敗: ${e.message} \n\n(提示給總編：請確認您的 admin.controller.js 是否已經新增了 /api/admin/pricing 這個 API 路由！)`);
        }
    },

    // ==========================================
    // 📜 稽核日誌
    // ==========================================
    async fetchLogs() {
        const tbody = document.getElementById('logTableBody');
        if (!tbody) return; 
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-indigo-400 animate-pulse font-bold">📡 撈取系統日誌中...</td></tr>';
        
        try {
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
