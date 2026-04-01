// js/api.js
// 🌟 修正：補上 STATE 的引入，確保能抓到 globalAuthToken
import { CONFIG, STATE } from './config.js'; 

// 🌟 1. 取得系統選項 (包含專屬角色)
export async function fetchSystemOptionsAPI(tenantId = '') {
    const url = tenantId 
        ? `${CONFIG.CLOUD_RUN_URL}/api/system-options?tenantId=${tenantId}` 
        : `${CONFIG.CLOUD_RUN_URL}/api/system-options`;
    const response = await fetch(url);
    return response.json();
}

// 🌟 2. 建立專屬角色 API (上傳圖片與基因)
export async function createCharacterAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/create-character`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🌟 3. 刪除專屬角色 API (清理雲端與資料庫)
export async function deleteCharacterAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/delete-character`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// ==========================================
// 🚀 核心流程 API (發文、生圖、發布)
// ==========================================

export async function createDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/draft`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🌟 這裡會自動把前端包裝好的多圖陣列 (incomingImages) 送往後端
export async function generateImageAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/generate`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function publishContentAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/publish`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function generateVideoAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/generate-interpolation-video`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            // 視後端需求，決定是否需要加上 Authorization
            // 'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// ==========================================
// 🔐 身分驗證與註冊 API
// ==========================================
export async function verifyLoginAPI(credential) {
    try {
        const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/auth/verify`, {
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
