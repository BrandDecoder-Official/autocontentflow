// js/api.js
import { CONFIG, STATE } from './config.js';

// 🌟 1. 修改：加入 tenantId 參數，透過 Query String 傳給後端撈取專屬角色
export async function fetchSystemOptionsAPI(tenantId = '') {
    const url = tenantId 
        ? `${CONFIG.CLOUD_RUN_URL}/api/system-options?tenantId=${tenantId}` 
        : `${CONFIG.CLOUD_RUN_URL}/api/system-options`;
    const response = await fetch(url);
    return response.json();
}

// 🌟 2. 新增：建立專屬角色 API (上傳圖片與基因)
export async function createCharacterAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/create-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🌟 3. 新增：刪除專屬角色 API (清理雲端與資料庫)
export async function deleteCharacterAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/delete-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// ==========================================
// 👇 以下為原有的發文與生圖流程 API (維持不變)
// ==========================================

export async function createDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function generateImageAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function publishContentAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function generateVideoAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/generate-interpolation-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// js/api.js
// ... 原本的其他 API (例如 generateDraftAPI) 保持不動 ...

/**
 * 🔐 傳送 Google 憑證到後端進行驗證與註冊
 */
export async function verifyLoginAPI(credential) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/auth/verify`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ credential })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API 呼叫錯誤 (verifyLoginAPI):', error);
        throw new Error('無法連線到登入伺服器，請檢查網路或稍後再試');
    }
}
