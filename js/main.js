// js/main.js
import { CONFIG, STATE } from './config.js';
import { showToast, processFileToBase64 } from './utils.js';
import * as API from './api.js';
import * as UI from './ui.js';

// ==========================================
// 🌟 綁定 UI 函數到全域 (Window)
// ==========================================
window.switchMode = UI.switchMode;
window.toggleSection = UI.toggleSection;
window.addCharacterSlot = UI.addCharacterSlot;
window.previewCharImage = UI.previewCharImage;
window.handleFileSelect = UI.handleFileSelect;
window.removeFileFromArray = UI.removeFileFromArray;
window.resetToStep1 = UI.resetToStep1;
window.openCreateCharModal = UI.openCreateCharModal;
window.closeCreateCharModal = UI.closeCreateCharModal;

// 🌟 解析 Google JWT Token 取得 User ID (共用小工具)
function getTenantIdFromToken() {
    if (!STATE.globalAuthToken) return 'test_user_001'; // 預設防呆
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

// 從資料庫加入角色到清單 (視覺化卡片升級版)
window.addCharacterFromDB = (dbChar) => {
    const list = document.getElementById('characterList');
    if (list.children.length >= 4) {
        showToast('❌ 最多只能新增 4 位角色！', 'error');
        return;
    }

    const item = document.createElement('div');
    // 🌟 改用更緊湊、帶有陰影的卡片設計
    item.className = 'char-item relative animate-fade-in flex items-start gap-3 bg-white p-3 border border-blue-200 rounded-xl shadow-sm mb-3 group'; 
    
    item.innerHTML = `
        <button type="button" onclick="this.closest('.char-item').remove()" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold transition-all shadow-sm z-10">&times;</button>
        
        <img src="${dbChar.imageUrl || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-100 flex-shrink-0 shadow-sm">
        
        <div class="flex-grow">
            <div class="flex items-center mb-1.5">
                <span class="font-black text-gray-800 text-sm mr-2">${dbChar.name}</span>
                <span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">
                    <span class="mr-1">🔒</span> 基因鎖定
                </span>
            </div>
            
            <input type="hidden" name="charName" value="${dbChar.name}">
            <input type="hidden" class="char-db-features" value="${dbChar.aiExtractedFeatures || ''}">
            
            <input type="text" name="charPersona" class="w-full p-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="可在此微調當前服裝/表情 (例如：穿著西裝、正在生氣)" value="${dbChar.persona || ''}">
        </div>
    `;
    list.appendChild(item);
    showToast(`✅ 已讓 ${dbChar.name} 進入候場區！`, 'success');
};

// 提交建立新角色
window.submitNewCharacter = async function() {
    const name = document.getElementById('newCharName').value.trim();
    const fileInput = document.getElementById('newCharImage');

    if (!name) return showToast('❌ 請輸入角色名稱！', 'error');
    if (!fileInput.files || fileInput.files.length === 0) return showToast('❌ 請上傳角色照片！', 'error');

    const btn = document.getElementById('btnSubmitNewChar');
    btn.disabled = true;
    btn.innerHTML = '🧬 正在掃描基因...';

    try {
        const base64ImgInfo = await processFileToBase64(fileInput.files[0]);
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
        
        // 重新載入畫面
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

// 刪除角色邏輯
window.deleteChar = async function(charId) {
    if (!confirm('⚠️ 確定要永久刪除這個角色嗎？\n雲端大頭照也會被同步清理喔！')) return;
    
    const tenantId = getTenantIdFromToken();

    try {
        showToast('🗑️ 正在清理雲端基因...', 'info');
        const result = await API.deleteCharacterAPI({ charId, tenantId });
        
        if (!result.success) throw new Error(result.message);
        showToast('✅ 角色已成功刪除！', 'success');
        
        // 重新載入畫面
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
            STATE.globalAuthToken = response.credential;
            document.getElementById('loginScreen').classList.add('hidden');
            const mainApp = document.getElementById('mainApp');
            mainApp.classList.remove('hidden');
            setTimeout(() => { mainApp.classList.remove('opacity-0'); }, 100);
            
            showToast('✅ 登入成功！正在載入您的專屬工作室...', 'success');

            // 🌟 登入成功後，帶著 User ID 去撈取「專屬角色庫」與「系統選項」
            const tenantId = getTenantIdFromToken();
            try {
                const result = await API.fetchSystemOptionsAPI(tenantId);
                if (result.success) {
                    STATE.globalSystemStyles = result.data.styles;
                    STATE.globalSystemMotions = result.data.motions;
                    UI.renderDynamicOptions('ANIME', result.data); 
                }
            } catch (error) {
                document.getElementById('styleRadioContainer').innerHTML = '<span class="text-red-500 font-bold">無法連線至選項庫</span>';
            }
        }
    });
    google.accounts.id.renderButton(document.getElementById("googleButtonDiv"),{ theme: "outline", size: "large", width: 300, shape: "pill" });
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

    btn.disabled = true; btn.classList.replace('bg-blue-600', 'bg-gray-500'); btnText.innerText = '🧠 大腦正在思考腳本 (約10秒)...';
    
    const selectedStyleRadio = document.querySelector('input[name="targetStyle"]:checked');
    let promptStyle = '';
    let negativeStyle = '';
    
    if (selectedStyleRadio) {
        const styleData = JSON.parse(selectedStyleRadio.value);
        promptStyle = styleData.prefix;
        negativeStyle = styleData.negative;
    }

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
        const name = item.querySelector('[name="charName"]').value.trim();
        const persona = item.querySelector('[name="charPersona"]').value.trim();
        if (!name) continue;

        const dbFeaturesInput = item.querySelector('.char-db-features');
        const dbFeatures = dbFeaturesInput ? dbFeaturesInput.value : undefined;

        const charObj = { name, persona };
        if (dbFeatures) charObj.aiExtractedFeatures = dbFeatures;
        
        payload.comicCharacters.push(charObj); 

        const fileInput = item.querySelector('[name="charAvatar"]');
        if(fileInput && fileInput.files.length > 0) {
            const base64Img = await processFileToBase64(fileInput.files[0]);
            if (base64Img) payload.image_options.referenceImages.push({ type: 'character', name, ...base64Img });
        }
    }

    if (!document.getElementById('skipScene').checked) {
        for (let file of STATE.sceneFiles) {
            const base64Img = await processFileToBase64(file);
            if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_background', ...base64Img });
        }
    }
    if (!document.getElementById('skipObject').checked) {
        for (let file of STATE.objectFiles) {
            const base64Img = await processFileToBase64(file);
            if (base64Img) payload.image_options.referenceImages.push({ type: 'scene_object', ...base64Img });
        }
    }

    try {
        const result = await API.createDraftAPI(payload);
        if (!result.success) throw new Error(result.message);
        STATE.currentTaskId = result.taskId; 
        document.getElementById('step1-setup').classList.add('hidden');
        document.getElementById('step2-review').classList.remove('hidden');
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
    } finally {
        btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-blue-600'); btnText.innerText = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本';
    }
});

// 提交步驟二：發包生圖
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

    try {
        const result = await API.generateImageAPI({ taskId: STATE.currentTaskId, editedCaption, editedPanels });
        if (!result.success) throw new Error(result.message);
        document.getElementById('step2-review').classList.add('hidden');
        document.getElementById('step3-publish').classList.remove('hidden');
        document.getElementById('finalImageContainer').innerHTML = `<img src="${result.imageUrl}" class="w-full rounded-xl shadow-md border animate-fade-in">`;
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
