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
window.openLightbox = WorkflowMod.openLightbox;
window.closeLightbox = WorkflowMod.closeLightbox;

window.togglePublishMode = function(mode) { UI.togglePublishMode(mode); };
window.sendAiCommand = function(cmd) { /* 稍後實作 */ };

// 🌟 [新增] 真實攝影子模式與主模式切換連動
window.switchMode = function(isComic) {
    try {
        STATE.isComicModeActive = isComic; 
        
        const btnComic = document.getElementById('btnComicMode');
        const btnStandard = document.getElementById('btnStandardMode');
        const realSubOptions = document.getElementById('realModeSubOptions');
        const colorOptions = document.getElementById('colorModeContainer');
        const panelCountOptions = document.getElementById('panelCountContainer');
        const styleOptions = document.getElementById('styleOptionsWrapper');

        if (isComic) {
            btnComic?.classList.add('mode-active');
            btnStandard?.classList.remove('mode-active');
            realSubOptions?.classList.add('hidden');
            colorOptions?.classList.remove('hidden');
            panelCountOptions?.classList.remove('hidden');
            styleOptions?.classList.remove('hidden');
            STATE.currentAction = 'GENERATE_IMAGE'; 
            // 💡 若有快取資料則渲染
            if (window.renderDynamicOptions) window.renderDynamicOptions('ANIME');
        } else {
            btnStandard?.classList.add('mode-active');
            btnComic?.classList.remove('mode-active');
            realSubOptions?.classList.remove('hidden');
            colorOptions?.classList.add('hidden');
            panelCountOptions?.classList.add('hidden');
            styleOptions?.classList.add('hidden');
            
            // 預設切換到網紅模式
            window.setRealSubMode('INFLUENCER');
            if (window.renderDynamicOptions) window.renderDynamicOptions('REALISTIC');
        }
    } catch (err) {
        console.error("🚨 [switchMode] 發生錯誤:", err);
        showToast("切換模式時發生 UI 錯誤", "error");
    }
};

window.setRealSubMode = function(mode) {
    try {
        STATE.currentRealMode = mode;
        
        // 1. 更新計費標記 (對應 DB: 50/50/30)
        STATE.currentAction = (mode === 'ENHANCE') ? 'PHOTO_ENHANCEMENT' : `GENERATE_REAL_${mode}`;

        // 2. 更新 UI 樣式
        const subModes = ['Influencer', 'Supermodel', 'Enhance'];
        subModes.forEach(m => {
            const btn = document.getElementById(`btnReal${m}`);
            if (btn) {
                if (m.toUpperCase() === mode) {
                    btn.classList.add('real-submode-active', 'ring-2', 'ring-indigo-500');
                    btn.classList.remove('text-gray-400');
                } else {
                    btn.classList.remove('real-submode-active', 'ring-2', 'ring-indigo-500');
                    btn.classList.add('text-gray-400');
                }
            }
        });

        // 3. 更新描述與上傳按鈕文字
        const descMap = {
            'INFLUENCER': '📸 網紅模式：人為主，環境為輔，強調自然生活感。',
            'SUPERMODEL': '💎 超模展示：商品為主，人為輔，強調極致細節與棚拍感。',
            'ENHANCE': '✨ 原圖美化：不改變結構，僅針對光影與材質進行 AI 高級精修。'
        };
        const descEl = document.getElementById('realModeDesc');
        const uploadBtn = document.getElementById('btnUploadScene');
        if (descEl) descEl.innerText = descMap[mode];
        if (uploadBtn) uploadBtn.innerText = (mode === 'ENHANCE') ? '+ 上傳待美化原圖' : '+ 從相簿選擇背景圖';

        // 4. 通知導播間 (這裡 showLoading 設為 false，避免那個圈圈卡住)
        if (window.addAgentLog) {
            window.addAgentLog('導播間', '📽️', `模式已變更為：${mode === 'ENHANCE' ? '✨ 原圖美化' : '📸 真實攝影-' + mode}`, false);
        }
    } catch (err) {
        console.error("🚨 [setRealSubMode] 發生錯誤:", err);
        // 萬一報錯，確保 Loading 狀態被解除 (假設 addAgentLog 有處理邏輯)
        if (window.addAgentLog) window.addAgentLog('系統', '⚠️', '切換子模式失敗，請重新嘗試', false);
    }
};

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
            // 這些錯誤不重試，直接爆開
            if (errMsg.includes('INVALID_ARGUMENT') || errMsg.includes('auth') || attempt === maxRetries) throw error;
            
            const waitTime = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
            
            // 🌟 關鍵：這裡改用「非 Spinner」模式，避免圈圈無限疊加
            await window.addAgentLog(role, '🛡️', `連線異常：${errMsg}。預計 ${Math.round(waitTime/1000)} 秒後進行第 ${attempt + 1} 次嘗試...`, false);
            
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
};

// ==========================================
// 🚀 系統初始化 (Onload 加入錯誤邊界)
// ==========================================
window.onload = async function () {
    try {
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
                        TagsMod.initTags(); 
                        
                        setTimeout(async () => {
                            await window.addAgentLog('專案總監', '👨‍💼', '總編您好！BrandDecoder 工作室已就緒。');
                        }, 1000);
                    }
                } catch (e) { 
                    loginMsg.innerHTML = `❌ 登入失敗：${e.message}`;
                    console.error("Login Error:", e);
                }
            }
        });
        google.accounts.id.renderButton(document.getElementById("googleButtonDiv"), { theme: "outline", size: "large", shape: "pill" });
        
        // 2. 綁定表單送出事件
        const agentForm = document.getElementById('agentForm');
        if (agentForm) {
            agentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
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
                        await window.addAgentLog('美術總監', '⚠️', '偵測到參數缺失！請補齊「畫風」。', false);
                        return; 
                    }

                    STATE.pendingTaskPayload = { 
                        topic, 
                        selectedPlatforms,
                        mode: STATE.isComicModeActive ? 'COMIC' : STATE.currentRealMode,
                        action: STATE.currentAction 
                    };
                    
                    await window.addAgentLog('專案總監', '👨‍💼', '收到貼文任務！打包卷宗中...', true, document.getElementById('btnStep1Submit'));
                    await WorkflowMod.executeStep1Logic(STATE.pendingTaskPayload);
                } catch (submitErr) {
                    console.error("Submit Error:", submitErr);
                    showToast("發送任務失敗", "error");
                    // 強制重置按鈕
                    const btn = document.getElementById('btnStep1Submit');
                    if(btn) { btn.disabled = false; btn.innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本'; }
                }
            });
        }
    } catch (loadErr) {
        console.error("Critical Load Error:", loadErr);
    }
};
