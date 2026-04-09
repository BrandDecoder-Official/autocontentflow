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
            await window.addAgentLog(role, '🛡️', `偵測到「${actionName}」擁塞，將於 ${Math.round(waitTime/1000)} 秒後自動重試...`, true, window.LAST_CLICKED_EL);
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
    STATE.userAgreedToSplurge = false; // 🔄 重置決策狀態

    window.resetAgentConsole();
    setTimeout(async () => { await window.addAgentLog('專案總監', '👨‍💼', '任務已重置，全新的卷宗已就緒！'); }, 500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 🌟 升級：開機同時抓取畫風庫與動態價目表
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
                    console.log("💰 最新動態定價表載入完成:", STATE.globalPricing);
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
                        await window.addAgentLog('美術總監', '👨‍🎨', '畫布預設為「🌈 彩色」與「1:1」比例。');
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

    const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;

    if (!selectedStyleId) {
        await window.addAgentLog('專案總監', '👨‍💼', '收到任務！正在解析參數...', true, topicInput);
        await window.addAgentLog('美術總監', '⚠️', '報告總編，偵測到關鍵參數缺失！您還沒選擇「畫風」。請直接點擊下方按鈕補齊：', true);
        
        STATE.pendingTaskPayload = { topic, selectedPlatforms };

        const logContainer = document.getElementById('aiTeamConsoleLog');
        if (logContainer && STATE.globalSystemStyles) {
            const optionsDiv = document.createElement('div');
            optionsDiv.className = 'ml-8 mt-1 mb-2 animate-fade-in flex flex-wrap gap-1.5';
            
            STATE.globalSystemStyles.forEach(s => {
                const currentMode = STATE.isComicModeActive ? 'ANIME' : 'REALISTIC';
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
        const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
        let promptStyle = '', negativeStyle = '', styleName = '預設風格';
        if (selectedStyleId && STATE.globalSystemStyles) {
            const obj = STATE.globalSystemStyles.find(s => s.id === selectedStyleId);
            if (obj) { promptStyle = obj.promptPrefix; negativeStyle = obj.negativePrompt; styleName = obj.name; }
        }
        STATE.currentStyleName = styleName;

        const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'COLOR';
        const payload = {
            tenantId: getTenantIdFromToken(), platforms: payloadData.selectedPlatforms, topic: payloadData.topic, isComicMode: STATE.isComicModeActive,
            colorMode: colorMode, aspectRatio: document.getElementById('aspectRatioSelect').value, style: promptStyle,             
            negativePrompt: negativeStyle, resolution: document.getElementById('resolutionSelect').value, comicCharacters: [], image_options: { referenceImages: [] }
        };

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
        STATE.multiImages = [{ id: `cover_${Date.now()}`, originalUrl: '', processType: 'AI_SYNTHESIS' }];
        window.renderMultiImages();

        document.getElementById('step1-setup').classList.add('hidden');
        document.getElementById('step2-review').classList.remove('hidden');
        document.getElementById('step2StyleBadge').innerText = `🎨 畫風：${STATE.currentStyleName}`;
        document.getElementById('reviewCaption').value = result.draftContent.post_caption;
        
        const panContainer = document.getElementById('reviewPanelsContainer');
        if (result.isComicMode && result.draftContent.panels) {
            panContainer.classList.remove('hidden');
            let html = '<label class="block text-sm font-bold text-gray-700 mb-2">🎬 分鏡腳本確認</label>';
            result.draftContent.panels.forEach(p => {
                html += `<div class="mb-4 p-4 bg-white rounded-xl shadow-sm"><p class="text-xs text-gray-500">🎥 ${p.action_zh || p.action_en || '場景'}</p><textarea id="panel_${p.panel_number}" class="w-full p-2 bg-gray-50 border rounded-lg text-sm cursor-text">${p.dialogue}</textarea></div>`;
            });
            panContainer.innerHTML = html;
        } else panContainer.classList.add('hidden');
        
        showToast('✅ 腳本生成完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('專案總監', '⏸️', '腳本已就緒，請總編審核。');
    } catch (e) { 
        await window.addAgentLog('系統警報', '🚨', `發生錯誤: ${e.message}`); 
        showToast(`❌ 錯誤: ${e.message}`, 'error'); 
    } finally { 
        btnSubmit.disabled = false; btnSubmit.classList.replace('bg-gray-500', 'bg-blue-600'); 
        document.getElementById('btnTextStep1').innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本'; 
    }
}

// ==========================================
// 🚨 擴展功能：決策攔截視窗 (UI 動態生成)
// ==========================================
window.showDecisionModal = function(panels, hasTooManyPanels, hasLongText) {
    if (document.getElementById('decisionModal')) return;

    const requiredImages = Math.ceil(panels.length / 4);
    const imageCost = STATE.globalPricing?.GENERATE_IMAGE?.retailPoints ?? 20;
    const totalPoints = requiredImages * imageCost;

    let warningReasons = [];
    if (hasTooManyPanels) warningReasons.push(`共有 <b>${panels.length} 格</b> 分鏡`);
    if (hasLongText) warningReasons.push(`部分對白<b>超過 15 個字</b>`);

    const modalHtml = `
    <div id="decisionModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div class="bg-red-500 p-4 text-center">
                <h3 class="text-white text-lg font-black tracking-wider">🚨 系統偵測：史詩級腳本！</h3>
            </div>
            <div class="p-6 space-y-4 text-gray-700 text-sm">
                <p>總編，您的腳本非常豐富！目前 ${warningReasons.join('，且')}。</p>
                <p>為了確保畫面清晰與文字完美，系統需要為您切割生成 <b>${requiredImages} 張</b> 漫畫拼圖。</p>
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 text-center">
                    本次發包將消耗：<span class="text-red-500 font-black text-lg">${totalPoints} ⚡</span> <br>
                    <span class="text-xs text-gray-400">(${requiredImages} 張 x ${imageCost} 點)</span>
                </div>
                <p class="font-bold text-center mt-2">請選擇您的決策：</p>

                <div class="flex flex-col gap-3 mt-4">
                    <button onclick="window.proceedWithSplurge(${requiredImages})" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex justify-between items-center group">
                        <span class="flex items-center gap-2">💰 豪氣發包</span>
                        <span class="text-xs bg-black/20 px-2 py-1 rounded text-indigo-100 group-hover:text-white transition-colors">生成 ${requiredImages} 張多頁連載</span>
                    </button>
                    <button onclick="window.triggerAICompress()" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex justify-between items-center group">
                        <span class="flex items-center gap-2">✨ AI 魔法濃縮</span>
                        <span class="text-xs bg-black/20 px-2 py-1 rounded text-purple-100 group-hover:text-white transition-colors">免費提煉為單張 4 格</span>
                    </button>
                    <button onclick="document.getElementById('decisionModal').remove()" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 px-4 rounded-xl transition-all flex justify-between items-center">
                        <span class="flex items-center gap-2">✍️ 我自己來</span>
                        <span class="text-xs text-gray-400">取消，返回手動修改</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// 用戶點擊 [💰 豪氣發包] 的處理邏輯
window.proceedWithSplurge = function(requiredImages) {
    document.getElementById('decisionModal').remove();
    STATE.userAgreedToSplurge = true; // 放行標記

    // 🌟 動態擴充 STATE.multiImages，讓 API 知道要生幾張圖
    STATE.multiImages = [];
    for (let i = 0; i < requiredImages; i++) {
        STATE.multiImages.push({ id: `img_${Date.now()}_${i}`, originalUrl: '', processType: 'AI_SYNTHESIS' });
    }

    window.submitForImageGeneration(); // 再次觸發發包程序
};

// 用戶點擊 [✨ AI 魔法濃縮] 的處理邏輯
window.triggerAICompress = async function() {
    document.getElementById('decisionModal').remove();
    const btn = document.getElementById('btnStep2Submit');
    btn.disabled = true;
    btn.innerHTML = '✨ AI 魔法濃縮中...';

    await window.addAgentLog('首席文案', '✨', '收到濃縮請求！正在為您將史詩長篇提煉為完美的 4 格精華...', true);

    try {
        const editedPanels = [];
        document.querySelectorAll('textarea[id^="panel_"]').forEach(ta => {
            editedPanels.push({ panel_number: parseInt(ta.id.split('_')[1]), dialogue: ta.value });
        });

        // 🌟 修正：直接使用我們剛剛在 api.js 註冊好的乾淨函數
        const res = await window.executeWithRetry(() => API.compressComicPanelsAPI({
            taskId: STATE.currentTaskId,
            tenantId: getTenantIdFromToken(),
            panels: editedPanels
        }), '首席文案', 'AI魔法濃縮');

        // 把後端濃縮回傳的精華覆蓋回畫面上
        const panContainer = document.getElementById('reviewPanelsContainer');
        if (res.panels && res.panels.length > 0) {
            let html = '<label class="block text-sm font-bold text-gray-700 mb-2">🎬 分鏡腳本確認 (✨已濃縮精華)</label>';
            res.panels.forEach(p => {
                html += `<div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm"><p class="text-xs text-gray-500">🎥 ${p.action_zh || p.action_en || '場景'}</p><textarea id="panel_${p.panel_number}" class="w-full p-2 bg-white border border-yellow-300 rounded-lg text-sm cursor-text font-bold text-gray-800">${p.dialogue}</textarea></div>`;
            });
            panContainer.innerHTML = html;
        }

        showToast('✨ 濃縮完成！字數與格數已達到最佳狀態！', 'success');
        await window.addAgentLog('首席文案', '✅', '濃縮完畢！您可以再次點擊發包生圖了。');

    } catch (e) {
        showToast(`❌ 濃縮失敗: ${e.message}`, 'error');
        await window.addAgentLog('系統管理員', '🚨', `發生錯誤: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🎨 2️⃣ 第二步：發包生圖';
        STATE.userAgreedToSplurge = false; // 重置放行標記
    }
};

window.submitForImageGeneration = async function() {
    const btn = document.getElementById('btnStep2Submit');
    if (!STATE.multiImages?.length) return showToast('❌ 需要至少 1 張圖片！', 'error');

    // ==== 🚨 決策攔截器啟動 ====
    const editedPanels = [];
    if (STATE.isComicModeActive) {
        const textareas = document.querySelectorAll('textarea[id^="panel_"]');
        textareas.forEach(ta => {
            const panelNum = parseInt(ta.id.split('_')[1]);
            editedPanels.push({ panel_number: panelNum, dialogue: ta.value });
        });

        const hasTooManyPanels = editedPanels.length > 4;
        const hasLongText = editedPanels.some(p => p.dialogue.length > 15);

        // 如果超標且使用者還沒同意付款放行，就跳出決策視窗並阻斷 API 呼叫
        if ((hasTooManyPanels || hasLongText) && !STATE.userAgreedToSplurge) {
            window.showDecisionModal(editedPanels, hasTooManyPanels, hasLongText);
            return; // 🛑 攔截成功，停止向下執行
        }
    }
    // ==== 🚨 決策攔截器結束 ====

    btn.disabled = true; btn.classList.replace('bg-indigo-600', 'bg-gray-500');
    document.getElementById('btnTextStep2').innerHTML = '🎨 執行中...';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await window.addAgentLog('美術總監', '👨‍🎨', '收到發包指令！打包圖文參數中...', true, btn);

    try {
        const aiCount = STATE.multiImages.filter(img => img.processType === 'AI_SYNTHESIS').length;
        
        const imageCost = STATE.globalPricing?.GENERATE_IMAGE?.retailPoints ?? 20;
        const totalCost = aiCount * imageCost; 
        
        if(aiCount > 0) await window.addAgentLog('算圖農場', '🤖', `極速生成 ${aiCount} 張圖片中...`, true);
        else await window.addAgentLog('影像處理組', '☁️', '原圖上傳中 (不消耗點數)...', true);

        const res = await window.executeWithRetry(() => API.generateImageAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: getTenantIdFromToken(), 
            editedCaption: document.getElementById('reviewCaption').value, 
            editedPanels, // 直接傳入上面攔截器抓好的資料
            incomingImages: STATE.multiImages.map(img => ({ processType: img.processType, originalUrl: img.originalUrl })) 
        }), '算圖農場', '雲端算圖');
        
        if (totalCost > 0) {
            window.showPointDeduction(btn, totalCost); 
            await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${totalCost} 點)`, false);
        }
        
        await window.addAgentLog('系統管理員', '✨', '圖片處理完畢！準備發射...', false);
        document.getElementById('step2-review').classList.add('hidden');
        document.getElementById('step3-publish').classList.remove('hidden');
        document.getElementById('step3StyleBadge').innerText = `🎨 畫風：${STATE.currentStyleName}`;
        
        // ==========================================
        // 🌟 升級版：真・圖文分離與動態遮罩排版引擎
        // ==========================================
        const finalContainer = document.getElementById('finalImageContainer');
        finalContainer.className = 'w-full my-4'; 
        finalContainer.innerHTML = ''; // 清空容器
        
        let containerHtml = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full p-4 bg-gray-100 rounded-xl">';
        
        // 將所有圖片與對應的分鏡文字組合
        res.images.forEach((img, imgIndex) => {
            // 計算這張圖負責哪幾格對白 (例如 imgIndex 0 負責 0~3 格)
            const chunkPanels = editedPanels.slice(imgIndex * 4, (imgIndex + 1) * 4);
            
            // 建立一個 relative 的畫布容器，讓文字可以 absolute 定位在上面
            let panelHtml = `
                <div class="relative w-full overflow-hidden rounded-xl shadow-md border border-gray-200 comic-canvas" style="aspect-ratio: 1/1;">
                    <img src="${img.finalUrl}" class="w-full h-full object-cover pointer-events-none">
            `;

            // 為這張圖負責的每一句對白，生成一個「自帶遮罩、可拖拽」的文字塊
            chunkPanels.forEach((panel, i) => {
                // 初始化散佈邏輯：預設將 4 格文字散佈在圖片的四個角落附近
                const topPos = i < 2 ? 10 + (i * 10) : 60 + ((i - 2) * 10); // 上方或下方，稍微交錯
                const leftPos = i % 2 === 0 ? 10 : 50; // 左側或右側

                panelHtml += `
                    <div class="absolute cursor-move text-gray-900 font-black tracking-wider leading-snug shadow-sm border-2 border-gray-800 bg-white p-2 rounded-xl transition-all draggable-text hover:ring-4 hover:ring-blue-400" 
                         style="top: ${topPos}%; left: ${leftPos}%; max-width: 45%; width: max-content; font-size: clamp(12px, 2vw, 16px); z-index: 10;"
                         contenteditable="true" spellcheck="false"
                         onmousedown="window.startDrag(event)" ontouchstart="window.startDrag(event)">
                        ${panel.dialogue}
                    </div>
                `;
            });
            
            panelHtml += `</div>`; // 結束相對定位容器
            containerHtml += panelHtml;
        });

        containerHtml += `</div><p class="text-center text-[10px] text-gray-400 mt-2">💡 💡 提示：請將文字拖曳到對話框內！點擊文字可直接修改。</p>`;
        finalContainer.innerHTML = containerHtml;

        document.getElementById('finalCaptionDisplay').value = document.getElementById('reviewCaption').value;
        showToast('✅ 圖片處理完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('社群總監', '⏸️', '隨時可以為您發射！');
    } catch (e) { 
        await window.addAgentLog('系統警報', '🚨', `生圖失敗: ${e.message}`); 
        showToast(`❌ 生圖失敗: ${e.message}`, 'error'); 
    } finally { 
        STATE.userAgreedToSplurge = false; // 🔄 任務結束，重置放行標記
        btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-indigo-600'); document.getElementById('btnTextStep2').innerHTML = '🎨 2️⃣ 第二步：發包生圖'; 
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
                    await window.addAgentLog('社群總監', '🔄', `偵測到 [${failedNames}] 發送無回應。Agent 啟動自我修復機制，等待 3 秒後自動為您重試...`, true);
                    
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
            await window.addAgentLog('社群總監', '⚠️', `報告總編，已盡力重試，但以下平台依然發射失敗：[${failedNames}]。可能是 Meta API 限制或權限過期，請您手動點擊重試。`, false);
            
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
