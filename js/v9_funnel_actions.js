// js/v9_funnel_actions.js
import { STATE } from './config.js'; 
import { MISSION, SYSTEM_DB } from './v9_state.js';
import { addLog, releaseUI, showError } from './v9_ui.js';
import { applyPointDeduction, validatePoints } from './v9_finance.js';
import { generateDraftAPI, generateImageFromDraftAPI } from './api.js'; 
import { renderDraftEditorCard, renderFinalPublishCard } from './v9_funnel_editor.js';

window.FunnelActions = {
    generateDraft: async () => {
        const pricing = SYSTEM_DB.pricing || {}; 
        const basePts = typeof pricing.baseDraftPoints === 'number' ? pricing.baseDraftPoints : 15;
        const charPts = typeof pricing.characterImagePointsMultiplier === 'number' ? pricing.characterImagePointsMultiplier : 10;
        const totalPts = basePts + (MISSION.characters.length * charPts);

        if (!validatePoints(totalPts, "產出劇本")) return;

        const oldActive = document.getElementById('activeControlCard');
        if (oldActive) releaseUI(oldActive);

        const spinId = 'spin_draft_' + Date.now();
        await addLog("首席文案", "⏳", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">Agent 正在產出全新劇本...</span></div>`, true);
        
        const referenceImages = []; 
        MISSION.characters.forEach(name => { const charData = SYSTEM_DB.characters.find(c => c.name === name); if(charData && charData.imageUrl) referenceImages.push({ type: 'character', name: name, imageUrl: charData.imageUrl }); }); 
        MISSION.sceneFiles.forEach(sf => { if(sf.dataUrl) referenceImages.push({ type: 'scene', data: sf.dataUrl }); });

        const rawPayload = { 
            tenantId: STATE.uid, topic: MISSION.topic, isComicMode: MISSION.universe === 'COMIC', universe: MISSION.universe, style: MISSION.style, platforms: MISSION.platforms, persona: MISSION.persona, hookType: MISSION.hookType, contentLength: MISSION.contentLength, colorMode: MISSION.colorMode, ratio: MISSION.ratio, resolution: MISSION.resolution, panelCount: MISSION.panelCount, scheduledAt: MISSION.scheduledAt, 
            characters: MISSION.characters.map(name => { const c = SYSTEM_DB.characters.find(x => x.name === name); return { name: name, persona: c ? (c.persona || "") : "" }; }), 
            image_options: { ratio: MISSION.ratio, resolution: MISSION.resolution, referenceImages: referenceImages } 
        };

        try {
            const response = await generateDraftAPI(rawPayload);
            if (response && response.success) {
                const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('bg-blue-500'); document.getElementById(`text_${spinId}`).innerText = "劇本產出完畢"; }
                await applyPointDeduction(totalPts, "產出草稿算力");
                
                MISSION.currentTaskId = response.taskId;
                MISSION.currentDraft = response.draftContent; 
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
        if (!validatePoints(50, "影像合成")) return;
        
        const oldActive = document.getElementById('activeControlCard');
        if (oldActive) releaseUI(oldActive);

        const spinId = 'spin_img_' + Date.now();
        await addLog("美術總監", "🎨", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">收到！正在為您發包生圖 (需 20~30 秒)...</span></div>`, true);
        
        try {
            const response = await generateImageFromDraftAPI({ taskId, tenantId: STATE.uid, editedCaption, editedPanels });
            if (response && response.success) {
                const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('bg-blue-500'); document.getElementById(`text_${spinId}`).innerText = "影像合成完畢"; }
                await applyPointDeduction(50, "影像合成算力");
                
                MISSION.currentCaption = editedCaption; 
                MISSION.currentPanels = editedPanels;   
                
                const tagsString = MISSION.currentHashtags.length > 0 ? '\n\n' + MISSION.currentHashtags.map(t => '#' + t.replace(/^#/, '')).join(' ') : '';
                const finalFullCaption = editedCaption + tagsString;
                
                await renderFinalPublishCard(taskId, response.images, finalFullCaption);
            } else { throw new Error(response.message || "未能取得圖片。"); }
        } catch (e) { 
            const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('border-red-500'); document.getElementById(`text_${spinId}`).innerText = "合成失敗"; }
            showError(`連線失敗：${e.message}`); 
        }
    }
};
