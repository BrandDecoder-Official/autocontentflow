// js/main.js
import { CONFIG, STATE } from './config.js';
import { showToast } from './utils.js'; 
import * as API from './api.js';
import * as UI from './ui.js';

// ==========================================
// 🌟 綁定 UI 函數到全域 (Window)
// ==========================================
window.switchMode = UI.switchMode;
window.toggleSection = UI.toggleSection;
window.previewCharImage = UI.previewCharImage;
window.handleFileSelect = UI.handleFileSelect;
window.removeFileFromArray = UI.removeFileFromArray;
window.resetToStep1 = UI.resetToStep1;
window.openCreateCharModal = UI.openCreateCharModal;
window.closeCreateCharModal = UI.closeCreateCharModal;

// ==========================================
// 🚀 新增：手機防當機「前端圖片壓縮引擎」
// ==========================================
function compressImageToBase64(file, maxWidth = 1024) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                
                resolve({
                    data: compressedDataUrl.replace(/^data:image\/\w+;base64,/, ""),
                    mimeType: 'image/jpeg'
                });
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// 🌟 解析 Google JWT Token 取得 User ID 
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

// 🌟 返回第一步
window.backToStep1 = function() {
    document.getElementById('step2-review').classList.add('hidden');
    document.getElementById('step1-setup').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==========================================
// 🌟 角色庫相關操作
// ==========================================

window.addCharacterFromDB = (dbChar) => {
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
        const base64ImgInfo = await compressImageToBase64(fileInput.files[0], 800);
        const tenantId = getTenantIdFromToken();

        const payload = {
            name: name,
            imageBase64: base64ImgInfo.data,
            mimeType: base64ImgInfo.mimeType,
            tenantId: tenantId
        };

        const result = await API.createCharacterAPI(payload);
        
        if (!result.success) throw new Error(result.message);
        
        showToast(result.message, 'success');
        UI.closeCreateCharModal();
        
        const optionsRes = await API.fetchSystemOptionsAPI(tenantId);
        if(optionsRes.success) {
            UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', optionsRes.data);
        }
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
        const result = await API.deleteCharacterAPI({ charId, tenantId });
        if (!result.success) throw new Error(result.message);
        showToast('✅ 角色已成功刪除！', 'success');
        const optionsRes = await API.fetchSystemOptionsAPI(tenantId);
        if(optionsRes.success) {
            UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', optionsRes.data);
        }
    } catch(error) {
        showToast(`❌ 刪除失敗: ${error.message}`, 'error');
    }
};

// ==========================================
// 🌟 系統初始化
// ==========================================
window.onload = async function () {
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID, 
        callback: async function(response) {
            const loginMsg = document.getElementById('loginMessage');
            loginMsg.innerHTML = '🔄 正在驗證您的身分與權限...';
            loginMsg.className = 'text-blue-600 font-bold mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200';
            
            try {
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

                    // 若要啟動管理員介面，可在此呼叫檢查
                    // if(result.role === 'ADMIN') document.getElementById('adminDashboard').classList.remove('hidden');

                    if (typeof window.initSystemData === 'function') {
                        await window.initSystemData(); 
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
};


// ==========================================
// 🌟 新增：多圖混搭狀態管理與渲染引擎
// ==========================================
window.renderMultiImages = function() {
    const container = document.getElementById('multiImageContainer');
    const countDisplay = document.getElementById('multiImageCountDisplay');
    if(!STATE.multiImages) STATE.multiImages = [];

    // 若為 0，預設會算 1 張 AI 圖
    countDisplay.innerText = STATE.multiImages.length === 0 ? 1 : STATE.multiImages.length; 

    if (STATE.multiImages.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex items-center justify-between">
                <div class="flex items-center">
                    <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-500 text-xl mr-3">🤖</div>
                    <div>
                        <h4 class="font-bold text-gray-800 text-sm">預設 AI 算圖</h4>
                        <p class="text-xs text-gray-500">將根據您的腳本生成 1 張圖片</p>
                    </div>
                </div>
                <span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">AI 合成</span>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    STATE.multiImages.forEach((img, index) => {
        const isAI = img.processType === 'AI_SYNTHESIS';
        const div = document.createElement('div');
        div.className = "bg-white p-3 rounded-xl shadow-sm border border-indigo-100 flex items-center gap-3 relative animate-fade-in";
        div.innerHTML = `
            <button type="button" onclick="window.removeMultiImage('${img.id}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold transition-all shadow-sm z-10">&times;</button>
            <img src="${img.originalUrl}" class="w-16 h-16 object-cover rounded-lg border border-gray-200">
            <div class="flex-grow">
                <h4 class="font-bold text-gray-800 text-sm mb-1">圖片 ${index + 1}</h4>
                <div class="flex bg-gray-100 rounded-lg p-1 w-max">
                    <button type="button" onclick="window.toggleMultiImageType('${img.id}', 'AI_SYNTHESIS')" class="${isAI ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">🪄 AI 算圖</button>
                    <button type="button" onclick="window.toggleMultiImageType('${img.id}', 'ORIGINAL')" class="${!isAI ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">📸 原圖直發</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
};

window.handleMultiImageSelect = async function(input) {
    const maxAllowed = 10;
    const currentCount = STATE.multiImages ? STATE.multiImages.length : 0;
    const newFiles = Array.from(input.files);

    if (currentCount + newFiles.length > maxAllowed) {
        showToast(`❌ 最多只能上傳 ${maxAllowed} 張圖片！`, 'error');
        return;
    }

    if (!STATE.multiImages) STATE.multiImages = [];

    for (let file of newFiles) {
        showToast('📐 正在壓縮並載入圖片...', 'info');
        try {
            const compressed = await compressImageToBase64(file, 1024);
            STATE.multiImages.push({
                id: `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                originalUrl: `data:${compressed.mimeType};base64,${compressed.data}`,
                processType: 'AI_SYNTHESIS' // 預設進來都是 AI 算圖，讓用戶自己切
            });
        } catch(e) {
            console.error(e);
            showToast('❌ 圖片壓縮失敗', 'error');
        }
    }
    input.value = ''; 
    window.renderMultiImages();
};

window.removeMultiImage = function(id) {
    STATE.multiImages = STATE.multiImages.filter(img => img.id !== id);
    window.renderMultiImages();
};

window.toggleMultiImageType = function(id, type) {
    const img = STATE.multiImages.find(i => i.id === id);
    if(img) img.processType = type;
    window.renderMultiImages();
};


// ==========================================
// 🌟 流程提交控制
// ==========================================

// 提交步驟一：生成腳本
document.getElementById('agentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnStep1Submit');
    const btnText = document.getElementById('btnTextStep1');
    
    const selectedPlatforms = [];
    if(document.getElementById('platFB').checked) selectedPlatforms.push('FB');
    if(document.getElementById('platIG').checked) selectedPlatforms.push('IG');
    if(document.getElementById('platThreads').checked) selectedPlatforms.push('THREADS');
    if(selectedPlatforms.length === 0) return showToast('❌ 請至少勾選一個目標發布平台！', 'error');

    const topic = document.getElementById('topic').value.trim();
    if (!topic) return showToast('❌ 請輸入主題！', 'error');

    btn.disabled = true; 
    btn.classList.replace('bg-blue-600', 'bg-gray-500'); 
    btnText.innerText = '🧠 壓縮圖片並呼叫大腦中...';
    
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

        const payload = {
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
        for (let item of charItems) {
            const name = item.querySelector('[name="charName"]')?.value.trim() || '';
            const persona = item.querySelector('[name="charPersona"]')?.value.trim() || '';
            if (!name) continue;

            const dbFeatures = item.querySelector('.char-db-features')?.value;
            const imageUrl = item.querySelector('.char-image-url')?.value;

            const charObj = { name, persona };
            if (dbFeatures) charObj.aiExtractedFeatures = dbFeatures;
            payload.comicCharacters.push(charObj); 

            if (imageUrl) {
                payload.image_options.referenceImages.push({ type: 'character', name: name, imageUrl: imageUrl });
            }
        }

        if (!document.getElementById('skipScene').checked) {
            for (let file of (STATE.sceneFiles || [])) {
                showToast('📐 正在壓縮場景圖片...', 'info');
                const base64Img = await compressImageToBase64(file, 1024);
                if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_background', ...base64Img });
            }
        }
        if (!document.getElementById('skipObject').checked) {
            for (let file of (STATE.objectFiles || [])) {
                showToast('📐 正在壓縮道具圖片...', 'info');
                const base64Img = await compressImageToBase64(file, 1024);
                if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_object', ...base64Img });
            }
        }

        const result = await API.createDraftAPI(payload);
        if (!result.success) throw new Error(result.message);
        
        STATE.currentTaskId = result.taskId; 
        
        // 🌟 核心：進入第二步前，清空多圖狀態並渲染預設介面
        STATE.multiImages = [];
        window.renderMultiImages();

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
                    <p class="text-xs text-gray-500">🎥 ${p.action_zh}</p><p class="text-xs font-bold text-indigo-600 mb-2">🗣️ ${p.speaker_zh}</p>
                    <textarea id="panel_${p.panel_number}" class="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm">${p.dialogue}</textarea></div>`;
            });
            panelsContainer.innerHTML = panelsHtml;
        } else { panelsContainer.classList.add('hidden'); }
        
        showToast('✅ 腳本生成完畢，請進行最終確認！', 'success');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        showToast(`❌ 發生錯誤: ${error.message}`, 'error');
        console.error(error); 
    } finally {
        btn.disabled = false; 
        btn.classList.replace('bg-gray-500', 'bg-blue-600'); 
        btnText.innerText = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本';
    }
});

// 🌟 修改：提交步驟二 (發包生圖，包含多圖陣列傳輸)
window.submitForImageGeneration = async function() {
    const btn = document.getElementById('btnStep2Submit');
    btn.disabled = true; document.getElementById('btnTextStep2').innerText = '🎨 正在極速生圖中...';
    
    const editedCaption = document.getElementById('reviewCaption').value;
    const editedPanels = [];
    if (STATE.isComicModeActive) {
        for(let i=1; i<=4; i++) {
            const ta = document.getElementById(`panel_${i}`);
            if(ta) editedPanels.push({ panel_number: i, dialogue: ta.value });
        }
    }

    // 🌟 提取使用者設定好的多圖清單
    const incomingImagesPayload = (STATE.multiImages && STATE.multiImages.length > 0) 
        ? STATE.multiImages.map(img => ({
            processType: img.processType,
            originalUrl: img.originalUrl
        })) 
        : []; // 若為空，後端會自動墊一張預設 AI 圖

    try {
        const result = await API.generateImageAPI({ 
            taskId: STATE.currentTaskId, 
            editedCaption, 
            editedPanels,
            incomingImages: incomingImagesPayload // 👈 新增的秘密武器！
        });
        if (!result.success) throw new Error(result.message);
        
        document.getElementById('step2-review').classList.add('hidden');
        document.getElementById('step3-publish').classList.remove('hidden');
        
        const badge3 = document.getElementById('step3StyleBadge');
        if (badge3) badge3.innerText = `🎨 畫風：${STATE.currentStyleName}`;
        
        // 🌟 渲染生圖結果：將所有圖片以 Grid 方式呈現
        let imagesHtml = '';
        if (result.images && result.images.length > 0) {
            result.images.forEach(img => {
                imagesHtml += `<img src="${img.finalUrl}" class="w-full object-cover rounded-xl shadow-sm border border-gray-200 animate-fade-in" style="aspect-ratio: 1/1;">`;
            });
            document.getElementById('finalImageContainer').innerHTML = `<div class="grid grid-cols-2 gap-3 w-full p-3">${imagesHtml}</div>`;
        } else {
            // 相容舊後端格式
            document.getElementById('finalImageContainer').innerHTML = `<img src="${result.imageUrl}" class="w-full rounded-xl shadow-md border animate-fade-in">`;
        }

        document.getElementById('finalCaptionDisplay').value = editedCaption;
        showToast('✅ 圖片生成完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast(`❌ 生圖失敗: ${error.message}`, 'error');
    } finally {
        btn.disabled = false; document.getElementById('btnTextStep2').innerText = '🎨 2️⃣ 第二步：發包生圖';
    }
};

// 發布社群
window.publishToSocial = async function() {
    const btn = document.getElementById('btnPublish');
    btn.disabled = true; btn.innerHTML = '🚀 發射中...';
    try {
        const result = await API.publishContentAPI({ taskId: STATE.currentTaskId, finalCaption: document.getElementById('finalCaptionDisplay').value });
        if (!result.success) throw new Error(result.message);
        btn.innerHTML = '✅ 發布成功！'; btn.classList.replace('bg-green-600', 'bg-gray-500');
        document.getElementById('btnRegenerate').classList.add('hidden');
        showToast('🎉 圖文已成功飛上社群平台！', 'success');
    } catch (error) {
        showToast(`❌ 發佈失敗: ${error.message}`, 'error'); btn.disabled = false; btn.innerHTML = '🚀 重試發射';
    }
};

// 生成動態影片
window.generateVideo = async function() {
    const btn = document.getElementById('btnGenerateVideo');
    if (!STATE.currentTaskId) return showToast('❌ 找不到任務 ID！', 'error');
    try {
        btn.disabled = true; btn.innerHTML = '⏳ 影片運算中...'; btn.classList.replace('bg-white', 'bg-indigo-100'); btn.classList.replace('text-indigo-600', 'text-indigo-400');
        showToast('🎬 正在呼叫 Veo 引擎...', 'info');
        const result = await API.generateVideoAPI({
            taskId: STATE.currentTaskId,
            motionPrompt: document.getElementById('motionSelect').value,
            voiceProfile: {
                gender: document.getElementById('voiceGender').value,
                accent: document.getElementById('voiceAccent').value,
                tone: document.getElementById('voiceTone').value
            }
        });
        if (!result.success) throw new Error(result.message);
        showToast('✅ ' + result.message, 'success');
    } catch (error) {
        showToast("❌ 影音大腦錯誤", "error");
        btn.disabled = false; btn.innerHTML = '🎬 重新生成動態影片'; btn.classList.replace('bg-indigo-100', 'bg-white'); btn.classList.replace('text-indigo-400', 'text-indigo-600');
    }
};
