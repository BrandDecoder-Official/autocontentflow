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
// 🚀 升級：手機防當機「前端圖片壓縮 & 濾鏡引擎」
// ==========================================
function compressImageToBase64(file, maxWidth = 1024, forceGrayscale = false) {
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

                if (forceGrayscale) {
                    const imageData = ctx.getImageData(0, 0, width, height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                        data[i] = luminance;     
                        data[i + 1] = luminance; 
                        data[i + 2] = luminance; 
                    }
                    ctx.putImageData(imageData, 0, 0);
                }

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

// 🌟 返回功能
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

// ==========================================
// 🌟 系統初始化與角色操作
// ==========================================
window.initSystemData = async function() {
    try {
        const tenantId = getTenantIdFromToken();
        const optionsRes = await API.fetchSystemOptionsAPI(tenantId);
        if (optionsRes.success) {
            STATE.globalSystemStyles = optionsRes.data.styles || [];
            if (typeof UI.renderDynamicOptions === 'function') {
                UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', optionsRes.data);
            }
        } else {
            showToast('❌ 畫風載入失敗: ' + optionsRes.message, 'error');
        }
    } catch (error) {
        console.error('初始化系統資料錯誤:', error);
        showToast('❌ 無法連線資料庫，請檢查網路', 'error');
    }
};

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
        const base64ImgInfo = await compressImageToBase64(fileInput.files[0], 800, false);
        const tenantId = getTenantIdFromToken();
        const payload = { name: name, imageBase64: base64ImgInfo.data, mimeType: base64ImgInfo.mimeType, tenantId: tenantId };
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
        btn.disabled = false; btn.innerHTML = '🧬 開始基因掃描';
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
                    await window.initSystemData(); 
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
// 🌟 處理圖片渲染與上傳
// ==========================================
window.renderMultiImages = function() {
    const container = document.getElementById('multiImageContainer');
    const countDisplay = document.getElementById('multiImageCountDisplay');
    countDisplay.innerText = STATE.multiImages.length; 
    container.innerHTML = '';

    STATE.multiImages.forEach((img, index) => {
        const isAI = img.processType === 'AI_SYNTHESIS';
        const hasOriginal = !!img.originalUrl;
        
        const div = document.createElement('div');
        div.className = `bg-white p-3 rounded-xl shadow-sm border ${!hasOriginal ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200'} flex items-center gap-3 relative animate-fade-in`;
        
        let html = `<button type="button" onclick="window.removeMultiImage('${img.id}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold transition-all shadow-sm z-10">&times;</button>`;
        html += `<img src="${hasOriginal ? img.originalUrl : 'https://cdn-icons-png.flaticon.com/512/8636/8636831.png'}" class="w-16 h-16 object-cover rounded-lg border ${!hasOriginal ? 'border-indigo-300 p-2 bg-white' : 'border-gray-200'}">`;
        html += `<div class="flex-grow">`;
        html += `<h4 class="font-bold text-gray-800 text-sm mb-1">${!hasOriginal ? '🌟 AI 腳本配圖' : '附加圖片 ' + (index + 1)}</h4>`;
        html += `<div class="flex bg-gray-100 rounded-lg p-1 w-max">
            <button type="button" onclick="window.toggleMultiImageType('${img.id}', 'AI_SYNTHESIS')" class="${isAI ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">🪄 AI 算圖</button>`;
        if (hasOriginal) {
            html += `<button type="button" onclick="window.toggleMultiImageType('${img.id}', 'ORIGINAL')" class="${!isAI ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-700'} text-xs font-bold px-3 py-1 rounded-md transition-all">📸 原圖直發</button>`;
        }
        html += `</div></div>`;
        
        div.innerHTML = html;
        container.appendChild(div);
    });

    if (STATE.multiImages.length < 10) {
        const addBtnDiv = document.createElement('div');
        addBtnDiv.className = "w-full mt-2 animate-fade-in";
        addBtnDiv.innerHTML = `<button type="button" onclick="window.addAITemplate()" class="w-full py-2 border-2 border-dashed border-indigo-300 text-indigo-500 rounded-xl hover:bg-indigo-50 text-sm font-bold transition-colors">➕ 新增一張 AI 算圖卡位</button>`;
        container.appendChild(addBtnDiv);
    }
};

window.addAITemplate = function() {
    if (STATE.multiImages.length >= 10) return showToast('❌ 最多只能 10 張圖片！', 'error');
    STATE.multiImages.push({
        id: `img_ai_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        originalUrl: '',
        processType: 'AI_SYNTHESIS'
    });
    window.renderMultiImages();
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

    // 🌟 修正：附加圖片強制不抽色，保留原圖色彩 (傳入 false)
    for (let file of newFiles) {
        showToast('📐 正在壓縮附加實拍圖片...', 'info');
        try {
            const compressed = await compressImageToBase64(file, 1024, false);
            STATE.multiImages.push({
                id: `img_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                originalUrl: `data:${compressed.mimeType};base64,${compressed.data}`,
                processType: 'ORIGINAL'
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
// 🚀 提交 Step 1：AI 撰寫腳本 (真實節點事件驅動版)
// ==========================================
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
    
    // 🌟 定義一個更新進度條的專屬小工具
    const updateProgress = (msg) => {
        const spinnerHtml = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        btnText.innerHTML = `${spinnerHtml} <span class="ml-1 text-sm animate-fade-in">${msg}</span>`;
    };

    // 📍 節點 1：前端資料收集與打包
    updateProgress('👨‍💼 專案經理：正在建立任務檔案與解析畫風設定...');

    try {
        const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
        let promptStyle = ''; let negativeStyle = ''; let styleName = '預設風格';
        
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
            tenantId: getTenantIdFromToken(), platforms: selectedPlatforms, topic: topic, isComicMode: STATE.isComicModeActive,
            colorMode: colorModeValue, aspectRatio: document.getElementById('aspectRatioSelect').value, style: promptStyle,             
            negativePrompt: negativeStyle, resolution: document.getElementById('resolutionSelect').value, comicCharacters: [], image_options: { referenceImages: [] }
        };

        // 📍 節點 2：處理角色特徵 (耗時極短)
        const charItems = document.querySelectorAll('#characterList .char-item');
        for (let item of charItems) {
            const name = item.querySelector('[name="charName"]')?.value.trim() || '';
            const persona = item.querySelector('[name="charPersona"]')?.value.trim() || '';
            if (!name) continue;
            const dbFeatures = item.querySelector('.char-db-features')?.value;
            const imageUrl = item.querySelector('.char-image-url')?.value;
            payload.comicCharacters.push({ name, persona, aiExtractedFeatures: dbFeatures }); 
            if (imageUrl) payload.image_options.referenceImages.push({ type: 'character', name: name, imageUrl: imageUrl });
        }

        // 📍 節點 3：開始處理實境圖片壓縮 (這是真實需要等待的耗時任務！)
        let totalFilesToCompress = (STATE.sceneFiles ? STATE.sceneFiles.length : 0) + (STATE.objectFiles ? STATE.objectFiles.length : 0);
        if (totalFilesToCompress > 0) {
            updateProgress(`👁️ 視覺工程師：正在為 ${totalFilesToCompress} 張參考圖進行壓縮與特徵分析...`);
        }

        if (!document.getElementById('skipScene').checked) {
            for (let file of (STATE.sceneFiles || [])) {
                const base64Img = await compressImageToBase64(file, 1024, isBW);
                if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_background', ...base64Img });
            }
        }
        if (!document.getElementById('skipObject').checked) {
            for (let file of (STATE.objectFiles || [])) {
                const base64Img = await compressImageToBase64(file, 1024, isBW);
                if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_object', ...base64Img });
            }
        }

        // 📍 節點 4：發送 API 給後端 Gemini (這是最漫長的等待)
        updateProgress('✍️ 首席文案：正在與 AI 大腦連線，為您撰寫極具爆發力的社群對白...');
        
        const result = await API.createDraftAPI(payload);
        if (!result.success) throw new Error(result.message);
        
        // 📍 節點 5：後端回傳成功，開始渲染畫面
        updateProgress('⚙️ 系統：草稿接收成功，正在為您渲染排版...');
        
        STATE.currentTaskId = result.taskId; 
        STATE.multiImages = [{ id: `img_ai_cover_${Date.now()}`, originalUrl: '', processType: 'AI_SYNTHESIS' }];
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
        btnText.innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本';
    }
});


// ==========================================
// 🎨 提交 Step 2：發包生圖 (真實節點事件驅動版)
// ==========================================
window.submitForImageGeneration = async function() {
    const btn = document.getElementById('btnStep2Submit');
    const btnText = document.getElementById('btnTextStep2');
    
    if (!STATE.multiImages || STATE.multiImages.length === 0) {
        return showToast('❌ 貼文至少需要 1 張圖片！請上傳原圖或新增 AI 算圖。', 'error');
    }

    btn.disabled = true; 
    btn.classList.replace('bg-indigo-600', 'bg-gray-500'); 
    
    const updateProgress = (msg) => {
        const spinnerHtml = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        btnText.innerHTML = `${spinnerHtml} <span class="ml-1 text-sm animate-fade-in">${msg}</span>`;
    };

    // 📍 節點 1：前端收集修改過的資料
    updateProgress('👨‍🎨 美術總監：正在打包您修改後的劇本與圖文參數...');

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
        // 📍 節點 2：呼叫 Imagen/雲端大腦 (這是耗時最久的任務)
        let aiCount = incomingImagesPayload.filter(img => img.processType === 'AI_SYNTHESIS').length;
        if(aiCount > 0) {
            updateProgress(`🤖 算圖農場：正在為您極速生成 ${aiCount} 張圖片 (約需等候幾十秒，請耐心)...`);
        } else {
            updateProgress(`☁️ 系統：正在為您將原圖安全上傳至雲端空間...`);
        }

        const result = await API.generateImageAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: getTenantIdFromToken(), 
            editedCaption, 
            editedPanels,
            incomingImages: incomingImagesPayload
        });
        if (!result.success) throw new Error(result.message);
        
        // 📍 節點 3：生圖成功，開始接收圖片並渲染
        updateProgress('✨ 系統：圖片處理完畢，正在準備發射控制台...');

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
        showToast('✅ 圖片處理完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast(`❌ 生圖失敗: ${error.message}`, 'error');
    } finally {
        btn.disabled = false; 
        btn.classList.replace('bg-gray-500', 'bg-indigo-600'); 
        btnText.innerHTML = '<span class="text-xl mr-2">🎨</span> 2️⃣ 第二步：發包生圖';
    }
};


// ==========================================
// 🚀 提交 Step 3：一鍵發佈與預約排程
// ==========================================
window.publishToSocial = async function() {
    const btn = document.getElementById('btnPublish');
    btn.disabled = true;
    
    const scheduleInput = document.getElementById('scheduleTime');
    const scheduledAt = scheduleInput && scheduleInput.value ? new Date(scheduleInput.value).toISOString() : null;
    const isScheduled = !!scheduledAt;
    
    const spinnerHtml = `<svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

    if (isScheduled) {
        btn.innerHTML = `${spinnerHtml} 🗓️ 正在寫入預約排程...`;
    } else {
        const loadingMessages = [
            '🚀 系統管理員：正在啟動發射程序...',
            '📦 系統管理員：正在打包您的精美圖片...',
            '⏳ 系統管理員：圖片傳輸至 Meta 伺服器中...',
            '🧵 系統管理員：正在為 IG/Threads 建立輪播相簿...',
            '✨ 進入最後發佈階段，請勿關閉網頁！...'
        ];
        let msgIndex = 0;
        btn.innerHTML = `${spinnerHtml} <span class="ml-1 text-sm">${loadingMessages[0]}</span>`;
        
        window.loadingInterval = setInterval(() => {
            msgIndex++;
            if (msgIndex < loadingMessages.length) {
                btn.innerHTML = `${spinnerHtml} <span class="ml-1 text-sm animate-fade-in">${loadingMessages[msgIndex]}</span>`;
            }
        }, 5000);
    }

    try {
        const result = await API.publishContentAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: getTenantIdFromToken(), 
            finalCaption: document.getElementById('finalCaptionDisplay').value, 
            scheduledAt: scheduledAt 
        });
        
        if (window.loadingInterval) clearInterval(window.loadingInterval);
        
        if (!result.success) throw new Error(result.message);
        
        btn.innerHTML = isScheduled ? '✅ 預約排程成功！' : '✅ 發布成功！'; 
        btn.classList.replace(isScheduled ? 'bg-indigo-600' : 'bg-green-600', 'bg-gray-500');
        showToast(isScheduled ? '🗓️ 任務已加入排程隊列！機器人會準時發射！' : '🎉 圖文已成功飛上社群平台！', 'success');
    } catch (error) {
        if (window.loadingInterval) clearInterval(window.loadingInterval);
        showToast(`❌ 發佈/排程失敗: ${error.message}`, 'error'); 
        btn.disabled = false; 
        btn.innerHTML = isScheduled ? '🗓️ 重新預約排程' : '🚀 重試發射';
    }
};

window.generateVideo = async function() {
    const btn = document.getElementById('btnGenerateVideo');
    if (!STATE.currentTaskId) return showToast('❌ 找不到任務 ID！', 'error');
    try {
        btn.disabled = true; btn.innerHTML = '⏳ 影片運算中...'; btn.classList.replace('bg-white', 'bg-indigo-100'); btn.classList.replace('text-indigo-600', 'text-indigo-400');
        showToast('🎬 正在呼叫 Veo 引擎...', 'info');
        const result = await API.generateVideoAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: getTenantIdFromToken(), 
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
