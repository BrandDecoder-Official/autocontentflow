// js/main.js
import { CONFIG, STATE } from './config.js';
import * as API from './api.js';

// 🚀 引入「真 AI Agent」核心引擎
import { bootSystemData, initAgentFunnel } from './agent_v9_core.js';
import { updatePointsDisplay } from './v9_ui.js';

// ==========================================
// 🛡️ 全域輔助函數
// ==========================================
window.getTenantIdFromToken = function() {
    if (!STATE.globalAuthToken) return 'test_user_001'; 
    try {
        const base64 = STATE.globalAuthToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
        return decoded.sub || decoded.email;
    } catch (e) { return 'test_user_001'; }
};

// ==========================================
// 🚀 系統入口：初始化與登入驗證
// ==========================================
window.onload = async function () {
    try {
        // 1. 初始化 Google 登入
        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID, 
            callback: async function(response) {
                const loginMsg = document.getElementById('loginMessage');
                if(loginMsg) loginMsg.innerHTML = '🔄 正在驗證...';
                
                try {
                    const result = await API.verifyLoginAPI(response.credential);
                    if (!result.success) throw new Error(result.message);
                    
                    if (result.status === 'PENDING') { 
                        if(loginMsg) loginMsg.innerHTML = `⏳ ${result.message}`; 
                        return; 
                    }
                    
                    if (result.status === 'ACTIVE') {
                        // 2. 寫入全域狀態
                        STATE.globalAuthToken = response.credential; 
                        STATE.uid = result.uid; // V9 架構使用 STATE.uid
                        STATE.userPoints = result.totalPoints || 0; 
                        
                        // 3. 切換畫面：隱藏登入，顯示主程式
                        const loginScreen = document.getElementById('loginScreen');
                        const app = document.getElementById('mainApp'); 
                        
                        if(loginScreen) loginScreen.classList.add('hidden');
                        if(app) {
                            app.classList.remove('hidden');
                            setTimeout(() => { app.classList.remove('opacity-0'); }, 100);
                        }
                        
                        // 4. 更新 UI 點數 (如果前端有這個元素的話)
                        updatePointsDisplay(STATE.userPoints, result.tier);

                        // 🚀 5. 進入全 Agent 時代：啟動 v9 核心大腦！
                        await bootSystemData();    // 載入人設、風格、定價等基因庫
                        await initAgentFunnel();   // 畫出大廳、漏斗與任務儀表板
                    }
                } catch (e) { 
                    if(loginMsg) loginMsg.innerHTML = `❌ 登入失敗：${e.message}`;
                    console.error("Login Error:", e);
                }
            }
        });
        
        // 渲染 Google 登入按鈕
        const btnDiv = document.getElementById("googleButtonDiv");
        if(btnDiv) {
            google.accounts.id.renderButton(btnDiv, { theme: "outline", size: "large", shape: "pill" });
        }
        
    } catch (loadErr) {
        console.error("Critical Load Error:", loadErr);
    }
};
