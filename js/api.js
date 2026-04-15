// js/api.js

import { CONFIG, STATE } from './config.js'; 

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

// 🚀 [新增] 4. 建立品牌人設 API
export async function createPersonaAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/create-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🚀 [新增] 5. 刪除品牌人設 API
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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) { throw new Error('無法連線到登入伺服器，請檢查網路或稍後再試'); }
}

// ==========================================
// 🚀 漏斗流程專屬 API (V9 新增)
// ==========================================

// ✍️ 8. 產生劇本草稿 API
export async function generateDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/task/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '產出劇本連線失敗');
    return data;
}

// 🎨 9. 發包影像合成 API
export async function generateImageFromDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/task/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '影像合成連線失敗');
    return data;
}

// 📤 10. 一鍵發佈與排程 API
export async function publishTaskAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/task/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '發佈連線失敗');
    return data;
}
