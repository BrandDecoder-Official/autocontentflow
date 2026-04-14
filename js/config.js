// js/config.js

export const CONFIG = {
    CLOUD_RUN_URL: 'https://bd-autocontentflow-217800246535.asia-east1.run.app',
    GOOGLE_CLIENT_ID: '217800246535-tuc0olph401jjipa5hm34hq45h9jlq7j.apps.googleusercontent.com'
};

// ==========================================
// 🧠 全域基礎狀態管理 (State) - v9 極致瘦身版
// 漏斗狀態已全數移交 v9_state.js 的 MISSION 與 SYSTEM_DB 管理
// ==========================================
export const STATE = {
    globalAuthToken: '', // Google 登入的憑證 Token
    uid: '',             // 使用者的唯一 ID (Tenant ID)
    userPoints: 0        // 使用者目前的剩餘算力點數
};
