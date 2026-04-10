// js/main.js
import { CONFIG, STATE } from './config.js';
import { showToast } from './utils.js'; 
import * as API from './api.js';
import * as UI from './ui.js';

import { compressImageToBase64 } from './image.js';
import './agent.js'; 

window.toggleSection = UI.toggleSection;
window.previewCharImage = UI.previewCharImage;
window.openCreateCharModal = UI.openCreateCharModal;
window.closeCreateCharModal = UI.closeCreateCharModal;

// ==========================================
// 📸 動態模式切換 (漫畫 vs 真實攝影)
// ==========================================
window.setAppMode = async function(mode) {
    STATE.isComicModeActive = (mode === 'manga');
    
    // 請確認 HTML 中有對應的 ID，若無可自行調整
    const styleSection = document.getElementById('style-selector-area'); 
    const charLibrary = document.getElementById('character-library-area');
    const photoOptions = document.getElementById('photo-mode-options');

    if (mode === 'photo') {
        if(styleSection) styleSection.classList.add('hidden');
        if(charLibrary) charLibrary.classList.add('hidden');
        if(photoOptions) photoOptions.classList.remove('hidden');
        await window.addAgentLog('美術總監', '📸', '已切換至「真實攝影模式」。請選擇您的拍攝主題：網美拍照 或 商品展示。');
    } else {
        if(styleSection) styleSection.classList.remove('hidden');
        if(charLibrary) charLibrary.classList.remove('hidden');
        if(photoOptions) photoOptions.classList.add('hidden');
        await window.addAgentLog('美術總監', '🎨', '已切換至「漫畫連載模式」。請挑選您喜愛的畫風！');
    }
};

// ==========================================
// 📜 歷史卷宗抽屜 UI 引擎
// ==========================================
window.toggleAuditLogDrawer = function() {
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
};

window.fetchAndRenderAuditLogs = async function() {
    const contentBox = document.getElementById('auditLogContent');
    contentBox.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-gray-400">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
            <p class="text-sm font-bold">正在連線資料庫讀取中...</p>
        </div>`;

    try {
        const tenantId = getTenantIdFromToken();
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

            html += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div class="absolute left-0 top-0 bottom-0 w-1 ${colorClass.split(' ')[0].replace('100', '400')}"></div>
                    <div class="flex justify-between items-start mb-2 pl-2">
                        <div class="flex items-center gap-2">
                            <span class="w-8 h-8 rounded-full ${colorClass} flex items-center justify-center text-sm shadow-sm">${icon}</span>
                            <div>
                                <h4 class="text-sm font-bold text-gray-800">${log.description || '系統操作'}</h4>
                                <p class="text-xs text-gray-400 font-medium">${timeStr}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-base font-black ${log.amount > 0 ? 'text-red-500' : 'text-gray-500'}">${log.amount > 0 ? '-' : ''}${log.amount} ⚡</div>
                            <div class="text-[10px] text-gray-400 font-bold">結餘: ${log.balanceAfter}</div>
                        </div>
                    </div>
                    <div class="pl-12 pr-2 text-right">
                         <span class="text-[10px] text-gray-300 font-mono tracking-wider">Tokens: ${log.metrics?.geminiTokensUsed || 0}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        contentBox.innerHTML = html;

    } catch (e) {
        contentBox.innerHTML = `<div class="text-center text-red-500 mt-10 text-sm font-bold">讀取失敗：${e.message}</div>`;
    }
};

// ==========================================
// 💸 微型計費系統：浮動扣點特效與餘額更新
// ==========================================
window.showPointDeduction = function(element, points) {
    if (!element || points <= 0) return;
    
    STATE.userPoints = Math.max(0, (STATE.userPoints || 0) - points);
    if (typeof window.updatePointsDisplay === 'function') {
        window.updatePointsDisplay(STATE.userPoints);
    }

    const rect = element.getBoundingClientRect();
    const floater = document.createElement('div');
    floater.className = 'fixed font-black text-red-500 z-[100] pointer-events-none text-lg transition-all duration-1000 ease-out';
    floater.innerHTML = `-${points} ⚡`;
    floater.style.left = `${rect.left + rect.width / 2 - 20}px`;
    floater.style.top = `${rect.top}px`;
    floater.style.textShadow = '0 2px 4px rgba(0,0,0,0.15)';
    document.body.appendChild(floater);

    requestAnimationFrame(() => {
        floater.style.transform = 'translateY(-40px)';
        floater.style.opacity = '0';
    });

    setTimeout(() => floater.remove(), 1000);
};

// ==========================================
// 🛡️ 全域防禦機制：自動重試引擎
// ==========================================
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
            await window.addAgentLog(role, '🛡️', `偵測到「${actionName}」擁塞，系統已自動啟動修復與重試機制... (${Math.round(waitTime/1000)}秒)`, true, window.LAST_CLICKED_EL);
            await window.sleep(waitTime);
        }
    }
};

function getTenantIdFromToken() {
    if (!STATE.globalAuthToken) return 'test_user_001'; 
    try {
        const base64 = STATE.globalAuthToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
        return decoded.sub || decoded.email;
    } catch (e) { return 'test_user_001'; }
}

window.backToStep1 = () => { document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step1-setup').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
window.backToStep2 = () => { document.getElementById('step3-publish').classList.add('hidden'); document.getElementById('step2-review').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

window.resetToStep1 = () => {
    document.getElementById('step3-publish').classList.add('hidden'); document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step1-setup').classList.remove('hidden');
    STATE.currentTaskId = null; STATE.multiImages = []; document.getElementById('agentForm').reset();
    document.getElementById('characterList').innerHTML = ''; document.getElementById('scenePreview').innerHTML = ''; document.getElementById('objectPreview').innerHTML = '';
    
    STATE.sceneFiles = [];
    STATE.objectFiles = [];

    window.resetAgentConsole();
    setTimeout(async () => { await window.addAgentLog('專案總監', '👨‍💼', '任務已重置，全新的卷宗已就緒！'); }, 500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.initSystemData = async function() {
    try {
        const tenantId = getTenantIdFromToken();
        const res = await window.executeWithRetry(() => API.fetchSystemOptionsAPI(tenantId), '系統管理員', '載入資料庫');
        STATE.globalSystemStyles = res.data.styles || [];
        
        try {
            if (API.fetchSystemPricingAPI) {
                const priceRes = await window.executeWithRetry(() => API.fetchSystemPricingAPI(), '財務總監', '載入即時牌價');
                if (priceRes && priceRes.data) {
                    STATE.globalPricing = priceRes.data.actions; 
                }
            }
        } catch (priceErr) {
            console.warn("⚠️ 動態定價載入失敗，將使用預設點數");
        }

        if (typeof UI.renderDynamicOptions === 'function') UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', res.data);
    } catch (error) { showToast('❌ 資料庫連線失敗', 'error'); }
};

window.addCharacterFromDB = async (dbChar) => {
    const targetButton = window.LAST_CLICKED_EL;
    const list = document.getElementById('characterList');
    if (list.children.length >= 4) return showToast('❌ 最多 4 位角色！', 'error');
    const item = document.createElement('div');
    item.className = 'char-item relative animate-fade-in flex items-start gap-3 bg-white p-3 border border-blue-200 rounded-xl shadow-sm mb-3 group'; 
    item.innerHTML = `
        <button type="button" onclick="window.removeCharFromList('${dbChar.name}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-sm z-10">&times;</button>
        <img src="${dbChar.imageUrl || ''}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-100 flex-shrink-0 shadow-sm">
        <div class="flex-grow">
            <div class="flex items-center mb-1.5"><span class="font-black text-gray-800 text-sm mr-2">${dbChar.name}</span><span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">🔒 基因鎖定</span></div>
            <input type="hidden" name="charName" value="${dbChar.name}">
            <input type="hidden" class="char-db-features" value="${dbChar.aiExtractedFeatures || ''}">
            <input type="hidden" class="char-image-url" value="${dbChar.imageUrl || ''}">
            <input type="text" name="charPersona" class="w-full p-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 focus:bg-white transition-colors" placeholder="可在此微調服裝/表情" value="${dbChar.persona || ''}">
        </div>`;
    list.appendChild(item);
    showToast(`✅ 已讓 ${dbChar.name} 進入候場區！`, 'success');
    if (typeof window.addAgentLog === 'function') await window.addAgentLog('視覺工程師', '👁️', `成功捕獲「${dbChar.name}」的視覺基因！`, false, targetButton);
};

window.removeCharFromList = async function(charName) {
    const targetButton = window.LAST_CLICKED_EL;
    const item = targetButton.closest('.char-item');
    await window.addAgentLog('視覺工程師', '👁️', `已釋放「${charName}」的視覺基因。`, false, targetButton);
    if(item) item.remove();
};

window.submitNewCharacter = async function() {
    const name = document.getElementById('newCharName').value.trim();
    const fileInput = document.getElementById('newCharImage');
    const targetButton = window.LAST_CLICKED_EL;
    if (!name || !fileInput.files?.[0]) return showToast('❌ 請填寫名稱與圖片', 'error');
    
    const btn = document.getElementById('btnSubmitNewChar');
    btn.disabled = true; btn.innerHTML = '🧬 基因掃描中...';
    try {
        const base64Info = await compressImageToBase64(fileInput.files[0], 800, false);
        const res = await window.executeWithRetry(() => API.createCharacterAPI({ name, imageBase64: base64Info.data, mimeType: base64Info.mimeType, tenantId: getTenantIdFromToken() }), '視覺工程師', '基因寫入');
        
        showToast(res.message, 'success'); 
        
        const charCost = STATE.globalPricing?.CREATE_CHARACTER?.retailPoints ?? 5;
        window.showPointDeduction(btn, charCost); 
        if (typeof window.addAgentLog === 'function') await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${charCost} 點)`, false, targetButton);
        
        UI.closeCreateCharModal(); 
        await window.initSystemData();
        if (typeof window.addAgentLog === 'function') await window.addAgentLog('視覺工程師', '🧬', `新角色「${name}」的基因已登錄雲端。`, false, targetButton);
    } catch(e) { showToast(`❌ 建立失敗: ${e.message}`, 'error'); } finally { btn.disabled = false; btn.innerHTML = '🧬 開始基因掃描'; }
};

window.deleteChar = async function(charId) {
    if (!confirm('⚠️ 永久刪除角色？')) return;
    const targetButton = window.LAST_CLICKED_EL; 
    try {
        await window.executeWithRetry(() => API.deleteCharacterAPI({ charId, tenantId: getTenantIdFromToken() }), '系統管理員', '清理雲端');
        showToast('✅ 已刪除！', 'success'); 
        await window.initSystemData();
        if (typeof window.addAgentLog === 'function') await window.addAgentLog('系統管理員', '🗑️', `已將該角色的視覺基因徹底抹除！`, false, targetButton);
    } catch(e) { showToast(`❌ 失敗: ${e.message}`, 'error'); }
};

window.onload = async function () {
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID, 
        callback: async function(response) {
            const loginMsg = document.getElementById('loginMessage');
            loginMsg.innerHTML = '🔄 正在驗證...';
            try {
                const result = await API.verifyLoginAPI(response.credential);
                if (!result.success) throw new Error(result.message);
                if (result.status === 'PENDING') {
                    loginMsg.innerHTML = `⏳ ${result.message}`; return; 
                }
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
                    setTimeout(async () => {
                        await window.addAgentLog('專案總監', '👨‍💼', '總編您好！BrandDecoder 工作室已就緒。');
                        await window.addAgentLog('社群總監', '🚀', '請先為我們勾選發布平台戰場！');
                    }, 1000);
                }
            } catch (e) { loginMsg.innerHTML = `❌ 登入失敗：${e.message}`; }
        }
    });
    google.accounts.id.renderButton(document.getElementById("googleButtonDiv"), { theme: "outline", size: "large", shape: "pill" });
    
    window.addEventListener('resize', () => {
        const consoleEl = document.getElementById('aiTeamConsole');
        if (!consoleEl) return;
        const logEl = document.getElementById('aiTeamConsoleLog');
        const preview = document.getElementById('aiCapsulePreview');
        if (window.innerWidth >= 1024) {
            if(logEl) logEl.classList.remove('hidden');
            if(preview) preview.classList.add('hidden');
        } else {
            if(consoleEl.dataset.capsuleInit === 'true') {
                if(logEl) logEl.classList.add('hidden');
                if(preview) preview.classList.remove('hidden');
                document.getElementById('capsuleToggleIcon').innerText = '👇';
            }
        }
    });
};

// ==========================================
// 🚀 核心流程 Step 1：AI 撰寫腳本
// ==========================================

window.resumeTaskWithStyle = async function(styleId) {
    const radio = document.querySelector(`input[name="targetStyle"][value="${styleId}"]`);
    if(radio) radio.checked = true;

    const styleName = STATE.globalSystemStyles.find(s => s.id === styleId)?.name || '未知風格';
    await window.addAgentLog('專案總監', '👨‍💼', `收到！已幫您補齊畫風參數：【${styleName}】。正在重啟工廠管線...`, true);
    
    if (STATE.pendingTaskPayload) {
        await executeStep1Logic(STATE.pendingTaskPayload);
    }
};

document.getElementById('agentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const topicInput = document.getElementById('topic'); 
    const topic = topicInput.value.trim();
    if (!topic) return showToast('❌ 請輸入主題！', 'error');

    const selectedPlatforms = [];
    if(document.getElementById('platFB')?.checked) selectedPlatforms.push('FB');
    if(document.getElementById('platIG')?.checked) selectedPlatforms.push('IG');
    if(document.getElementById('platThreads')?.checked) selectedPlatforms.push('THREADS');
    if(selectedPlatforms.length === 0) return showToast('❌ 請至少勾選一個平台！', 'error');

    // 檢查風格 (如果是漫畫模式才需要強制選畫風，攝影模式由系統接管)
    const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;

    if (STATE.isComicModeActive && !selectedStyleId) {
        await window.addAgentLog('專案總監', '👨‍💼', '收到任務！正在解析參數...', true, topicInput);
        await window.addAgentLog('美術總監', '⚠️', '報告總編，偵測到關鍵參數缺失！您還沒選擇「畫風」。請直接點擊下方按鈕補齊：', true);
        
        STATE.pendingTaskPayload = { topic, selectedPlatforms };

        const logContainer = document.getElementById('aiTeamConsoleLog');
        if (logContainer && STATE.globalSystemStyles) {
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'ml-8 mt-1 mb-2 animate-fade-in flex flex-wrap gap-1.5';
            
            STATE.globalSystemStyles.forEach(s => {
                const currentMode = 'ANIME';
                if (s.category === currentMode || s.category === 'ALL') {
                    optionsDiv.innerHTML += `<button type="button" onclick="window.resumeTaskWithStyle('${s.id}')" class="bg-indigo-600/20 hover:bg-indigo-500 text-indigo-400 hover:text-white px-3 py-1.5 rounded text-xs font-bold border border-indigo-500/50 transition-colors shadow-sm">${s.name}</button>`;
                }
            });
            logContainer.appendChild(optionsDiv);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        return; 
    }

    STATE.pendingTaskPayload = { topic, selectedPlatforms };
    await window.addAgentLog('專案總監', '👨‍💼', '收到貼文任務！正在打包卷宗並解析平台設定...', true, document.getElementById('btnStep1Submit'));
    await executeStep1Logic(STATE.pendingTaskPayload);
});

async function executeStep1Logic(payloadData) {
    const btnSubmit = document.getElementById('btnStep1Submit');
    const publishBtn = document.getElementById('btnPublish');
    if(publishBtn) { publishBtn.disabled = false; publishBtn.innerHTML = '🚀 立刻發射！'; }

    btnSubmit.disabled = true; btnSubmit.classList.replace('bg-blue-600', 'bg-gray-500');
    document.getElementById('btnTextStep1').innerHTML = '⚡ 執行中，請看右側進度...';

    try {
        let promptStyle = '', negativeStyle = '', styleName = '預設風格';
        
        // 攝影模式由系統動態組裝 Style Prompt
        if (!STATE.isComicModeActive) {
            const photoModeType = document.querySelector('input[name="photoMode"]:checked')?.value || 'BEAUTY';
            if (photoModeType === 'BEAUTY') {
                promptStyle = 'Instagram influencer photography style. Beautiful face, soft aesthetic lighting, shallow depth of field, stunning background.';
                styleName = '網美拍照模式';
            } else {
                promptStyle = 'Commercial product photography. Studio lighting, crisp details, high-end presentation, minimalist background.';
                styleName = '商品展示模式';
            }
        } else {
            // 漫畫模式依照選擇的畫風
            const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
            if (selectedStyleId && STATE.globalSystemStyles) {
                const obj = STATE.globalSystemStyles.find(s => s.id === selectedStyleId);
                if (obj) { promptStyle = obj.promptPrefix; negativeStyle = obj.negativePrompt; styleName = obj.name; }
            }
        }
        STATE.currentStyleName = styleName;

        const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'COLOR';
        const payload = {
            tenantId: getTenantIdFromToken(), platforms: payloadData.selectedPlatforms, topic: payloadData.topic, isComicMode: STATE.isComicModeActive,
            colorMode: colorMode, aspectRatio: document.getElementById('aspectRatioSelect').value, style: promptStyle,             
            negativePrompt: negativeStyle, resolution: document.getElementById('resolutionSelect').value, comicCharacters: [], image_options: { referenceImages: [] }
        };

        if (STATE.isComicModeActive) {
            const charItems = document.querySelectorAll('#characterList .char-item');
            if (charItems.length > 0) await window.addAgentLog('視覺工程師', '👁️', `正在轉換 ${charItems.length} 位角色的 AI 基因參數...`, true);
            charItems.forEach(item => {
                const name = item.querySelector('[name="charName"]')?.value;
                if (name) {
                    payload.comicCharacters.push({ name, persona: item.querySelector('[name="charPersona"]')?.value, aiExtractedFeatures: item.querySelector('.char-db-features')?.value });
                    const url = item.querySelector('.char-image-url')?.value;
                    if (url) payload.image_options.referenceImages.push({ type: 'character', name, imageUrl: url });
                }
            });
        }

        if (STATE.sceneFiles && STATE.sceneFiles.length > 0) {
            await window.addAgentLog('影像處理組', '📐', `偵測到 ${STATE.sceneFiles.length} 張背景圖，特徵分析中...`, true);
            for (let file of STATE.sceneFiles) {
                const b64 = await compressImageToBase64(file, 600, colorMode === 'BW');
                if (b64) payload.image_options.referenceImages.push({ type: 'scene_background', ...b64 });
            }
        }
        if (STATE.objectFiles && STATE.objectFiles.length > 0) {
            await window.addAgentLog('影像處理組', '🍔', `偵測到 ${STATE.objectFiles.length} 張道具圖，特徵分析中...`, true);
            for (let file of STATE.objectFiles) {
                const b64 = await compressImageToBase64(file, 600, colorMode === 'BW');
                if (b64) payload.image_options.referenceImages.push({ type: 'scene_object', ...b64 });
            }
        }

        await window.addAgentLog('首席文案', '✍️', '正在與大腦連線撰寫腳本...', true);
        const result = await window.executeWithRetry(() => API.createDraftAPI(payload), '首席文案', '腳本連線');
        
        const draftCost = STATE.globalPricing?.GENERATE_DRAFT?.retailPoints ?? 10;
        window.showPointDeduction(btnSubmit, draftCost); 
        await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${draftCost} 點)`, false);
        await window.addAgentLog('系統管理員', '⚙️', '草稿接收成功！渲染排版中...', false);
        
        STATE.currentTaskId = result.taskId; 
        
        // 🌟 最關鍵的商業邏輯：無論如何，AI 陣列裡只初始化「唯一一張圖」！
        STATE.multiImages = [{ id: `cover_${Date.now()}`, originalUrl: '', processType: 'AI_SYNTHESIS' }];
        
        document.getElementById('step1-setup').classList.add('hidden');
        document.getElementById('step2-review').classList.remove('hidden');
        document.getElementById('step2StyleBadge').innerText = `🎨 模式：${STATE.currentStyleName}`;
        document.getElementById('reviewCaption').value = result.draftContent.post_caption;
        
        // 渲染腳本與動態格數選擇器
        const panContainer = document.getElementById('reviewPanelsContainer');
        if (result.isComicMode && result.draftContent.panels) {
            panContainer.classList.remove('hidden');
            let html = `
                <div class="flex justify-between items-end mb-2">
                    <label class="block text-sm font-bold text-gray-700">🎬 分鏡腳本確認</label>
                    <select id="panelCountSelect" class="text-xs border border-gray-300 rounded p-1 bg-white font-bold text-indigo-600 shadow-sm" onchange="window.updatePanelVisibility()">
                        <option value="1">生成 1 格 (最高品質)</option>
                        <option value="2">生成 2 格</option>
                        <option value="3">生成 3 格</option>
                        <option value="4" selected>生成 4 格 (標準連載)</option>
                    </select>
                </div>
                <div id="panelsWrapper">
            `;
            
            result.draftContent.panels.slice(0, 4).forEach(p => {
                html += `<div class="panel-item mb-4 p-4 bg-white rounded-xl shadow-sm transition-all" data-panel="${p.panel_number}">
                    <p class="text-xs text-gray-500 font-bold mb-1">🎥 ${p.action_zh || p.action_en || '場景'}</p>
                    <textarea id="panel_${p.panel_number}" class="w-full p-2 bg-gray-50 border rounded-lg text-sm cursor-text focus:ring-2 focus:ring-indigo-300 transition-shadow">${p.dialogue}</textarea>
                </div>`;
            });
            html += `</div>`;
            panContainer.innerHTML = html;

            // 註冊切換顯示的函數
            window.updatePanelVisibility = function() {
                const count = parseInt(document.getElementById('panelCountSelect').value);
                document.querySelectorAll('.panel-item').forEach((el, index) => {
                    el.style.display = index < count ? 'block' : 'none';
                });
            };
            window.updatePanelVisibility(); // 初始化顯示
        } else {
            panContainer.classList.add('hidden');
        }
        
        showToast('✅ 腳本生成完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('專案總監', '⏸️', '腳本已就緒，您可以透過下拉選單決定這張圖要畫幾格，確認後即可發包。');
    } catch (e) { 
        await window.addAgentLog('系統警報', '🚨', `發生錯誤: ${e.message}`); 
        showToast(`❌ 錯誤: ${e.message}`, 'error'); 
    } finally { 
        btnSubmit.disabled = false; btnSubmit.classList.replace('bg-gray-500', 'bg-blue-600'); 
        document.getElementById('btnTextStep1').innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本'; 
    }
}

// ==========================================
// 🎨 Step 2：發包生圖 (嚴格單張合成 + 鷹眼重抽)
// ==========================================
window.submitForImageGeneration = async function() {
    const btn = document.getElementById('btnStep2Submit');
    if (!STATE.multiImages?.length) return showToast('❌ 需要至少 1 張圖片！', 'error');

    const editedPanels = [];
    if (STATE.isComicModeActive) {
        // 🌟 核心邏輯：只抓取畫面上「有顯示」的 textarea 來生成圖片
        const textareas = document.querySelectorAll('.panel-item[style*="display: block"] textarea, .panel-item:not([style*="display: none"]) textarea');
        textareas.forEach(ta => {
            const panelNum = parseInt(ta.id.split('_')[1]);
            editedPanels.push({ panel_number: panelNum, dialogue: ta.value });
        });
    }

    btn.disabled = true; btn.classList.replace('bg-indigo-600', 'bg-gray-500');
    btn.innerHTML = '🎨 執行中...'; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await window.addAgentLog('美術總監', '👨‍🎨', '收到發包指令！我們將為您生成【1 張】極致的合成美圖，其餘格位請放心地保留給您上傳的真實照片。', true, btn);

    try {
        const aiCount = 1; // 永遠只算一張的錢
        const imageCost = STATE.globalPricing?.GENERATE_IMAGE?.retailPoints ?? 20;
        const totalCost = aiCount * imageCost; 
        
        await window.addAgentLog('算圖農場', '🤖', `極速渲染中，請稍候...`, true);

        const res = await window.executeWithRetry(() => API.generateImageAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: getTenantIdFromToken(), 
            editedCaption: document.getElementById('reviewCaption').value, 
            editedPanels, 
            incomingImages: STATE.multiImages.map(img => ({ processType: img.processType, originalUrl: img.originalUrl })) 
        }), '算圖農場', '雲端算圖');
        
        if (totalCost > 0) {
            window.showPointDeduction(btn, totalCost); 
            await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${totalCost} 點)`, false);
        }
        
        document.getElementById('step2-review').classList.add('hidden');
        document.getElementById('step3-publish').classList.remove('hidden');
        document.getElementById('step3StyleBadge').innerText = `🎨 模式：${STATE.currentStyleName}`;
        
        const finalContainer = document.getElementById('finalImageContainer');
        finalContainer.className = 'w-full my-4'; 
        
        // 👁️ 鷹眼質檢攔截與 UI 渲染
        const mainAiImage = res.images.find(img => img.processType === 'AI_SYNTHESIS');
        if (mainAiImage && mainAiImage.qaStatus === 'ERROR') {
             const retryHtml = `<br><button onclick="window.retrySingleImage(0)" class="mt-3 text-xs bg-red-100 hover:bg-red-500 hover:text-white text-red-600 font-bold border border-red-200 py-1.5 px-4 rounded-full transition-colors shadow-sm">✨ 點我啟動免費 VIP 重抽</button>`;
             await window.addAgentLog('視覺工程師', '👁️', `報告總編，鷹眼偵測到圖片文字可能因為筆畫過於密集而模糊。不用擔心，我已為您開啟免費修復通道！${retryHtml}`, false);
        } else {
             await window.addAgentLog('視覺工程師', '✅', '視覺質檢通過！文字與畫風完美融合。', false);
        }

        // 單圖置中渲染 (附帶錯誤警示)
        const displayUrl = res.images[0].finalUrl;
        finalContainer.innerHTML = `
            <div class="w-full p-2 bg-gray-50 rounded-xl flex flex-col items-center justify-center relative">
                <img id="finalRenderedImg_0" src="${displayUrl}" onclick="window.open(this.src, '_blank')" class="w-full max-w-md h-auto block rounded-xl shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-all animate-fade-in">
                ${mainAiImage && mainAiImage.qaStatus === 'ERROR' ? `<span class="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-md">文字需修復</span>` : ''}
            </div>
            <p class="text-center text-[10px] text-gray-400 mt-2">💡 點擊圖片可放大檢視</p>
        `;

        document.getElementById('finalCaptionDisplay').value = document.getElementById('reviewCaption').value;
        showToast('✅ 圖片處理完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('社群總監', '🚀', '隨時可以為您發射至各大平台！');
    } catch (e) { 
        await window.addAgentLog('系統警報', '🚨', `生圖失敗: ${e.message}`); 
        showToast(`❌ 生圖失敗: ${e.message}`, 'error'); 
    } finally { 
        btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-indigo-600'); 
        btn.innerHTML = '🎨 2️⃣ 第二步：發包生圖'; 
    }
};

// ==========================================
// 🔄 單圖免扣點重抽引擎 (VIP 通道)
// ==========================================
window.retrySingleImage = async function(index) {
    const btn = window.event?.target;
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '⚙️ 系統重繪中...';
    }
    await window.addAgentLog('視覺工程師', '⚙️', '收到！正在啟動免扣點通道為您重新繪製，請稍候...', true);

    try {
        const editedPanels = [];
        if (STATE.isComicModeActive) {
            const textareas = document.querySelectorAll('.panel-item[style*="display: block"] textarea, .panel-item:not([style*="display: none"]) textarea');
            textareas.forEach(ta => {
                const panelNum = parseInt(ta.id.split('_')[1]);
                editedPanels.push({ panel_number: panelNum, dialogue: ta.value });
            });
        }

        // 使用 fetch 直接呼叫我們剛寫好的新 API
        const regenerateCall = async () => {
            const response = await fetch('/api/content/regenerate-single', { // ✅ 對齊 index.js
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    taskId: STATE.currentTaskId, 
                    tenantId: getTenantIdFromToken(), 
                    imageIndex: index, 
                    editedPanels 
                })
            });
            return response.json();
        };

        const res = await window.executeWithRetry(regenerateCall, '算圖農場', '免扣點修復');

        if (!res.success) throw new Error(res.message);

        // 局部更新圖片
        const imgEl = document.getElementById(`finalRenderedImg_${index}`);
        if(imgEl) {
            imgEl.src = res.image.finalUrl;
            // 移除警示標籤
            const badge = imgEl.parentElement.querySelector('.bg-red-500');
            if(badge) badge.remove();
        }

        if(btn) {
            btn.innerHTML = '✅ 修復完成';
            btn.classList.replace('bg-red-100', 'bg-green-100');
            btn.classList.replace('text-red-600', 'text-green-600');
            btn.classList.replace('border-red-200', 'border-green-200');
        }

        if (res.image.qaStatus === 'ERROR') {
            const retryHtml = `<br><button onclick="window.retrySingleImage(${index})" class="mt-3 text-xs bg-red-100 hover:bg-red-500 hover:text-white text-red-600 font-bold border border-red-200 py-1.5 px-4 rounded-full transition-colors shadow-sm">🔄 還是怪怪的？再抽一次</button>`;
            await window.addAgentLog('視覺工程師', '⚠️', `修復完畢，但 AI 好像有點倔強，文字還是不太對。您可以選擇再抽一次！${retryHtml}`, false);
        } else {
            await window.addAgentLog('視覺工程師', '✨', '修復完美成功！文字已經清晰可見。', false);
        }

    } catch (e) {
        await window.addAgentLog('系統警報', '🚨', `修復失敗: ${e.message}`);
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 重新嘗試';
        }
    }
};

// ==========================================
// 🚀 核心流程 Step 3：一鍵發佈與排程
// ==========================================
window.publishToSocial = async function(manualRetryPlatforms = null) {
    const btn = document.getElementById('btnPublish');
    const scheduleTime = document.getElementById('scheduleTime').value;
    const scheduledAt = scheduleTime ? new Date(scheduleTime).toISOString() : null;
    
    btn.disabled = true; window.scrollTo({ top: 0, behavior: 'smooth' });

    if (scheduledAt) {
        await window.addAgentLog('系統管理員', '🗓️', `排程任務寫入中...`, true, btn);
    } else {
        const actionText = manualRetryPlatforms ? `啟動針對 [${manualRetryPlatforms.join(', ')}] 的手動重試程序...` : '啟動發射程序，打包圖文與跨平台參數...';
        await window.addAgentLog('社群總監', '🚀', actionText, true, btn);
    }

    const MAX_AUTO_RETRIES = 1; 
    let currentAttempt = 0;
    let targetPlatforms = manualRetryPlatforms; 
    let finalFailedPlatforms = [];

    try {
        while (currentAttempt <= MAX_AUTO_RETRIES) {
            const res = await window.executeWithRetry(() => API.publishContentAPI({ 
                taskId: STATE.currentTaskId, 
                tenantId: getTenantIdFromToken(), 
                finalCaption: document.getElementById('finalCaptionDisplay').value, 
                scheduledAt,
                retryPlatforms: targetPlatforms 
            }), '社群總監', '社群發射');
            
            if (res.failedPlatforms && res.failedPlatforms.length > 0) {
                if (currentAttempt < MAX_AUTO_RETRIES && !scheduledAt) {
                    const failedNames = res.failedPlatforms.join(', ');
                    await window.addAgentLog('社群總監', '🔄', `偵測到 [${failedNames}] 發送無回應。已自動啟動修復機制，等待 3 秒後為您重新推送...`, true);
                    
                    currentAttempt++;
                    targetPlatforms = res.failedPlatforms; 
                    
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue; 
                } else {
                    finalFailedPlatforms = res.failedPlatforms;
                    break;
                }
            } else {
                finalFailedPlatforms = [];
                break;
            }
        }

        if (finalFailedPlatforms.length > 0) {
            const failedNames = finalFailedPlatforms.join(', ');
            await window.addAgentLog('社群總監', '⚠️', `報告總編，已盡力重試，但以下平台依然發射失敗：[${failedNames}]。可能是 Meta 授權過期，請您檢查後點擊按鈕手動重發。`, false);
            
            btn.innerHTML = '🔄 重試失敗平台';
            btn.classList.replace('bg-gray-500', 'bg-yellow-500');
            btn.disabled = false;
            btn.onclick = () => window.publishToSocial(finalFailedPlatforms);
            showToast(`⚠️ 部分發布失敗 (${failedNames})，請重試！`, 'warning');
            return; 
        }

        const publishCost = STATE.globalPricing?.PUBLISH_POST?.retailPoints ?? 5;
        window.showPointDeduction(btn, publishCost); 
        await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${publishCost} 點)`, false);
        
        await window.addAgentLog('系統管理員', '✅', scheduledAt ? '全平台排程成功！' : '全平台發送成功！', false);
        btn.innerHTML = scheduledAt ? '✅ 預約成功！' : '✅ 發布成功！';
        btn.classList.replace('bg-green-600', 'bg-gray-500');
        showToast('🎉 全平台發布大成功！', 'success');

        if (!scheduledAt && typeof confetti === 'function') {
            const dur = 2000, end = Date.now() + dur;
            (function f() { confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } }); confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } }); if (Date.now() < end) requestAnimationFrame(f); }());
        }
        setTimeout(async () => {
            await window.addAgentLog('專案總監', '🎉', '任務圓滿達成！隨時準備啟動下一篇任務。');
            btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-blue-600'); btn.innerHTML = '✨ 再來一篇！'; btn.onclick = window.resetToStep1;
        }, 2500);

    } catch (e) { 
        await window.addAgentLog('系統警報', '🚨', `發佈徹底失敗: ${e.message}`); 
        showToast(`❌ 失敗: ${e.message}`, 'error'); 
        btn.disabled = false; btn.innerHTML = '🚀 重試發射'; 
        btn.onclick = () => window.publishToSocial(targetPlatforms);
    }
};
