// js/main.js
import { CONFIG, STATE } from './config.js';
import { showToast, processFileToBase64 } from './utils.js';
import * as API from './api.js';
import * as UI from './ui.js';

// 🌟 把被 HTML 呼叫的函數掛載到全域 (Window)
window.switchMode = UI.switchMode;
window.toggleSection = UI.toggleSection;
window.addCharacterSlot = UI.addCharacterSlot;
window.previewCharImage = UI.previewCharImage;
window.handleFileSelect = UI.handleFileSelect;
window.removeFileFromArray = UI.removeFileFromArray;
window.resetToStep1 = UI.resetToStep1;

window.backToStep1 = function() {
    document.getElementById('step2-review').classList.add('hidden');
    document.getElementById('step1-setup').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// 🌟 初始化
window.onload = async function () {
    google.accounts.id.initialize({
        client_id: CONFIG.GOOGLE_CLIENT_ID, 
        callback: function(response) {
            STATE.globalAuthToken = response.credential;
            document.getElementById('loginScreen').classList.add('hidden');
            const mainApp = document.getElementById('mainApp');
            mainApp.classList.remove('hidden');
            setTimeout(() => { mainApp.classList.remove('opacity-0'); }, 100);
            showToast('✅ 登入成功！工廠引擎已發動。', 'success');
        }
    });
    google.accounts.id.renderButton(document.getElementById("googleButtonDiv"),{ theme: "outline", size: "large", width: 300, shape: "pill" });
    UI.addCharacterSlot("老K", "戴墨鏡的大叔");

    try {
        const result = await API.fetchSystemOptionsAPI();
        if (result.success) {
            STATE.globalSystemStyles = result.data.styles;
            STATE.globalSystemMotions = result.data.motions;
            UI.renderDynamicOptions('ANIME');
        }
    } catch (error) {
        document.getElementById('styleRadioContainer').innerHTML = '<span class="text-red-500 font-bold">無法連線至選項庫</span>';
    }
};

// 🌟 提交步驟一
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
    const payload = {
        platforms: selectedPlatforms, topic: topic, isComicMode: STATE.isComicModeActive,
        aspectRatio: document.getElementById('aspectRatioSelect').value,
        style: selectedStyleRadio ? selectedStyleRadio.value : '', 
        resolution: document.getElementById('resolutionSelect').value,
        comicCharacters: [], image_options: { referenceImages: [] }
    };

    const charItems = document.querySelectorAll('#characterList .char-item');
    for (let item of charItems) {
        const name = item.querySelector('[name="charName"]').value.trim();
        const persona = item.querySelector('[name="charPersona"]').value.trim();
        if (!name) continue;
        payload.comicCharacters.push({ name, persona }); 
        const fileInput = item.querySelector('[name="charAvatar"]');
        if(fileInput.files.length > 0) {
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

// 🌟 發包生圖
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

// 🌟 發布社群
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

// 🌟 生成影片
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
