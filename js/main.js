// js/main.js
import { CONFIG, STATE } from './config.js';
import { showToast } from './utils.js'; 
import * as API from './api.js';
import * as UI from './ui.js';

// ==========================================
// 🌟 1. 模組載入與全域綁定
// ==========================================
import { compressImageToBase64 } from './image.js';
import './agent.js'; 

window.toggleSection = UI.toggleSection;
window.previewCharImage = UI.previewCharImage;
window.openCreateCharModal = UI.openCreateCharModal;
window.closeCreateCharModal = UI.closeCreateCharModal;

// ==========================================
// 🛡️ 2. 全域防禦機制：自動重試引擎 (Exponential Backoff)
// ==========================================
/**
 * 負責包裝所有 API 呼叫，提供智慧重試與 AI 安撫功能
 * @param {Function} apiCallFn - 要執行的 API 函數 (回傳 Promise)
 * @param {String} role - 負責報告的 AI 角色 (如：'系統管理員')
 * @param {String} actionName - 動作名稱 (如：'社群平台發射')
 * @param {Number} maxRetries - 最大重試次數 (預設 3 次)
 */
window.executeWithRetry = async function(apiCallFn, role, actionName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 嘗試執行 API
            const result = await apiCallFn();
            if (!result || !result.success) {
                throw new Error(result?.message || '未知的系統回傳錯誤');
            }
            return result; // 成功就直接回傳
            
        } catch (error) {
            const errMsg = error.message || String(error);
            
            // 🛑 判斷是否為「致命錯誤 (Fatal Error)」
            // 若為容量超載、權限不足等，重試也沒用，直接中斷
            const isFatal = errMsg.includes('INVALID_ARGUMENT') || 
                            errMsg.includes('auth') || 
                            errMsg.includes('未授權') ||
                            errMsg.includes('參數錯誤');
            
            // 如果是致命錯誤，或已經到了最後一次嘗試，直接拋出錯誤讓外層捕捉
            if (isFatal || attempt === maxRetries) {
                throw error; 
            }

            // ⏳ 計算退避時間：2秒, 4秒... 加上隨機抖動(Jitter)避免伺服器被規律塞爆
            const baseWait = Math.pow(2, attempt) * 1000;
            const jitter = Math.floor(Math.random() * 1000);
            const waitTime = baseWait + jitter;

            // 🤖 呼叫 AI 幕僚安撫用戶
            if (typeof window.addAgentLog === 'function') {
                await window.addAgentLog(
                    role, 
                    '🛡️', 
                    `偵測到「${actionName}」遭遇短暫連線不穩或擁塞。已啟動自動防禦機制，將於 ${Math.round(waitTime/1000)} 秒後進行第 ${attempt} 次重試...`, 
                    true
                );
            }
            
            // 進入睡眠等待
            await window.sleep(waitTime);
        }
    }
};

// ==========================================
// 🌟 3. 核心狀態與輔助函數
// ==========================================
function getTenantIdFromToken() {
    if (!STATE.globalAuthToken) return 'test_user_001'; 
    try {
        const base64Url = STATE.globalAuthToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const decoded = JSON.parse(jsonPayload);
        return decoded.sub || decoded.email;
    } catch (e) {
        return 'test_user_001';
    }
}

window.backToStep1 = function() {
    document.getElementById('step2-review').classList.add('hidden');
    document.getElementById('step1-setup').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToStep2 = function() {
    document.getElementById('step3-publish').classList.add('hidden');
    document.getElementById('step2-review').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.resetToStep1 = function() {
    document.getElementById('step3-publish').classList.add('hidden');
    document.getElementById('step2-review').classList.add('hidden');
    document.getElementById('step1-setup').classList.remove('hidden');
    
    STATE.currentTaskId = null;
    STATE.multiImages = [];
    document.getElementById('agentForm').reset();
    document.getElementById('characterList').innerHTML = '';
    document.getElementById('scenePreview').innerHTML = '';
    document.getElementById('objectPreview').innerHTML = '';
    
    if (typeof window.resetAgentConsole === 'function') {
        window.resetAgentConsole();
        setTimeout(async () => {
            await window.addAgentLog('專案總監', '👨‍💼', '收到重置指令。全新的任務卷宗已為您準備完畢！');
        }, 500);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// 🌟 4. 系統初始化與角色管理 (CRUD)
// ==========================================
window.initSystemData = async function() {
    try {
        const tenantId = getTenantIdFromToken();
        // 🛡️ 套用重試防禦
        const optionsRes = await window.executeWithRetry(
            () => API.fetchSystemOptionsAPI(tenantId),
            '系統管理員',
            '載入資料庫選項'
        );
        
        STATE.globalSystemStyles = optionsRes.data.styles || [];
        if (typeof UI.renderDynamicOptions === 'function') {
            UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', optionsRes.data);
        }
    } catch (error) {
        console.error('初始化系統資料錯誤:', error);
        showToast('❌ 無法連線資料庫，請檢查網路', 'error');
    }
};

window.addCharacterFromDB = async (dbChar) => {
    const list = document.getElementById('characterList');
    if (list.children.length >= 4) {
        showToast('❌ 最多只能新增 4 位角色！', 'error');
        return;
    }

    const item = document.createElement('div');
    item.className = 'char-item relative animate-fade-in flex items-start gap-3 bg-white p-3 border border-blue-200 rounded-xl shadow-sm mb-3 group'; 
    
    item.innerHTML = `
        <button type="button" onclick="this.closest('.char-item').remove()" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold transition-all shadow-sm z-10">&times;</button>
        <img src="${dbChar.imageUrl || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-100 flex-shrink-0 shadow-sm">
        <div class="flex-grow">
            <div class="flex items-center mb-1.5">
                <span class="font-black text-gray-800 text-sm mr-2">${dbChar.name}</span>
                <span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center"><span class="mr-1">🔒</span> 基因鎖定</span>
            </div>
            <input type="hidden" name="charName" value="${dbChar.name}">
            <input type="hidden" class="char-db-features" value="${dbChar.aiExtractedFeatures || ''}">
            <input type="hidden" class="char-image-url" value="${dbChar.imageUrl || ''}">
            <input type="text" name="charPersona" class="w-full p-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="可在此微調當前服裝/表情 (例如：穿著西裝、正在生氣)" value="${dbChar.persona || ''}">
        </div>
    `;
    list.appendChild(item);
    showToast(`✅ 已讓 ${dbChar.name} 進入候場區！`, 'success');

    if (typeof window.addAgentLog === 'function') {
        await window.addAgentLog('視覺工程師', '👁️', `成功捕獲「${dbChar.name}」的視覺基因！他今天會穿哪一套衣服呢？`);
    }
};

window.submitNewCharacter = async function() {
    const name = document.getElementById('newCharName').value.trim();
    const fileInput = document.getElementById('newCharImage');

    if (!name) return showToast('❌ 請輸入角色名稱！', 'error');
    if (!fileInput.files || fileInput.files.length === 0) return showToast('❌ 請上傳角色照片！', 'error');

    const btn = document.getElementById('btnSubmitNewChar');
    btn.disabled = true;
    btn.innerHTML = '🧬 正在掃描基因...';

    try {
        const base64ImgInfo = await compressImageToBase64(fileInput.files[0], 800, false);
        const tenantId = getTenantIdFromToken();
        
        const payload = {
            name: name,
            imageBase64: base64ImgInfo.data,
            mimeType: base64ImgInfo.mimeType,
            tenantId: tenantId
        };

        // 🛡️ 套用重試防禦
        const result = await window.executeWithRetry(
            () => API.createCharacterAPI(payload),
            '視覺工程師',
            '基因特徵寫入'
        );
        
        showToast(result.message, 'success');
        UI.closeCreateCharModal();
        
        await window.initSystemData(); // 重新載入
        
    } catch(error) {
        showToast(`❌ 建立失敗: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🧬 開始基因掃描';
    }
};

window.deleteChar = async function(charId) {
    if (!confirm('⚠️ 確定要永久刪除這個角色嗎？\n雲端大頭照也會被同步清理喔！')) return;
    
    const tenantId = getTenantIdFromToken();
    try {
        showToast('🗑️ 正在清理雲端基因...', 'info');
        
        // 🛡️ 套用重試防禦
        await window.executeWithRetry(
            () => API.deleteCharacterAPI({ charId, tenantId }),
            '系統管理員',
            '清理雲端角色'
        );
        
        showToast('✅ 角色已成功刪除！', 'success');
        await window.initSystemData();
        
    } catch(error) {
        showToast(`❌ 刪除失敗: ${error.message}`, 'error');
    }
};

// ==========================================
// 🌟 5. Google 登入與啟動晨會
// ==========================================
window.onload = async function () {
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID, 
        callback: async function(response) {
            const loginMsg = document.getElementById('loginMessage');
            loginMsg.innerHTML = '🔄 正在驗證您的身分與權限...';
            loginMsg.className = 'text-blue-600 font-bold mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200';
            
            try {
                // 登入驗證不隨便重試，失敗就是失敗
                const result = await API.verifyLoginAPI(response.credential);
                if (!result.success) throw new Error(result.message);

                if (result.status === 'PENDING') {
                    loginMsg.innerHTML = `⏳ ${result.message}`;
                    loginMsg.className = 'text-orange-600 font-bold mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200';
                    return; 
                }

                if (result.status === 'ACTIVE') {
                    STATE.globalAuthToken = response.credential;
                    STATE.tenantUid = result.uid; 
                    
                    document.getElementById('loginScreen').classList.add('hidden');
                    const mainApp = document.getElementById('mainApp');
                    mainApp.classList.remove('hidden');
                    setTimeout(() => { mainApp.classList.remove('opacity-0'); }, 100);
                    
                    showToast(`✅ 登入成功！目前可用點數：${result.totalPoints}`, 'success');
                    
                    await window.initSystemData(); 
                    
                    if (typeof window.initAgentCapsule === 'function') {
                        window.initAgentCapsule();
                        window.initInteractions(); 

                        setTimeout(async () => {
                            await window.addAgentLog('專案總監', '👨‍💼', '總編您好！BrandDecoder 行動工作室已就緒，等待您的指令。');
                            await window.addAgentLog('社群總監', '🚀', '目前尚未指定發佈平台，請先在左側為我們勾選戰場 (FB / IG / Threads)！');
                            await window.addAgentLog('美術總監', '👨‍🎨', '報告總編，目前預設為「🌈 彩色模式」與「1:1 正方比例」，您可以隨時依據企劃切換喔！');
                        }, 1000);
                    }
                }
            } catch (error) {
                loginMsg.innerHTML = `❌ 登入失敗：${error.message}`;
                loginMsg.className = 'text-red-600 font-bold mt-4 p-3 bg-red-50 rounded-lg border border-red-200';
            }
        }
    });

    google.accounts.id.renderButton(
        document.getElementById("googleButtonDiv"),
        { theme: "outline", size: "large", width: 300, shape: "pill" }
    );

    window.addEventListener('resize', () => {
        const consoleEl = document.getElementById('aiTeamConsole');
        if (!consoleEl) return;
        
        if (window.innerWidth >= 1024) {
            const logEl = document.getElementById('aiTeamConsoleLog');
            const previewDiv = document.getElementById('aiCapsulePreview');
            if(logEl) logEl.classList.remove('hidden');
            if(previewDiv) previewDiv.classList.add('hidden');
        } else {
             if(consoleEl.dataset.capsuleInit === 'true') {
                 const logEl = document.getElementById('aiTeamConsoleLog');
                 const previewDiv = document.getElementById('aiCapsulePreview');
                 if(logEl) logEl.classList.add('hidden');
                 if(previewDiv) previewDiv.classList.remove('hidden');
                 document.getElementById('capsuleToggleIcon').innerText = '👇';
             }
        }
    });
};


// ==========================================
// 🚀 6. 核心流程 Step 1：AI 撰寫腳本
// ==========================================
document.getElementById('agentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const publishBtn = document.getElementById('btnPublish');
    if (publishBtn) {
        publishBtn.className = 'w-2/3 text-white bg-green-600 hover:bg-green-700 font-black rounded-xl text-lg px-4 py-4 shadow-lg transition-all';
        publishBtn.onclick = window.publishToSocial; 
        publishBtn.innerHTML = '🚀 立刻發射！'; 
    }
    
    const backBtn = document.querySelector('button[onclick="window.backToStep2()"]');
    if (backBtn) backBtn.classList.remove('hidden');
    
    const topResetBtn = document.querySelector('button[onclick="window.resetToStep1()"]');
    if (topResetBtn && topResetBtn !== publishBtn) topResetBtn.classList.remove('hidden');

    const selectedPlatforms = [];
    if(document.getElementById('platFB').checked) selectedPlatforms.push('FB');
    if(document.getElementById('platIG').checked) selectedPlatforms.push('IG');
    if(document.getElementById('platThreads').checked) selectedPlatforms.push('THREADS');
    if(selectedPlatforms.length === 0) return showToast('❌ 請至少勾選一個目標發布平台！', 'error');

    const topic = document.getElementById('topic').value.trim();
    if (!topic) return showToast('❌ 請輸入主題！', 'error');

    const btn = document.getElementById('btnStep1Submit');
    const btnText = document.getElementById('btnTextStep1');
    btn.disabled = true; 
    btn.classList.replace('bg-blue-600', 'bg-gray-500'); 
    btnText.innerHTML = '⚡ 執行中，請看上方進度...';
    
    if (typeof window.addAgentLog === 'function') {
        await window.addAgentLog('專案總監', '👨‍💼', '收到貼文任務！正在為您打包卷宗，並解析平台設定...', true);
    }

    try {
        const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
        let promptStyle = ''; 
        let negativeStyle = ''; 
        let styleName = '預設風格';
        
        if (selectedStyleId && STATE.globalSystemStyles) {
            const styleObj = STATE.globalSystemStyles.find(s => s.id === selectedStyleId);
            if (styleObj) {
                promptStyle = styleObj.promptPrefix || '';
                negativeStyle = styleObj.negativePrompt || '';
                styleName = styleObj.name || '預設風格';
            }
        }
        STATE.currentStyleName = styleName;

        const colorModeElement = document.querySelector('input[name="colorMode"]:checked');
        const colorModeValue = colorModeElement ? colorModeElement.value : 'COLOR';
        const isBW = colorModeValue === 'BW'; 

        const payload = {
            tenantId: getTenantIdFromToken(), 
            platforms: selectedPlatforms, 
            topic: topic, 
            isComicMode: STATE.isComicModeActive,
            colorMode: colorModeValue, 
            aspectRatio: document.getElementById('aspectRatioSelect').value, 
            style: promptStyle,             
            negativePrompt: negativeStyle, 
            resolution: document.getElementById('resolutionSelect').value, 
            comicCharacters: [], 
            image_options: { referenceImages: [] }
        };

        const charItems = document.querySelectorAll('#characterList .char-item');
        if (charItems.length > 0 && typeof window.addAgentLog === 'function') {
            await window.addAgentLog('視覺工程師', '👁️', `已再次確認候場區的 ${charItems.length} 位角色，正在將特徵轉換為 AI 參數...`, true);
        }
        
        for (let item of charItems) {
            const name = item.querySelector('[name="charName"]')?.value.trim() || '';
            const persona = item.querySelector('[name="charPersona"]')?.value.trim() || '';
            if (!name) continue;
            
            const dbFeatures = item.querySelector('.char-db-features')?.value;
            const imageUrl = item.querySelector('.char-image-url')?.value;
            
            payload.comicCharacters.push({ name, persona, aiExtractedFeatures: dbFeatures }); 
            if (imageUrl) {
                payload.image_options.referenceImages.push({ type: 'character', name: name, imageUrl: imageUrl });
            }
        }

        let totalFilesToCompress = (STATE.sceneFiles ? STATE.sceneFiles.length : 0) + (STATE.objectFiles ? STATE.objectFiles.length : 0);
        if (totalFilesToCompress > 0 && typeof window.addAgentLog === 'function') {
            await window.addAgentLog('影像處理組', '📐', `已確認 ${totalFilesToCompress} 張實境參考圖，正在進行邊緣特徵分析...`, true);
        }

        if (!document.getElementById('skipScene').checked) {
            for (let file of (STATE.sceneFiles || [])) {
                const base64Img = await compressImageToBase64(file, 600, isBW); 
                if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_background', ...base64Img });
            }
        }
        
        if (!document.getElementById('skipObject').checked) {
            for (let file of (STATE.objectFiles || [])) {
                const base64Img = await compressImageToBase64(file, 600, isBW); 
                if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_object', ...base64Img });
            }
        }

        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('首席文案', '✍️', '所有素材蒐集完畢！正在與 Gemini 大腦連線，為您撰寫社群腳本...', true);
        }
        
        // 🛡️ 套用重試防禦
        const result = await window.executeWithRetry(
            () => API.createDraftAPI(payload),
            '首席文案',
            '腳本大腦連線'
        );
        
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('系統管理員', '⚙️', '草稿接收成功！正在為您渲染排版...', false);
        }
        
        STATE.currentTaskId = result.taskId; 
        STATE.multiImages = [{ id: `img_ai_cover_${Date.now()}`, originalUrl: '', processType: 'AI_SYNTHESIS' }];
        
        if (typeof window.renderMultiImages === 'function') {
            window.renderMultiImages();
        }

        document.getElementById('step1-setup').classList.add('hidden');
        document.getElementById('step2-review').classList.remove('hidden');
        
        const badge2 = document.getElementById('step2StyleBadge');
        if (badge2) badge2.innerText = `🎨 畫風：${STATE.currentStyleName}`;
        
        document.getElementById('reviewCaption').value = result.draftContent.post_caption;
        
        const panelsContainer = document.getElementById('reviewPanelsContainer');
        if (result.isComicMode && result.draftContent.panels) {
            panelsContainer.classList.remove('hidden');
            let panelsHtml = '<label class="block text-sm font-bold text-gray-700 mb-2">🎬 分鏡腳本確認</label>';
            
            result.draftContent.panels.forEach(p => {
                panelsHtml += `<div class="mb-4 p-4 bg-white rounded-xl shadow-sm">
                    <p class="text-xs text-gray-500">🎥 ${p.action_zh}</p>
                    <p class="text-xs font-bold text-indigo-600 mb-2">🗣️ ${p.speaker_zh}</p>
                    <textarea id="panel_${p.panel_number}" class="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm">${p.dialogue}</textarea>
                </div>`;
            });
            panelsContainer.innerHTML = panelsHtml;
        } else { 
            panelsContainer.classList.add('hidden'); 
        }
        
        showToast('✅ 腳本生成完畢，請進行最終確認！', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('專案總監', '⏸️', '腳本已就緒！等待總編審核修改，確認無誤後即可進入下一步。', false);
        }

    } catch (error) {
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('系統警報', '🚨', `發生錯誤: ${error.message}`, false);
        }
        showToast(`❌ 發生錯誤: ${error.message}`, 'error');
        console.error(error); 
    } finally {
        btn.disabled = false; 
        btn.classList.replace('bg-gray-500', 'bg-blue-600'); 
        btnText.innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本';
    }
});


// ==========================================
// 🎨 7. 核心流程 Step 2：發包生圖
// ==========================================
window.submitForImageGeneration = async function() {
    const btn = document.getElementById('btnStep2Submit');
    const btnText = document.getElementById('btnTextStep2');
    
    if (!STATE.multiImages || STATE.multiImages.length === 0) {
        return showToast('❌ 貼文至少需要 1 張圖片！請上傳原圖或新增 AI 算圖。', 'error');
    }

    btn.disabled = true; 
    btn.classList.replace('bg-indigo-600', 'bg-gray-500'); 
    btnText.innerHTML = '🎨 執行中，請看上方進度...';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof window.addAgentLog === 'function') {
        await window.addAgentLog('美術總監', '👨‍🎨', '收到發包指令！正在打包您修改後的劇本與圖文參數...', true);
    }

    const editedCaption = document.getElementById('reviewCaption').value;
    const editedPanels = [];
    if (STATE.isComicModeActive) {
        for(let i=1; i<=4; i++) {
            const ta = document.getElementById(`panel_${i}`);
            if(ta) editedPanels.push({ panel_number: i, dialogue: ta.value });
        }
    }

    const incomingImagesPayload = STATE.multiImages.map(img => ({
        processType: img.processType,
        originalUrl: img.originalUrl
    }));

    try {
        let aiCount = incomingImagesPayload.filter(img => img.processType === 'AI_SYNTHESIS').length;
        if(aiCount > 0 && typeof window.addAgentLog === 'function') {
            await window.addAgentLog('算圖農場', '🤖', `正在為您極速生成 ${aiCount} 張高畫質圖片 (約需等候幾十秒，請耐心)...`, true);
        } else if(typeof window.addAgentLog === 'function') {
            await window.addAgentLog('影像處理組', '☁️', `正在為您將原圖安全上傳至雲端空間...`, true);
        }

        // 🛡️ 套用重試防禦
        const result = await window.executeWithRetry(
            () => API.generateImageAPI({ 
                taskId: STATE.currentTaskId, 
                tenantId: getTenantIdFromToken(), 
                editedCaption, 
                editedPanels,
                incomingImages: incomingImagesPayload
            }),
            '算圖農場',
            '雲端繪圖運算'
        );
        
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('系統管理員', '✨', '圖片處理完畢！正在為您準備最終發射控制台...', false);
        }

        document.getElementById('step2-review').classList.add('hidden');
        document.getElementById('step3-publish').classList.remove('hidden');
        
        const badge3 = document.getElementById('step3StyleBadge');
        if (badge3) badge3.innerText = `🎨 畫風：${STATE.currentStyleName}`;
        
        let imagesHtml = '';
        if (result.images && result.images.length > 0) {
            result.images.forEach(img => {
                imagesHtml += `<img src="${img.finalUrl}" class="w-full object-cover rounded-xl shadow-sm border border-gray-200 animate-fade-in" style="aspect-ratio: 1/1;">`;
            });
            document.getElementById('finalImageContainer').innerHTML = `<div class="grid grid-cols-2 gap-3 w-full p-3">${imagesHtml}</div>`;
        } else {
            document.getElementById('finalImageContainer').innerHTML = `<img src="${result.imageUrl}" class="w-full rounded-xl shadow-md border animate-fade-in">`;
        }

        document.getElementById('finalCaptionDisplay').value = editedCaption;
        showToast('✅ 圖片處理完畢！', 'success'); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('社群總監', '⏸️', '圖文皆已準備就緒！請確認最終文字，隨時可以為您發射！', false);
        }
        
    } catch (error) {
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('系統警報', '🚨', `生圖失敗: ${error.message}`, false);
        }
        showToast(`❌ 生圖失敗: ${error.message}`, 'error');
    } finally {
        btn.disabled = false; 
        btn.classList.replace('bg-gray-500', 'bg-indigo-600'); 
        btnText.innerHTML = '<span class="text-xl mr-2">🎨</span> 2️⃣ 第二步：發包生圖';
    }
};


// ==========================================
// 🚀 8. 核心流程 Step 3：一鍵發佈與預約排程
// ==========================================
window.publishToSocial = async function() {
    const btn = document.getElementById('btnPublish');
    btn.disabled = true;
    
    const scheduleInput = document.getElementById('scheduleTime');
    const scheduledAt = scheduleInput && scheduleInput.value ? new Date(scheduleInput.value).toISOString() : null;
    const isScheduled = !!scheduledAt;
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (isScheduled && typeof window.addAgentLog === 'function') {
        await window.addAgentLog('系統管理員', '🗓️', `正在將任務寫入排程隊列，預計於 ${scheduleInput.value} 發射...`, true);
    } else if(typeof window.addAgentLog === 'function') {
        await window.addAgentLog('社群總監', '🚀', '收到發射指令！正在啟動發射程序，為您打包圖文與 Hashtag...', true);
    }

    try {
        // 🛡️ 套用重試防禦
        const result = await window.executeWithRetry(
            () => API.publishContentAPI({ 
                taskId: STATE.currentTaskId, 
                tenantId: getTenantIdFromToken(), 
                finalCaption: document.getElementById('finalCaptionDisplay').value, 
                scheduledAt: scheduledAt 
            }),
            '社群總監',
            '社群平台發射'
        );
        
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('系統管理員', '✅', isScheduled ? '排程寫入成功！機器人會準時發射！' : '發送成功！圖文已成功飛上社群平台！', false);
        }
        
        btn.innerHTML = isScheduled ? '✅ 預約排程成功！' : '✅ 發布成功！'; 
        btn.classList.replace(isScheduled ? 'bg-indigo-600' : 'bg-green-600', 'bg-gray-500');
        showToast(isScheduled ? '🗓️ 排程成功！' : '🎉 發布成功！', 'success');

        // 🎊 多巴胺慶祝煙火
        if (!isScheduled && typeof confetti === 'function') {
            const duration = 2000;
            const end = Date.now() + duration;
            (function frame() {
                confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#3b82f6', '#10b981', '#fcd34d'] });
                confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#3b82f6', '#10b981', '#fcd34d'] });
                if (Date.now() < end) requestAnimationFrame(frame);
            }());
        }

        setTimeout(async () => {
            if (typeof window.addAgentLog === 'function') {
                await window.addAgentLog('專案總監', '🎉', '辛苦了！本次專案圓滿達成。如果需要，隨時可以啟動下一篇貼文任務！', false);
            }
            
            btn.disabled = false; 
            btn.classList.replace('bg-gray-500', 'bg-blue-600'); 
            btn.innerHTML = '✨ 太棒了！再來寫一篇新貼文！';
            btn.onclick = window.resetToStep1; 

            const backBtn = document.querySelector('button[onclick="window.backToStep2()"]');
            if (backBtn) backBtn.classList.add('hidden');
            
            const topResetBtn = document.querySelector('button[onclick="window.resetToStep1()"]');
            if (topResetBtn && topResetBtn !== btn) topResetBtn.classList.add('hidden');
        }, 2500); 

    } catch (error) {
        if (typeof window.addAgentLog === 'function') {
            await window.addAgentLog('系統警報', '🚨', `發佈失敗: ${error.message}`, false);
        }
        showToast(`❌ 發佈失敗: ${error.message}`, 'error'); 
        btn.disabled = false; 
        btn.innerHTML = isScheduled ? '🗓️ 重新預約排程' : '🚀 重試發射';
    }
};
