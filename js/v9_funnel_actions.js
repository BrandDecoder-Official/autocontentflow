// js/v9_funnel_actions.js
import { STATE } from './config.js'; 
import { MISSION, SYSTEM_DB, recordGeneratedImageBatch } from './v9_state.js';
import { addLog, releaseUI, showError } from './v9_ui.js';
import { applyPointDeduction, validatePoints } from './v9_finance.js';
import { generateDraftAPI, generateImageFromDraftAPI } from './api.js'; 
import { renderDraftEditorCard, renderFinalPublishCard } from './v9_funnel_editor.js';

function buildReferenceImages() {
    const referenceImages = [];

    // 角色圖通常來自 DB URL，直接帶 imageUrl 讓後端可轉 base64。
    MISSION.characters.forEach(name => {
        const charData = SYSTEM_DB.characters.find(c => c.name === name);
        if (charData && charData.imageUrl) {
            referenceImages.push({ type: 'character', name, imageUrl: charData.imageUrl });
        }
    });

    // 場景圖可能是 dataUrl（本地上傳）或 imageUrl（DB 回填），兩者都傳。
    MISSION.sceneFiles.forEach((sf, idx) => {
        const sceneRef = { type: 'scene', name: sf.name || `scene_${idx + 1}` };
        if (sf.imageUrl) sceneRef.imageUrl = sf.imageUrl;
        if (sf.dataUrl) {
            if (typeof sf.dataUrl === 'string' && sf.dataUrl.startsWith('data:')) sceneRef.data = sf.dataUrl;
            if (typeof sf.dataUrl === 'string' && /^https?:\/\//i.test(sf.dataUrl) && !sceneRef.imageUrl) sceneRef.imageUrl = sf.dataUrl;
        }
        if (sceneRef.imageUrl || sceneRef.data) referenceImages.push(sceneRef);
    });

    return referenceImages;
}

function buildAttachmentFiles() {
    return (MISSION.attachmentFiles || [])
        .map((af, idx) => {
            const item = { name: af.name || `attachment_${idx + 1}` };
            if (af.imageUrl) item.imageUrl = af.imageUrl;
            if (af.dataUrl) {
                if (typeof af.dataUrl === 'string' && af.dataUrl.startsWith('data:')) item.data = af.dataUrl;
                if (typeof af.dataUrl === 'string' && /^https?:\/\//i.test(af.dataUrl) && !item.imageUrl) item.imageUrl = af.dataUrl;
            }
            return item;
        })
        .filter(item => item.imageUrl || item.data);
}

window.FunnelActions = {
    generateDraft: async () => {
        // 💸 V10 動態計費：抓取雲端產草稿底價
        const actionsPricing = SYSTEM_DB.pricing?.actions || {};
        const draftPrice = actionsPricing['GENERATE_DRAFT']?.retailPoints || 15;

        // 前端預估防呆檢查 (實際扣款由後端包含 Token 動態精算)
        if (!validatePoints(draftPrice, "產出劇本")) return;

        const oldActive = document.getElementById('activeControlCard');
        if (oldActive) releaseUI(oldActive);

        const spinId = 'spin_draft_' + Date.now();
        await addLog("首席文案", "⏳", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">Agent 正在產出全新劇本...</span></div>`, true);
        
        const referenceImages = buildReferenceImages();
        const attachmentFiles = buildAttachmentFiles();

        // 📦 V10 核心升級：將 isIndependentPost 和 tgConfig 包進去
        const rawPayload = { 
            tenantId: STATE.uid, 
            taskId: MISSION.currentTaskId || undefined,
            topic: MISSION.topic, 
            isComicMode: MISSION.universe === 'COMIC', 
            universe: MISSION.universe, 
            style: MISSION.style, 
            platforms: MISSION.platforms, 
            persona: MISSION.persona, 
            hookType: MISSION.hookType, 
            contentLength: MISSION.contentLength, 
            colorMode: MISSION.colorMode, 
            ratio: MISSION.ratio, 
            resolution: MISSION.resolution, 
            panelCount: MISSION.panelCount, 
            scheduledAt: MISSION.scheduledAt, 
            
            // 🆕 多平台分軌開關與戰術
            isIndependentPost: MISSION.isIndependentPost,
            platformStrategies: MISSION.platformStrategies, 
            
            // 🆕 Telegram 多租戶設定
            tgConfig: MISSION.tgConfig,

            characters: MISSION.characters.map(name => { const c = SYSTEM_DB.characters.find(x => x.name === name); return { name: name, persona: c ? (c.persona || "") : "" }; }), 
            image_options: { ratio: MISSION.ratio, resolution: MISSION.resolution, referenceImages, attachmentFiles } 
        };

        try {
            const response = await generateDraftAPI(rawPayload);
            if (response && response.success) {
                const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('bg-blue-500'); document.getElementById(`text_${spinId}`).innerText = "劇本產出完畢"; }
                
                // 動態扣除草稿底價的 UI 動畫
                await applyPointDeduction(draftPrice, "產出草稿底價");
                
                MISSION.currentTaskId = response.taskId;
                MISSION.currentDraft = response.draftContent; 
                
                // 保留舊邏輯，詳細的資料承接會在 v9_funnel_editor.js 裡處理
                MISSION.currentHashtags = response.draftContent.hashtags || []; 

                const chatBar = document.getElementById('agentChatBar');
                if(chatBar) chatBar.classList.remove('translate-y-full');

                await addLog("首席文案", "✅", "為您呈上草稿，請審閱！不滿意可以叫我直接改喔！", true); 
                await renderDraftEditorCard(response.taskId, MISSION.currentDraft, MISSION.universe === 'COMIC');
            } else { throw new Error(response.message || "產生失敗"); }
        } catch (e) { 
            const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('border-red-500'); document.getElementById(`text_${spinId}`).innerText = "產出失敗"; }
            showError(`連線失敗：${e.message}`); 
        }
    },
    
    generateImages: async (taskId, editedCaption, editedPanels) => {
        // 💸 V10 動態計費：抓取雲端生圖底價
        const actionsPricing = SYSTEM_DB.pricing?.actions || {};
        const imgPrice = actionsPricing['GENERATE_IMAGE']?.retailPoints || 50;

        if (!validatePoints(imgPrice, "影像合成")) return;
        
        const oldActive = document.getElementById('activeControlCard');
        if (oldActive) releaseUI(oldActive);

        const spinId = 'spin_img_' + Date.now();
        await addLog("美術總監", "🎨", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">收到！正在為您發包生圖 (需 20~30 秒)...</span></div>`, true);
        
        try {
            const response = await generateImageFromDraftAPI({ 
                taskId, 
                tenantId: STATE.uid, 
                editedCaption, 
                editedPanels,
                universe: MISSION.universe,
                style: MISSION.style,
                colorMode: MISSION.colorMode,
                ratio: MISSION.ratio,
                resolution: MISSION.resolution,
                panelCount: MISSION.panelCount,
                plannedImageCount: MISSION.plannedImageCount || 1,
                isStoryMode: !!MISSION.isStoryMode,
                characters: MISSION.characters,
                image_options: {
                    ratio: MISSION.ratio,
                    resolution: MISSION.resolution,
                    referenceImages: buildReferenceImages(),
                    attachmentFiles: buildAttachmentFiles()
                },
                tgConfig: MISSION.tgConfig 
            });
            
            if (response && response.success) {
                const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('bg-blue-500'); document.getElementById(`text_${spinId}`).innerText = "影像合成完畢"; }
                
                // 動態扣除生圖算力的 UI 動畫
                await applyPointDeduction(imgPrice, "影像合成算力");
                
                // 保留舊狀態 (向下相容)
                MISSION.currentCaption = editedCaption; 
                MISSION.currentPanels = editedPanels;   
                
                // 暫時保留舊的組合邏輯
                const tagsString = MISSION.currentHashtagsArray && MISSION.currentHashtagsArray.length > 0 ? '\n\n' + MISSION.currentHashtagsArray.map(t => '#' + t.replace(/^#/, '')).join(' ') : '';
                const finalFullCaption = editedCaption + tagsString;
                
                recordGeneratedImageBatch(response.images, finalFullCaption);
                await renderFinalPublishCard(taskId, response.images, finalFullCaption);
            } else { throw new Error(response.message || "未能取得圖片。"); }
        } catch (e) { 
            const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('border-red-500'); document.getElementById(`text_${spinId}`).innerText = "合成失敗"; }
            showError(`連線失敗：${e.message}`); 
        }
    }
};
