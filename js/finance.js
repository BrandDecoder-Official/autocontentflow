// public/js/finance.js
import { STATE } from './config.js';
import * as API from './api.js';

/**
 * 🌟 純 UI 扣點動畫與餘額同步模組 (不重複呼叫扣款 API)
 * @param {HTMLElement} element - 觸發動畫的按鈕
 * @param {number} points - 舊版寫死的點數 (保留相容性)
 * @param {string} actionKey - 動作代碼 (例如 'GENERATE_IMAGE')，用來動態查價
 */
export async function showPointDeduction(element, points = null, actionKey = null) {
    if (!element) return;
    
    // 1. 動態查價：優先從全局定價表抓取最新售價
    let displayPoints = points;
    if (actionKey && STATE.globalPricing && STATE.globalPricing[actionKey]) {
        displayPoints = STATE.globalPricing[actionKey].retailPoints;
    }
    
    // 如果定價為 0，不播動畫
    if (!displayPoints || displayPoints <= 0) return;

    // 2. 播放華麗的扣點飄字動畫 (-XX ⚡)
    const rect = element.getBoundingClientRect();
    const floater = document.createElement('div');
    floater.className = 'fixed font-black text-red-500 z-[100] pointer-events-none text-lg transition-all duration-1000 ease-out';
    floater.innerHTML = `-${displayPoints} ⚡`;
    floater.style.left = `${rect.left + rect.width / 2 - 20}px`;
    floater.style.top = `${rect.top}px`;
    floater.style.textShadow = '0 2px 4px rgba(0,0,0,0.15)';
    document.body.appendChild(floater);

    requestAnimationFrame(() => {
        floater.style.transform = 'translateY(-40px)';
        floater.style.opacity = '0';
    });

    setTimeout(() => floater.remove(), 1000);

    // 3. 🛡️ 關鍵修正：去後端要一次最新的餘額，確保與資料庫同步
    try {
        const tenantId = window.getTenantIdFromToken();
        // 假設您有一個輕量級的查餘額 API (或直接用 verifyLoginAPI 偷抓)
        // 如果沒有這個 API，也可以暫時維持原本的前端減法：STATE.userPoints -= displayPoints;
        const res = await API.fetchTenantBalanceAPI(tenantId); 
        if (res && res.balance !== undefined) {
            STATE.userPoints = res.balance;
        } else {
            STATE.userPoints = Math.max(0, (STATE.userPoints || 0) - displayPoints);
        }
        
        if (typeof window.updatePointsDisplay === 'function') {
            window.updatePointsDisplay(STATE.userPoints);
        }
    } catch (e) {
        // 如果查不到，至少在前端先把數字減掉，維持 UI 感受
        STATE.userPoints = Math.max(0, (STATE.userPoints || 0) - displayPoints);
        if (typeof window.updatePointsDisplay === 'function') {
            window.updatePointsDisplay(STATE.userPoints);
        }
    }
}

export function toggleAuditLogDrawer() {
    const drawer = document.getElementById('auditLogDrawer');
    const overlay = document.getElementById('auditLogOverlay');
    const isOpen = !drawer.classList.contains('translate-x-full');

    if (isOpen) {
        drawer.classList.add('translate-x-full');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    } else {
        overlay.classList.remove('hidden');
        void overlay.offsetWidth; 
        overlay.classList.add('opacity-100');
        drawer.classList.remove('translate-x-full');
        
        document.getElementById('drawerBalanceDisplay').innerText = `${STATE.userPoints || 0} ⚡`;
        window.fetchAndRenderAuditLogs();
    }
}

export async function fetchAndRenderAuditLogs() {
    const contentBox = document.getElementById('auditLogContent');
    contentBox.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div><p class="text-sm font-bold">正在連線資料庫讀取中...</p></div>`;

    try {
        const tenantId = window.getTenantIdFromToken();
        const res = await window.executeWithRetry(() => API.fetchAuditLogsAPI(tenantId), '系統管理員', '讀取歷史卷宗');
        const realLogs = res.logs || [];

        if (realLogs.length === 0) {
            contentBox.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm font-bold">目前尚無任何花費紀錄。</div>`;
            return;
        }

        let html = '<div class="space-y-4">';
        realLogs.forEach(log => {
            let icon = '⚡'; let colorClass = 'bg-gray-100 text-gray-600';
            if(log.type === 'GENERATE_IMAGE') { icon = '🎨'; colorClass = 'bg-purple-100 text-purple-700'; }
            if(log.type === 'GENERATE_DRAFT') { icon = '✍️'; colorClass = 'bg-blue-100 text-blue-700'; }
            if(log.type === 'PUBLISH_POST') { icon = '🚀'; colorClass = 'bg-green-100 text-green-700'; }
            if(log.type === 'UPLOAD_IMAGE') { icon = '☁️'; colorClass = 'bg-emerald-100 text-emerald-700'; }
            if(log.type === 'CREATE_CHARACTER') { icon = '🧬'; colorClass = 'bg-pink-100 text-pink-700'; }

            const timeStr = new Date(log.createdAt).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
            html += `<div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"><div class="absolute left-0 top-0 bottom-0 w-1 ${colorClass.split(' ')[0].replace('100', '400')}"></div><div class="flex justify-between items-start mb-2 pl-2"><div class="flex items-center gap-2"><span class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-sm shadow-sm">${icon}</span><div><h4 class="text-sm font-bold text-gray-800">${log.description || '系統操作'}</h4><p class="text-xs text-gray-400 font-medium">${timeStr}</p></div></div><div class="text-right"><div class="text-base font-black ${log.amount > 0 ? 'text-red-500' : 'text-gray-500'}">${log.amount > 0 ? '-' : ''}${log.amount} ⚡</div><div class="text-[10px] text-gray-400 font-bold">結餘: ${log.balanceAfter}</div></div></div><div class="pl-12 pr-2 text-right"><span class="text-[10px] text-gray-300 font-mono tracking-wider">Tokens: ${log.metrics?.geminiTokensUsed || 0}</span></div></div>`;
        });
        html += '</div>';
        contentBox.innerHTML = html;
    } catch (e) {
        contentBox.innerHTML = `<div class="text-center text-red-500 mt-10 text-sm font-bold">讀取失敗：${e.message}</div>`;
    }
}
