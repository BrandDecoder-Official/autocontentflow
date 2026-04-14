// js/api.js
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

// 🌟 4. 產生動態影片 API (保留給影音引擎用)
export async function generateVideoAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/generate-interpolation-video`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
    });
    return response.json();
}

// 🌟 5. 取得歷史卷宗與帳單 API
export async function fetchAuditLogsAPI(tenantId) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/logs?tenantId=${tenantId}`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '無法取得歷史紀錄');
    return data;
}

// 🌟 6. 身分驗證與註冊 API
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

// 🌟 7. AI 魔法濃縮 API (保留特殊處理用)
export async function compressComicPanelsAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/compress`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${STATE.globalAuthToken}` 
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
    return response.json();
}
