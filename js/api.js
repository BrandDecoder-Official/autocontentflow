// js/api.js
import { CONFIG, STATE } from './config.js'; 
import { updatePointsDisplay } from './v9_ui.js';

/**
 * ==========================================
 * 📌 函數名稱：triggerWalletSync
 * 💡 功能說明：全域錢包同步樞紐。向後端獲取最新算力，並同步派發給「右上角 UI」與「側邊欄 Log」。
 * 🚀 使用情境：被綁定在所有扣點 API (草稿、生圖、發布) 成功後背景靜默執行。徹底解決資料脫鉤。
 * ==========================================
 */
export async function triggerWalletSync() {
    if (!STATE.uid) return;
    try {
        const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/tenant/config?tenantId=${STATE.uid}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` }
        });
        const res = await response.json();
        if (res && res.tenant && res.tenant.totalPoints !== undefined) {
            updatePointsDisplay(res.tenant.totalPoints, res.tenant.tier);
            if (typeof window.refreshAuditLogs === 'function') {
                await window.refreshAuditLogs();
            }
        }
    } catch (e) {
        console.warn("全域錢包同步失敗 (不影響主程序)", e);
    }
}

// 🌟 1. 取得系統選項 (包含專屬角色與人設)
export async function fetchSystemOptionsAPI(tenantId = '') {
    const url = tenantId 
        ? `${CONFIG.CLOUD_RUN_URL}/api/system-options?tenantId=${tenantId}` 
        : `${CONFIG.CLOUD_RUN_URL}/api/system-options`;
    const response = await fetch(url);
    return response.json();
}

// 🌟 2. 建立專屬角色 API
export async function createCharacterAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/create-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🌟 3. 刪除專屬角色 API
export async function deleteCharacterAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/delete-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🚀 4. 建立品牌人設 API
export async function createPersonaAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/create-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🚀 5. 刪除品牌人設 API
export async function deletePersonaAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/delete-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🌟 6. 取得歷史卷宗與帳單 API
export async function fetchAuditLogsAPI(tenantId) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/logs?tenantId=${tenantId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '無法取得歷史紀錄');
    return data;
}

// 🌟 7. 身分驗證與註冊 API
export async function verifyLoginAPI(credential) {
    try {
        const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        if (!response.ok) {
            let errMsg = '登入憑證已失效';
            try {
                const errData = await response.json();
                if (errData && errData.message) errMsg = errData.message;
            } catch (e) {}
            const err = new Error(errMsg);
            err.status = response.status;
            throw err;
        }
        return await response.json();
    } catch (error) {
        if (error.status === 401 || error.status === 403 || error.message === '登入驗證失敗' || error.message === '登入憑證已失效' || error.message === '帳號異常或已被停權，請聯繫客服。') {
            throw error;
        }
        throw new Error('無法連線到登入伺服器，請檢查網路或稍後再試');
    }
}

// 🌟 新增：獲取租戶設定 (供錢包同步使用)
export async function getTenantConfigAPI(tenantId) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/tenant/config?tenantId=${tenantId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` }
    });
    return response.json();
}

// ==========================================
// 🚀 漏斗流程專屬 API (精準對接 backend content 路由)
// ==========================================

// ✍️ 8. 產生劇本草稿 API
export async function generateDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '產出劇本連線失敗');
    
    // 💸 攔截器同步：成功扣點後，背景觸發全站同步
    triggerWalletSync();
    return data;
}

// 🎨 9. 發包影像合成 API
export async function generateImageFromDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '影像合成連線失敗');
    
    // 💸 攔截器同步：成功扣點後，背景觸發全站同步
    triggerWalletSync();
    return data;
}

// 📤 10. 一鍵發佈與排程 API
export async function publishTaskAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '發佈連線失敗');
    
    // 💸 攔截器同步：成功扣點後，背景觸發全站同步
    triggerWalletSync();
    return data;
}

// 🚀 11. 建立全新代理人任務 API (V10 漏斗專用)
export async function createAgentTaskAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/agent/tasks`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '任務建檔失敗');
    return data;
}

// 🗑️ 12. [新增] 刪除指定任務 API
export async function deleteAgentTaskAPI(taskId) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/agent/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '刪除任務失敗');
    return data;
}

// 🚀 13. [新增] 參考圖多模態分析與創意推薦 API
export async function analyzeReferencesAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/analyze-references`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '分析參考圖失敗');
    triggerWalletSync();
    return data;
}
