// js/main.js
import { CONFIG, STATE } from './config.js';
import { showToast } from './utils.js'; 
import * as API from './api.js';
import * as UI from './ui.js';
import './agent.js'; 

// 📦 匯入我們切好的模組
import * as TagsMod from './tags.js';
import * as FinanceMod from './finance.js';
import * as WorkflowMod from './workflow.js';

// ==========================================
// 🔗 綁定全域函數 (讓 index.html 裡的 onclick 能抓到)
// ==========================================
window.toggleSection = UI.toggleSection;
window.previewCharImage = UI.previewCharImage;
window.openCreateCharModal = UI.openCreateCharModal;
window.closeCreateCharModal = UI.closeCreateCharModal;

window.renderTagChips = TagsMod.renderTagChips;
window.removeTag = TagsMod.removeTag;

window.showPointDeduction = FinanceMod.showPointDeduction;
window.toggleAuditLogDrawer = FinanceMod.toggleAuditLogDrawer;
window.fetchAndRenderAuditLogs = FinanceMod.fetchAndRenderAuditLogs;

window.setAppMode = WorkflowMod.setAppMode;
window.backToStep1 = WorkflowMod.backToStep1;
window.backToStep2 = WorkflowMod.backToStep2;
window.resetToStep1 = WorkflowMod.resetToStep1;
window.initSystemData = WorkflowMod.initSystemData;
window.addCharacterFromDB = WorkflowMod.addCharacterFromDB;
window.removeCharFromList = WorkflowMod.removeCharFromList;
window.submitNewCharacter = WorkflowMod.submitNewCharacter;
window.submitForImageGeneration = WorkflowMod.submitForImageGeneration;
window.retrySingleImage = WorkflowMod.retrySingleImage;
window.publishToSocial = WorkflowMod.publishToSocial;
window.resumeTaskWithStyle = WorkflowMod.resumeTaskWithStyle;
// ✅ 新增這兩行綁定 Lightbox
window.openLightbox = WorkflowMod.openLightbox;
window.closeLightbox = WorkflowMod.closeLightbox;

// ==========================================
// 🛡️ 全域工具函數
// ==========================================
window.getTenantIdFromToken = function() {
    if (!STATE.globalAuthToken) return 'test_user_001'; 
    try {
        const base64 = STATE.globalAuthToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
        return decoded.sub || decoded.email;
    } catch (e) { return 'test_user_001'; }
};

window.executeWithRetry = async function(apiCallFn, role, actionName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await apiCallFn();
            if (!result || !result.success) throw new Error(result?.message || '未知錯誤');
            return result;
        } catch (error) {
            const errMsg = error.message || String(error);
            if (errMsg.includes('INVALID_ARGUMENT') || errMsg.includes('auth') || attempt === maxRetries) throw error;
            const waitTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
            await window.addAgentLog(role, '🛡️', `偵測到「${actionName}」擁塞，重試中... (${Math.round(waitTime/1000)}秒)`, true, window.LAST_CLICKED_EL);
            await window.sleep(waitTime);
        }
    }
};

// ==========================================
// 🚀 系統初始化 (Onload)
// ==========================================
window.onload = async function () {
    // 1. 初始化 Google 登入
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID, 
        callback: async function(response) {
            const loginMsg = document.getElementById('loginMessage');
            loginMsg.innerHTML = '🔄 正在驗證...';
            try {
                const result = await API.verifyLoginAPI(response.credential);
                if (!result.success) throw new Error(result.message);
                if (result.status === 'PENDING') { loginMsg.innerHTML = `⏳ ${result.message}`; return; }
                
                if (result.status === 'ACTIVE') {
                    STATE.globalAuthToken = response.credential; STATE.tenantUid = result.uid; 
                    STATE.userPoints = result.totalPoints || 0; 
                    
                    document.getElementById('loginScreen').classList.add('hidden');
                    const app = document.getElementById('mainApp'); app.classList.remove('hidden');
                    setTimeout(() => { app.classList.remove('opacity-0'); }, 100);
                    
                    showToast(`✅ 登入成功！`, 'success');
                    if (typeof window.updatePointsDisplay === 'function') window.updatePointsDisplay(STATE.userPoints);

                    await window.initSystemData(); 
                    window.initAgentCapsule();
                    window.initInteractions(); 
                    TagsMod.initTags(); // 🌟 啟動標籤引擎監聽
                    
                    setTimeout(async () => {
                        await window.addAgentLog('專案總監', '👨‍💼', '總編您好！BrandDecoder 工作室已就緒。');
                    }, 1000);
                }
            } catch (e) { loginMsg.innerHTML = `❌ 登入失敗：${e.message}`; }
        }
    });
    google.accounts.id.renderButton(document.getElementById("googleButtonDiv"), { theme: "outline", size: "large", shape: "pill" });
    
    // 2. 綁定表單送出事件 (Step 1)
    const agentForm = document.getElementById('agentForm');
    if (agentForm) {
        agentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const topicInput = document.getElementById('topic'); 
            const topic = topicInput.value.trim();
            if (!topic) return showToast('❌ 請輸入主題！', 'error');

            const selectedPlatforms = [];
            if(document.getElementById('platFB')?.checked) selectedPlatforms.push('FB');
            if(document.getElementById('platIG')?.checked) selectedPlatforms.push('IG');
            if(document.getElementById('platThreads')?.checked) selectedPlatforms.push('THREADS');
            if(selectedPlatforms.length === 0) return showToast('❌ 請至少勾選一個平台！', 'error');

            const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
            if (STATE.isComicModeActive && !selectedStyleId) {
                await window.addAgentLog('美術總監', '⚠️', '偵測到參數缺失！請補齊「畫風」。', true);
                STATE.pendingTaskPayload = { topic, selectedPlatforms };
                return; 
            }

            STATE.pendingTaskPayload = { topic, selectedPlatforms };
            await window.addAgentLog('專案總監', '👨‍💼', '收到貼文任務！打包卷宗中...', true, document.getElementById('btnStep1Submit'));
            await WorkflowMod.executeStep1Logic(STATE.pendingTaskPayload);
        });
    }
};
