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
        // 關閉抽屜動畫
        drawer.classList.add('translate-x-full');
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    } else {
        // 開啟抽屜動畫
        overlay.classList.remove('hidden');
        void overlay.offsetWidth; // 強制瀏覽器重繪 (Trigger reflow)
        overlay.classList.add('opacity-100');
        drawer.classList.remove('translate-x-full');
        
        // 更新抽屜內的餘額顯示
        document.getElementById('drawerBalanceDisplay').innerText = `${STATE.userPoints || 0} ⚡`;
        
        // 呼叫 API 撈取資料 (目前先放前端模擬器，下一步串接後端)
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
        
        // 🌟 呼叫真實 API 撈取資料 (取代原本的 mockLogs)
        const res = await window.executeWithRetry(() => API.fetchAuditLogsAPI(tenantId), '系統管理員', '讀取歷史卷宗');
        
        // 取得後端回傳的真實陣列
        const realLogs = res.logs || [];

        if (realLogs.length === 0) {
            contentBox.innerHTML = `<div class="text-center text-gray-400 mt-10 text-sm font-bold">目前尚無任何花費紀錄。</div>`;
            return;
        }

        let html = '<div class="space-y-4">';
        realLogs.forEach(log => {
            // 根據動作給予不同的 UI 顏色
            let icon = '⚡'; let colorClass = 'bg-gray-100 text-gray-600';
            if(log.type === 'GENERATE_IMAGE') { icon = '🎨'; colorClass = 'bg-purple-100 text-purple-700'; }
            if(log.type === 'GENERATE_DRAFT') { icon = '✍️'; colorClass = 'bg-blue-100 text-blue-700'; }
            if(log.type === 'PUBLISH_POST') { icon = '🚀'; colorClass = 'bg-green-100 text-green-700'; }
            if(log.type === 'UPLOAD_IMAGE') { icon = '☁️'; colorClass = 'bg-emerald-100 text-emerald-700'; }

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

    window.resetAgentConsole();
    setTimeout(async () => { await window.addAgentLog('專案總監', '👨‍💼', '任務已重置，全新的卷宗已就緒！'); }, 500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.initSystemData = async function() {
    try {
        const tenantId = getTenantIdFromToken();
        const res = await window.executeWithRetry(() => API.fetchSystemOptionsAPI(tenantId), '系統管理員', '載入資料庫');
        STATE.globalSystemStyles = res.data.styles || [];
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
        window.showPointDeduction(btn, 5); 
        // 🌟 明確報帳
        if (typeof window.addAgentLog === 'function') await window.addAgentLog('財務總監', '💳', `(AI算力扣除 5 點)`, false, targetButton);
        
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
// 🚀 核心流程 Step 1：AI 撰寫腳本 (扣 10 點)
// ==========================================
document.getElementById('agentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
   // 🎯 這裡強制定向：不管有沒有抓到 LAST_CLICKED_EL，我們直接指定發射源
    const topicInput = document.getElementById('topic'); 
    const btnSubmit = document.getElementById('btnStep1Submit');
    
    const publishBtn = document.getElementById('btnPublish');
    if(publishBtn) { publishBtn.disabled = false; publishBtn.innerHTML = '🚀 立刻發射！'; }

    const selectedPlatforms = [];
    if(document.getElementById('platFB')?.checked) selectedPlatforms.push('FB');
    if(document.getElementById('platIG')?.checked) selectedPlatforms.push('IG');
    if(document.getElementById('platThreads')?.checked) selectedPlatforms.push('THREADS');
    if(selectedPlatforms.length === 0) return showToast('❌ 請至少勾選一個平台！', 'error');

    const topic = document.getElementById('topic').value.trim();
    if (!topic) return showToast('❌ 請輸入主題！', 'error');

    btnSubmit.disabled = true; btnSubmit.classList.replace('bg-blue-600', 'bg-gray-500');
    document.getElementById('btnTextStep1').innerHTML = '⚡ 執行中，請看右側進度...';

    await window.addAgentLog('專案總監', '👨‍💼', '收到任務！正在解析主題...', true, topicInput);
    await window.addAgentLog('專案總監', '👨‍💼', '收到貼文任務！正在打包卷宗並解析平台設定...', true, btnSubmit);
    

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
            tenantId: getTenantIdFromToken(), platforms: selectedPlatforms, topic: topic, isComicMode: STATE.isComicModeActive,
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
        
        window.showPointDeduction(btnSubmit, 10); 
        // 🌟 明確報帳
        await window.addAgentLog('財務總監', '💳', '(AI算力扣除 10 點)', false);
        
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
                html += `<div class="mb-4 p-4 bg-white rounded-xl shadow-sm"><p class="text-xs text-gray-500">🎥 ${p.action_zh}</p><textarea id="panel_${p.panel_number}" class="w-full p-2 bg-gray-50 border rounded-lg text-sm cursor-text">${p.dialogue}</textarea></div>`;
            });
            panContainer.innerHTML = html;
        } else panContainer.classList.add('hidden');
        
        showToast('✅ 腳本生成完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('專案總監', '⏸️', '腳本已就緒，請總編審核。');
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `發生錯誤: ${e.message}`); showToast(`❌ 錯誤: ${e.message}`, 'error'); } 
    finally { btnSubmit.disabled = false; btnSubmit.classList.replace('bg-gray-500', 'bg-blue-600'); document.getElementById('btnTextStep1').innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本'; }
});

// ==========================================
// 🎨 核心流程 Step 2：發包生圖
// ==========================================
window.submitForImageGeneration = async function() {
    const btn = document.getElementById('btnStep2Submit');
    if (!STATE.multiImages?.length) return showToast('❌ 需要至少 1 張圖片！', 'error');
    btn.disabled = true; btn.classList.replace('bg-indigo-600', 'bg-gray-500');
    document.getElementById('btnTextStep2').innerHTML = '🎨 執行中...';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await window.addAgentLog('美術總監', '👨‍🎨', '收到發包指令！打包圖文參數中...', true, btn);

    const editedPanels = [];
    if (STATE.isComicModeActive) {
        for(let i=1; i<=4; i++) {
            const ta = document.getElementById(`panel_${i}`);
            if(ta) editedPanels.push({ panel_number: i, dialogue: ta.value });
        }
    }

    try {
        const aiCount = STATE.multiImages.filter(img => img.processType === 'AI_SYNTHESIS').length;
        const totalCost = aiCount * 20; 
        
        if(aiCount > 0) await window.addAgentLog('算圖農場', '🤖', `極速生成 ${aiCount} 張圖片中...`, true);
        else await window.addAgentLog('影像處理組', '☁️', '原圖上傳中 (不消耗點數)...', true);

        const res = await window.executeWithRetry(() => API.generateImageAPI({ taskId: STATE.currentTaskId, tenantId: getTenantIdFromToken(), editedCaption: document.getElementById('reviewCaption').value, editedPanels, incomingImages: STATE.multiImages.map(img => ({ processType: img.processType, originalUrl: img.originalUrl })) }), '算圖農場', '雲端算圖');
        
        if (totalCost > 0) {
            window.showPointDeduction(btn, totalCost); 
            // 🌟 明確報帳
            await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${totalCost} 點)`, false);
        }
        
        await window.addAgentLog('系統管理員', '✨', '圖片處理完畢！準備發射...', false);
        document.getElementById('step2-review').classList.add('hidden');
        document.getElementById('step3-publish').classList.remove('hidden');
        document.getElementById('step3StyleBadge').innerText = `🎨 畫風：${STATE.currentStyleName}`;
        
        let imgHtml = '';
        if (res.images?.length > 0) {
            res.images.forEach(img => { imgHtml += `<img src="${img.finalUrl}" class="w-full object-cover rounded-xl shadow-sm border animate-fade-in" style="aspect-ratio: 1/1;">`; });
            document.getElementById('finalImageContainer').innerHTML = `<div class="grid grid-cols-2 gap-3 w-full p-3">${imgHtml}</div>`;
        } else {
            document.getElementById('finalImageContainer').innerHTML = `<img src="${res.imageUrl}" class="w-full rounded-xl shadow-md border animate-fade-in">`;
        }
        document.getElementById('finalCaptionDisplay').value = document.getElementById('reviewCaption').value;
        showToast('✅ 圖片處理完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('社群總監', '⏸️', '隨時可以為您發射！');
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `生圖失敗: ${e.message}`); showToast(`❌ 生圖失敗: ${e.message}`, 'error'); } 
    finally { btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-indigo-600'); document.getElementById('btnTextStep2').innerHTML = '🎨 2️⃣ 第二步：發包生圖'; }
};

// ==========================================
// 🚀 核心流程 Step 3：一鍵發佈與排程
// ==========================================
window.publishToSocial = async function() {
    const btn = document.getElementById('btnPublish');
    const scheduleTime = document.getElementById('scheduleTime').value;
    const scheduledAt = scheduleTime ? new Date(scheduleTime).toISOString() : null;
    btn.disabled = true; window.scrollTo({ top: 0, behavior: 'smooth' });

    if (scheduledAt) await window.addAgentLog('系統管理員', '🗓️', `排程任務寫入中...`, true, btn);
    else await window.addAgentLog('社群總監', '🚀', '啟動發射程序，打包圖文與 Hashtag...', true, btn);

    try {
        const res = await window.executeWithRetry(() => API.publishContentAPI({ taskId: STATE.currentTaskId, tenantId: getTenantIdFromToken(), finalCaption: document.getElementById('finalCaptionDisplay').value, scheduledAt }), '社群總監', '社群發射');
        
        window.showPointDeduction(btn, 5); 
        // 🌟 明確報帳
        await window.addAgentLog('財務總監', '💳', '(AI算力扣除 5 點)', false);
        
        await window.addAgentLog('系統管理員', '✅', scheduledAt ? '排程成功！' : '發送成功！', false);
        btn.innerHTML = scheduledAt ? '✅ 預約成功！' : '✅ 發布成功！';
        btn.classList.replace('bg-green-600', 'bg-gray-500');
        showToast('🎉 操作成功！', 'success');

        if (!scheduledAt && typeof confetti === 'function') {
            const dur = 2000, end = Date.now() + dur;
            (function f() { confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 } }); confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 } }); if (Date.now() < end) requestAnimationFrame(f); }());
        }
        setTimeout(async () => {
            await window.addAgentLog('專案總監', '🎉', '圓滿達成！隨時啟動下一篇任務。');
            btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-blue-600'); btn.innerHTML = '✨ 再來一篇！'; btn.onclick = window.resetToStep1;
        }, 2500);
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `發佈失敗: ${e.message}`); showToast(`❌ 失敗: ${e.message}`, 'error'); btn.disabled = false; btn.innerHTML = '🚀 重試發射'; }
};
