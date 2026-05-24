// js/v9_funnel_editor.js
import { STATE } from './config.js'; 
import { MISSION, buildImageGenerationContextKey, markImageRegenerationRequired, recordGeneratedImageBatch, ensureSyntheticPublishMask, PUBLISH_MEDIA_MAX_TOTAL } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';
import { publishTaskAPI, triggerWalletSync } from './api.js'; 
import { applyPointDeduction, getBillingActionDisplayName } from './v9_finance.js'; 

function normalizeAttachmentFilesForPublish() {
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

function getPublishSelectedBatch() {
    const rows = MISSION.generatedImageBatches || [];
    return rows.find(b => b.id === MISSION.selectedImageBatchId) || rows[0] || null;
}

/** 批次順序：unshift 後 [最新,…,最舊]，發佈與預覽條帶用「最舊→最新」較直覺 */
function getBatchesOldestFirst() {
    const rows = MISSION.generatedImageBatches || [];
    return rows.length ? [...rows].reverse() : [];
}

/** 扁平化：每個 slot 對應一張圖（跨批次），供預覽／燈箱／縮圖列 */
function buildFlatPublishSlots() {
    const slots = [];
    for (const batch of getBatchesOldestFirst()) {
        const imgs = batch?.images || [];
        imgs.forEach((img, imageIndex) => {
            slots.push({ batch, batchId: batch.id, imageIndex, img });
        });
    }
    return slots;
}

function countSelectedSynthExcludingBatch(excludeBatchId) {
    let sum = 0;
    for (const b of MISSION.generatedImageBatches || []) {
        if (b.id === excludeBatchId) continue;
        const imgs = b.images || [];
        const mask = ensureSyntheticPublishMask(b.id, imgs.length);
        sum += mask.filter(Boolean).length;
    }
    return sum;
}

function totalSelectedSynthCount() {
    let sum = 0;
    for (const b of MISSION.generatedImageBatches || []) {
        const imgs = b.images || [];
        const mask = ensureSyntheticPublishMask(b.id, imgs.length);
        sum += mask.filter(Boolean).length;
    }
    return sum;
}

function synthPlusAttachmentsWithinCap(nextSynthCount) {
    const att = normalizeAttachmentFilesForPublish().length;
    return nextSynthCount + att <= PUBLISH_MEDIA_MAX_TOTAL;
}

/** 設定某張合成圖是否納入發佈；失敗時回 false（全任務合成圖 + 附件超過 10 張） */
function trySetPublishInclusion(batch, imageIndex, want) {
    if (!batch || !Array.isArray(batch.images)) return false;
    const n = batch.images.length;
    if (imageIndex < 0 || imageIndex >= n) return false;
    const mask = ensureSyntheticPublishMask(batch.id, n);
    let nextSynth = countSelectedSynthExcludingBatch(batch.id);
    for (let j = 0; j < n; j++) {
        const on = (j === imageIndex) ? want : !!mask[j];
        if (on) nextSynth++;
    }
    if (!synthPlusAttachmentsWithinCap(nextSynth)) return false;
    mask[imageIndex] = want;
    return true;
}

/** 發佈 API：依「最舊批次→最新」順序收集所有已勾選的合成圖 */
function collectSelectedPublishImagesMerged() {
    const out = [];
    for (const batch of getBatchesOldestFirst()) {
        const imgs = batch.images || [];
        const mask = ensureSyntheticPublishMask(batch.id, imgs.length);
        imgs.forEach((img, i) => {
            if (mask[i]) out.push(img);
        });
    }
    return out;
}

function getImagePlanSuggestion() {
    const topic = (MISSION.topic || '').toLowerCase();
    const hasStoryIntent = /劇情|連載|短篇漫畫|分鏡|故事|系列|episode|story/.test(topic);
    const hasCompareIntent = /對比|開箱|前後|步驟|教學|清單|攻略|懶人包/.test(topic);

    if (MISSION.universe === 'COMIC') {
        if (hasStoryIntent) {
            return { panelCount: 2, colorMode: 'Color', imageCount: 1, reason: '敘事主題建議雙格分鏡；每次仍只合成 1 張輸出，可重複生圖累積連貫畫面後一併發佈。' };
        }
        if (hasCompareIntent) {
            return { panelCount: 2, colorMode: 'Color', imageCount: 1, reason: '對比型主題可用 2 格分鏡；每次 1 張，多次生圖後在發佈卡跨批次勾選。' };
        }
        return { panelCount: 1, colorMode: 'Color', imageCount: 1, reason: '單格主視覺每次 1 張；要補圖請按「重算」，發佈時可勾多批結果（≤10 張含附件）。' };
    }

    if (hasCompareIntent) {
        return { panelCount: MISSION.panelCount || 1, colorMode: MISSION.colorMode || '原色直出', imageCount: 1, reason: '每次生圖 1 張；資訊型可多按幾次「重算」累積對比圖（同一 PO 最多 10 張含附件）。' };
    }
    return { panelCount: MISSION.panelCount || 1, colorMode: MISSION.colorMode || '原色直出', imageCount: 1, reason: '每次生圖 1 張；需要更多視角請重複生圖，最終發佈可跨批次勾選合併。' };
}

export async function renderDraftEditorCard(taskId, draftContent, isComic, options = {}) {
    MISSION.funnelNextStep = 'draft';
    updateStepHeader("DRAFT EDITOR"); 

    // 💡 1. 強化 V10 資料結構初始化
    MISSION.currentCaptions = MISSION.currentCaptions || { UNIFIED: '', FB: '', IG: '', THREADS: '' };
    MISSION.currentHashtags = MISSION.currentHashtags || { UNIFIED: [], FB: [], IG: [], THREADS: [] };

    // 💡 2. 智慧型資料解析
    if (draftContent && typeof draftContent.captions === 'object') {
        MISSION.currentCaptions = { ...MISSION.currentCaptions, ...draftContent.captions };
        if (draftContent.hashtags && typeof draftContent.hashtags === 'object' && !Array.isArray(draftContent.hashtags)) {
             MISSION.currentHashtags = { ...MISSION.currentHashtags, ...draftContent.hashtags };
        } else if (Array.isArray(draftContent.hashtags)) {
             ['UNIFIED', 'FB', 'IG', 'THREADS'].forEach(p => MISSION.currentHashtags[p] = [...draftContent.hashtags]);
        }
    } else {
        const defaultCap = typeof draftContent === 'string' ? draftContent : (draftContent.post_caption || '');
        const defaultTags = Array.isArray(draftContent.hashtags) ? draftContent.hashtags : (MISSION.currentHashtagsArray || []);
        
        ['UNIFIED', 'FB', 'IG', 'THREADS'].forEach(p => {
            if (!MISSION.currentCaptions[p]) MISSION.currentCaptions[p] = defaultCap;
            if (MISSION.currentHashtags[p].length === 0) MISSION.currentHashtags[p] = [...defaultTags];
        });
    }
    // 保底：若仍為空，至少給 UNIFIED 一份可編輯內容，避免回卡後空白重填
    if (!MISSION.currentCaptions.UNIFIED) {
        const fallbackCap = (typeof draftContent === 'string' ? draftContent : (draftContent?.post_caption || MISSION.currentCaption || '')).trim();
        if (fallbackCap) MISSION.currentCaptions.UNIFIED = fallbackCap;
    }

    let currentTab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
    
    // 生成漫畫分鏡 HTML
    let panelsHtml = '';
    const activePanels = MISSION.currentPanels || draftContent.panels;
    if (isComic && activePanels) {
        const pCount = activePanels.length;
        let wLimit = 9; 
        if(pCount === 1) wLimit = 20; 
        else if (pCount === 2) wLimit = 15; 
        else if (pCount === 3) wLimit = 12; 

        activePanels.forEach((p, idx) => {
            panelsHtml += `
            <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2 relative panel-container">
                <div class="flex justify-between items-center"><span class="text-[9px] font-black text-indigo-400"># PANEL ${p.panel_number}</span><span class="text-[9px] font-bold text-slate-500 char-counter" data-limit="${wLimit}">0 / ${wLimit} 字</span></div>
                <p class="text-[10px] text-slate-400 leading-tight italic">${p.action_zh || p.action_en}</p>
                <input type="text" class="panel-dialogue w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-blue-500 outline-none transition-colors" value="${p.dialogue}" data-idx="${idx}">
            </div>`;
        });
    }

    let tabsHtml = '';
    if (MISSION.isIndependentPost && MISSION.platforms.length > 1) {
        tabsHtml = `
        <div class="flex gap-2 p-1 bg-slate-900 rounded-xl border border-white/10 mb-3">
            ${MISSION.platforms.map(p => `
                <button class="plat-tab-btn flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${currentTab === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}" data-plat="${p}">
                    ${p === 'FB' ? 'Facebook' : p === 'IG' ? 'Instagram' : 'Threads'}
                </button>
            `).join('')}
        </div>`;
    }
    const suggestion = getImagePlanSuggestion();
    if (!MISSION.plannedImageCount || MISSION.plannedImageCount < 1) MISSION.plannedImageCount = suggestion.imageCount;

    const ui = createSkillUI(`
        <div class="space-y-4 animate-fade-in w-full">
            ${options.returnBannerText ? `<div class="bg-indigo-600/20 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs text-indigo-200 font-bold">${options.returnBannerText}</div>` : ''}
            <div class="flex justify-between items-center px-1 mb-2">
                <button type="button" id="btnTopReturnLobby" class="min-h-[44px] px-2 -ml-2 text-[11px] sm:text-[10px] text-slate-400 hover:text-white active:text-white transition-colors flex items-center gap-1.5 font-bold touch-manipulation rounded-lg hover:bg-white/5" title="暫存目前進度並回到大廳首頁">
                    <i class="fa-solid fa-house text-xs" aria-hidden="true"></i><span class="leading-tight">返回大廳</span>
                </button>
                <button type="button" id="btnBackToVisual" class="min-h-[44px] px-2 text-[11px] sm:text-[10px] text-slate-400 hover:text-white active:text-white transition-colors flex items-center gap-1.5 font-bold touch-manipulation rounded-lg hover:bg-white/5" title="返回上一步，重新調整或上傳場景、人物與配件圖片">
                    <i class="fa-solid fa-arrow-left text-xs" aria-hidden="true"></i><span class="leading-tight">上一步 (調整素材/參考圖)</span>
                </button>
                <button type="button" id="btnClearDraftContent" class="min-h-[40px] px-3 text-[11px] sm:text-[10px] rounded-lg border border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-[0.98] touch-manipulation font-bold">🧹 清空本頁</button>
            </div>

            <div class="bg-blue-600/10 p-3 lg:p-4 rounded-2xl border border-blue-500/30 space-y-3 shadow-inner">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="text-xs font-black text-blue-400 uppercase tracking-widest">📝 貼文校稿總編室</h3>
                    ${MISSION.isIndependentPost ? `<span class="text-[9px] bg-indigo-600/30 text-indigo-300 px-2 py-1 rounded-full border border-indigo-500/50">多宇宙分頁模式</span>` : `<span class="text-[9px] bg-slate-700 text-slate-300 px-2 py-1 rounded-full">統一內容模式</span>`}
                </div>
                
                ${tabsHtml}
                
                <div class="space-y-1">
                    <label class="text-[9px] text-slate-500 font-bold" id="captionLabel">社群內文 (${currentTab === 'UNIFIED' ? '全平台共用' : currentTab + ' 專屬'})</label>
                    <textarea id="editCaption" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-slate-200 min-h-[150px] focus:border-blue-500 focus:outline-none resize-y">${MISSION.currentCaptions[currentTab] || ''}</textarea>
                </div>
                
                <div class="space-y-1 pt-3 border-t border-white/10">
                    <label class="text-[9px] text-slate-500 font-bold flex items-center gap-1">🏷️ 專屬標籤 (拖曳排序，獨立儲存)</label>
                    <div id="hashtagContainer" class="flex flex-wrap gap-2 items-center min-h-[30px] pb-2"></div>
                    <input type="text" id="hashtagInput" class="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:border-blue-500 outline-none" placeholder="輸入標籤後按 Enter 新增 (不需打 #)...">
                </div>

                <div class="space-y-2 scrollbar-indigo overflow-y-auto max-h-[300px] pr-1 pt-3 border-t border-white/10">${panelsHtml}</div>
            </div>

            <div class="bg-violet-600/10 p-3 lg:p-4 rounded-2xl border border-violet-500/30 space-y-3 shadow-inner">
                <div class="flex items-center justify-between">
                    <h3 class="text-xs font-black text-violet-300 uppercase tracking-widest">🧠 AI 生圖建議</h3>
                    <button id="btnApplyAiSuggestion" class="text-[10px] px-2 py-1 rounded-lg border border-violet-400/40 text-violet-200 hover:bg-violet-600/30">一鍵套用</button>
                </div>
                <p class="text-[11px] text-slate-300 leading-relaxed">${suggestion.reason}</p>
                <div class="grid grid-cols-1 ${isComic ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2 text-[10px]">
                    ${isComic ? `<div class="bg-slate-900/70 rounded-lg border border-white/10 px-2 py-2 text-slate-300">建議格數：<span id="aiPanelHint" class="text-violet-300 font-bold">${suggestion.panelCount} 格</span></div>` : ''}
                    <div class="bg-slate-900/70 rounded-lg border border-white/10 px-2 py-2 text-slate-300">建議色系：<span id="aiColorHint" class="text-violet-300 font-bold">${suggestion.colorMode === 'BW' ? '黑白' : suggestion.colorMode}</span></div>
                    <div class="bg-slate-900/70 rounded-lg border border-white/10 px-2 py-2 text-slate-300">建議張數：<span id="aiCountHint" class="text-violet-300 font-bold">${suggestion.imageCount} 張</span></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div class="text-[10px] text-slate-300 leading-relaxed bg-slate-900/60 rounded-lg px-2 py-2 border border-white/10">
                        每次按下「開始生圖／重算」僅產出 <strong class="text-violet-300">1</strong> 張；可重複生圖累積，最後在發佈卡<strong class="text-rose-300">跨批次勾選</strong>一併上傳（合成＋附件最多 ${PUBLISH_MEDIA_MAX_TOTAL} 張）。
                    </div>
                    ${isComic ? `<label class="text-[10px] text-slate-400 font-bold flex items-center gap-2 bg-slate-900/60 rounded-lg px-2 py-2 border border-white/10">
                        <input id="storyModeToggle" type="checkbox" class="accent-violet-500" ${MISSION.isStoryMode ? 'checked' : ''}>
                        連續劇情模式（適合短篇漫畫）
                    </label>` : ''}
                </div>
            </div>
            
            <button type="button" id="btnFinalGenerate" class="w-full min-h-[52px] sm:min-h-0 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-black text-base sm:text-sm shadow-xl active:scale-[0.98] transition-all touch-manipulation">✨ 確認內容，開始生圖</button>
            
            <button type="button" id="btnBottomReturnLobby" class="w-full min-h-[48px] bg-slate-800 text-slate-300 border border-white/10 py-3.5 sm:py-3 rounded-xl text-sm sm:text-xs font-bold active:scale-[0.98] transition-all hover:bg-slate-700 mt-2 touch-manipulation">
                🔙 先離開，之後從大廳繼續
            </button>
        </div>
    `);

    // 🔙 綁定返回大廳事件
    const returnToLobbyHandler = () => {
        saveCurrentCaption(); // 離開前默默存個檔在記憶體裡
        releaseUI(ui);
        window.dispatchEvent(new CustomEvent('reloadLobby', { detail: { preserveMission: true } }));
    };
    ui.querySelector('#btnTopReturnLobby').onclick = returnToLobbyHandler;
    ui.querySelector('#btnBottomReturnLobby').onclick = returnToLobbyHandler;

    const backToVisualBtn = ui.querySelector('#btnBackToVisual');
    if (backToVisualBtn) {
        backToVisualBtn.onclick = async () => {
            saveCurrentCaption();
            releaseUI(ui);
            if (window.FunnelActions && window.FunnelActions.triggerVisualSkill) {
                await window.FunnelActions.triggerVisualSkill();
            }
        };
    }

    // 🏷️ Hashtag 渲染邏輯
    const renderHashtags = () => {
        const container = ui.querySelector('#hashtagContainer');
        container.innerHTML = '';
        const tags = MISSION.currentHashtags[currentTab] || [];
        
        tags.forEach((tag, idx) => {
            const cleanTag = tag.replace(/^#/, ''); 
            const pill = document.createElement('div');
            pill.className = 'flex items-center gap-1 bg-indigo-600/30 border border-indigo-500 text-indigo-300 px-2 py-1 rounded-full text-[10px] font-bold cursor-move select-none shadow-sm hover:bg-indigo-600/50 transition-colors';
            pill.draggable = true;
            pill.dataset.idx = idx;
            pill.innerHTML = `<span>#${cleanTag}</span><button class="hover:text-white ml-1 delete-tag-btn font-black" data-idx="${idx}">×</button>`;
            
            pill.ondragstart = (e) => { e.dataTransfer.setData('text/plain', idx); pill.classList.add('opacity-50', 'scale-105'); };
            pill.ondragend = () => pill.classList.remove('opacity-50', 'scale-105');
            pill.ondragover = (e) => e.preventDefault();
            pill.ondrop = (e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                if (fromIdx === idx) return;
                const moved = MISSION.currentHashtags[currentTab].splice(fromIdx, 1)[0];
                MISSION.currentHashtags[currentTab].splice(idx, 0, moved);
                renderHashtags();
            };
            container.appendChild(pill);
        });
        
        ui.querySelectorAll('.delete-tag-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); 
                MISSION.currentHashtags[currentTab].splice(btn.dataset.idx, 1);
                renderHashtags();
            };
        });
    };
    renderHashtags();

    ui.querySelector('#hashtagInput').onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim().replace(/^#/, '');
            if (val && !MISSION.currentHashtags[currentTab].includes(val)) {
                MISSION.currentHashtags[currentTab].push(val);
                renderHashtags();
            }
            e.target.value = '';
        }
    };

    const saveCurrentCaption = () => {
        MISSION.currentCaptions[currentTab] = ui.querySelector('#editCaption').value;
    };
    ui.querySelector('#editCaption').oninput = saveCurrentCaption;
    ui.querySelector('#btnClearDraftContent').onclick = () => {
        MISSION.currentCaptions[currentTab] = '';
        MISSION.currentHashtags[currentTab] = [];
        ui.querySelector('#editCaption').value = '';
        renderHashtags();
    };

    ui.querySelectorAll('.plat-tab-btn').forEach(btn => {
        btn.onclick = () => {
            saveCurrentCaption();
            currentTab = btn.dataset.plat;
            
            ui.querySelectorAll('.plat-tab-btn').forEach(b => {
                b.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
                b.classList.add('text-slate-500', 'hover:text-slate-300');
            });
            btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
            btn.classList.remove('text-slate-500', 'hover:text-slate-300');
            
            ui.querySelector('#captionLabel').innerText = `社群內文 (${currentTab} 專屬)`;
            ui.querySelector('#editCaption').value = MISSION.currentCaptions[currentTab] || '';
            renderHashtags();
        };
    });

    ui.querySelectorAll('.panel-dialogue').forEach(input => {
        const container = input.closest('.panel-container'); const counter = container.querySelector('.char-counter'); const limit = parseInt(counter.dataset.limit);
        const updateCounter = () => { const len = input.value.length; counter.innerText = `${len} / ${limit} 字`; if (len > limit) { counter.classList.remove('text-slate-500'); counter.classList.add('text-red-500'); input.classList.add('border-red-500', 'text-red-400'); } else { counter.classList.remove('text-red-500'); counter.classList.add('text-slate-500'); input.classList.remove('border-red-500', 'text-red-400'); } };
        input.addEventListener('input', updateCounter); updateCounter();
    });

    MISSION.plannedImageCount = 1;
    const storyEl = ui.querySelector('#storyModeToggle');
    if (storyEl) {
        storyEl.onchange = (e) => { MISSION.isStoryMode = !!e.target.checked; };
    }
    ui.querySelector('#btnApplyAiSuggestion').onclick = async () => {
        MISSION.plannedImageCount = suggestion.imageCount;
        if (isComic) MISSION.isStoryMode = suggestion.imageCount >= 4;
        if (MISSION.universe === 'COMIC') {
            MISSION.panelCount = suggestion.panelCount;
            MISSION.colorMode = suggestion.colorMode;
        }
        if (storyEl) storyEl.checked = MISSION.isStoryMode;
        await addLog("美術總監", "🧠", `已套用 AI 建議：${MISSION.universe === 'COMIC' ? `${MISSION.panelCount}格 / ${MISSION.colorMode === 'BW' ? '黑白' : '彩色'} / ` : ''}${MISSION.plannedImageCount} 張。`, true);
    };

    ui.querySelector('#btnFinalGenerate').onclick = async () => {
        saveCurrentCaption(); 
        
        const tagsString = MISSION.currentHashtags[currentTab].length > 0 ? '\n\n' + MISSION.currentHashtags[currentTab].map(t => '#' + t).join(' ') : '';
        const editedCaption = MISSION.currentCaptions[currentTab] + tagsString; 
        
        const editedPanels = []; 
        ui.querySelectorAll('.panel-dialogue').forEach(input => { 
            const idx = input.dataset.idx; 
            editedPanels.push({ panel_number: activePanels[idx].panel_number, dialogue: input.value, action_zh: activePanels[idx].action_zh, action_en: activePanels[idx].action_en }); 
        });
        
        await window.FunnelActions.generateImages(taskId, editedCaption, editedPanels);
    };

    if (options.returnBannerText) {
        const log = document.getElementById('funnelLog');
        if (log) log.scrollTo({ top: 0, behavior: 'auto' });
        ui.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
}

/**
 * ==========================================
 * 📌 函數名稱：renderFinalPublishCard
 * ==========================================
 */
export async function renderFinalPublishCard(taskId, images, finalCaption) {
    updateStepHeader("FINAL DEPLOYMENT"); 
    await addLog("社群總監", "🚀", "大作已完成！請做最後確認，您還可以選擇重新算圖或退回修改：", true);

    if ((!MISSION.generatedImageBatches || MISSION.generatedImageBatches.length === 0) && Array.isArray(images) && images.length > 0) {
        recordGeneratedImageBatch(images, finalCaption || '');
    }
    const batches = MISSION.generatedImageBatches || [];
    if (!MISSION.selectedImageBatchId && batches.length > 0) {
        MISSION.selectedImageBatchId = batches[0].id;
    }
    let slotsInit = buildFlatPublishSlots();
    if (MISSION.selectedImageBatchId && slotsInit.length) {
        const at = slotsInit.findIndex((s) => s.batchId === MISSION.selectedImageBatchId);
        if (at >= 0) MISSION.selectedImagePreviewIndex = at;
    }
    const nFlat = slotsInit.length;
    if (nFlat > 0) {
        MISSION.selectedImagePreviewIndex = Math.max(0, Math.min(MISSION.selectedImagePreviewIndex || 0, nFlat - 1));
        const cur = slotsInit[MISSION.selectedImagePreviewIndex];
        if (cur) MISSION.selectedImageBatchId = cur.batchId;
    } else {
        MISSION.selectedImagePreviewIndex = 0;
    }
    slotsInit = buildFlatPublishSlots();
    const curSlot = nFlat ? slotsInit[MISSION.selectedImagePreviewIndex] : null;
    const displayImgUrl = curSlot ? (curSlot.img.finalUrl || curSlot.img.imageUrl || '') : '';
    const captionBatch = curSlot?.batch || batches.find((b) => b.id === MISSION.selectedImageBatchId) || batches[0] || null;
    let selectedCaption = captionBatch?.caption || finalCaption || '';
    let btnText = "🚀 立即發佈至社群"; let btnColor = "from-green-600 to-emerald-600";
    if(MISSION.scheduledAt) { const dateStr = new Date(MISSION.scheduledAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); btnText = `⏰ 寫入排程 (${dateStr})`; btnColor = "from-orange-500 to-red-500"; }

    const previewNote = MISSION.isIndependentPost ? `<p class="text-[10px] text-amber-400 mb-2">※ 多宇宙模式：此為主要平台預覽，發布時將自動切分各平台專屬文案與標籤。</p>` : '';
    const scheduleLocal = MISSION.scheduledAt
        ? (() => {
            const d = new Date(MISSION.scheduledAt);
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        })()
        : '';

    const ui = createSkillUI(`
        <div class="flex flex-col gap-3 sm:gap-4 w-full animate-fade-in max-w-full">
            <div class="flex justify-between items-center px-0.5 sm:px-1 gap-2">
                <button type="button" id="btnTopReturnLobbyFinal" class="min-h-[44px] min-w-0 px-2 -ml-2 text-[11px] sm:text-xs text-slate-400 hover:text-white active:text-white transition-colors flex items-center gap-1.5 font-bold touch-manipulation rounded-lg hover:bg-white/5">
                    <i class="fa-solid fa-arrow-left text-sm" aria-hidden="true"></i><span class="text-left leading-tight">暫存並返回大廳</span>
                </button>
            </div>

            <div class="rounded-xl border border-dashed border-indigo-500/35 bg-indigo-950/25 px-3 py-3 sm:py-3.5 text-slate-200 shadow-inner">
                <div class="font-black text-indigo-300 text-[11px] sm:text-xs mb-2 flex items-center gap-2">
                    <span class="text-base leading-none" aria-hidden="true">💡</span> 第一次用？照這三步
                </div>
                <ol class="list-decimal pl-[1.35rem] space-y-1.5 text-[11px] sm:text-sm text-slate-300 leading-snug">
                    <li><strong class="text-slate-200">小圖</strong>可左右滑；<strong class="text-slate-200">大圖</strong>點一下<strong class="text-indigo-300">放大預覽</strong>，放大後可左右滑換張、再點大圖關閉。</li>
                    <li>勾<strong class="text-rose-300">選入發佈</strong>可<strong class="text-white">跨批次</strong>複選（<strong class="text-white">0～10 張</strong>合成＋附件）。</li>
                    <li>改好文字後，按最下方綠色<strong class="text-emerald-300">發佈</strong>按鈕。</li>
                </ol>
            </div>

            <div class="w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div id="finalPreviewFrame" class="relative w-full aspect-square bg-black flex items-center justify-center touch-pan-y ring-2 ring-inset ring-transparent transition-shadow duration-150">
                    <img id="finalPreviewImg" src="${displayImgUrl}" alt="預覽" class="max-w-full max-h-full object-contain transition-opacity duration-150 cursor-zoom-in touch-manipulation">
                    <button type="button" id="finalImgPrev" class="absolute left-0 sm:left-1 top-1/2 -translate-y-1/2 z-10 min-h-[44px] min-w-[44px] w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/75 text-white text-2xl sm:text-xl font-bold leading-none border border-white/30 active:bg-black active:scale-95 shadow-lg touch-manipulation" aria-label="上一張">‹</button>
                    <button type="button" id="finalImgNext" class="absolute right-0 sm:right-1 top-1/2 -translate-y-1/2 z-10 min-h-[44px] min-w-[44px] w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/75 text-white text-2xl sm:text-xl font-bold leading-none border border-white/30 active:bg-black active:scale-95 shadow-lg touch-manipulation" aria-label="下一張">›</button>
                    <div id="finalBatchMetaBadge" class="absolute top-2 left-2 bg-black/75 text-white text-[10px] sm:text-[11px] px-2.5 py-1 rounded-full border border-white/25 font-bold pointer-events-none max-w-[50%] sm:max-w-[55%] truncate"></div>
                    <label id="finalPublishPickWrap" class="absolute top-2 right-2 z-20 flex items-center gap-2 bg-black/85 text-white text-[11px] sm:text-[10px] min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-full border border-white/35 cursor-pointer active:bg-black shadow-lg select-none max-w-[min(52%,280px)] touch-manipulation" title="合成圖與附件加總最多 10 張，可複選">
                        <input type="checkbox" id="finalPublishIncludeCb" class="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 rounded border border-white/60 bg-slate-900 accent-rose-500 cursor-pointer">
                        <span class="font-bold leading-tight">選入發佈</span>
                    </label>
                    <div id="finalImageIdxBadge" class="absolute bottom-2 right-2 bg-black/85 text-white text-xs font-black px-2.5 py-1.5 sm:py-1 rounded-lg border border-white/30 min-w-[2.75rem] text-center pointer-events-none shadow-lg"></div>
                </div>
                <div id="finalThumbScrollWrap" class="hidden border-t border-white/10 bg-slate-900/95 px-2 pt-3 pb-2 sm:px-3">
                    <p class="text-[10px] sm:text-[11px] text-slate-400 mb-2 px-1 leading-snug font-bold">相簿縮圖：<span class="font-normal text-slate-500">含<strong class="text-slate-300">所有批次</strong> · 左右滑 · 勾「發佈」跨批合併</span></p>
                    <div id="finalThumbStrip" class="flex gap-3 sm:gap-3.5 overflow-x-auto overflow-y-hidden pb-1.5 pt-0.5 snap-x snap-mandatory [-webkit-overflow-scrolling:touch] scrollbar-thin" style="scrollbar-width: thin;"></div>
                </div>
                <div class="p-3 sm:p-4 border-t border-white/5 bg-slate-800/50 shadow-inner">
                    <p id="finalMultiPublishHint" class="text-[11px] sm:text-[10px] text-slate-400 mb-2 leading-relaxed hidden rounded-lg bg-slate-900/40 px-2 py-2 border border-white/5"></p>
                    <div id="finalPublishPickTools" class="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-[11px] sm:text-[10px] mb-3 hidden">
                        <button type="button" id="btnSynthPublishAll" class="min-h-[44px] sm:min-h-0 px-3 py-2 sm:px-0 sm:py-0 rounded-lg sm:rounded-none bg-slate-800/80 sm:bg-transparent border border-white/10 sm:border-0 text-rose-300 hover:text-white active:scale-[0.98] font-bold touch-manipulation" title="本批全部勾選（仍受 10 張上限）">本批全部勾選</button>
                        <span class="text-slate-600 hidden sm:inline">|</span>
                        <button type="button" id="btnSynthPublishNone" class="min-h-[44px] sm:min-h-0 px-3 py-2 sm:px-0 sm:py-0 rounded-lg sm:rounded-none bg-slate-800/80 sm:bg-transparent border border-white/10 sm:border-0 text-slate-400 hover:text-white active:scale-[0.98] font-bold touch-manipulation" title="本批合成圖都不帶（0 張也可以）">本批都不帶圖</button>
                    </div>
                    ${previewNote}
                    <div class="mb-3 bg-emerald-600/10 border border-emerald-500/30 rounded-lg p-2.5 sm:p-3">
                        <div class="text-[11px] sm:text-[10px] font-bold text-emerald-300 mb-1.5">✅ 貼文文字（改這裡不用重算圖）</div>
                        <textarea id="finalCaptionEdit" class="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-sm sm:text-xs text-slate-200 min-h-[128px] sm:min-h-[120px] focus:border-emerald-500 outline-none resize-y touch-manipulation" placeholder="在這裡修改要發出的文字…">${selectedCaption}</textarea>
                    </div>
                    <div class="mb-2 bg-amber-600/10 border border-amber-500/30 rounded-lg p-2.5 sm:p-2">
                        <div class="text-[11px] sm:text-[10px] font-bold text-amber-300 mb-1">⚠️ 想改這些請先按「重算」</div>
                        <div class="text-[11px] sm:text-[10px] text-slate-300 leading-snug">主題、風格宇宙、色系、角色、參考圖</div>
                    </div>
                    <div class="mb-2 bg-blue-600/10 border border-blue-500/30 rounded-lg p-2.5 sm:p-2 space-y-3">
                        <div class="text-[11px] sm:text-[10px] font-bold text-blue-300">🛠️ 發佈設定（不用回到上一頁）</div>
                        <div>
                            <div class="text-[11px] sm:text-[10px] text-slate-400 mb-2">要發到哪個平台？（至少留一個）</div>
                            <div id="finalPlatformChips" class="flex flex-wrap gap-2">
                                ${['FB', 'IG', 'THREADS'].map(p => `<button type="button" class="final-plat-chip min-h-[44px] min-w-[4.5rem] sm:min-h-0 sm:min-w-0 px-4 py-2.5 sm:px-3 sm:py-2 rounded-xl sm:rounded-lg text-xs sm:text-[10px] font-bold border touch-manipulation active:scale-[0.98] ${MISSION.platforms.includes(p) ? 'border-blue-500 bg-blue-600 text-white' : 'border-white/10 bg-slate-900 text-slate-400'}" data-plat="${p}">${p}</button>`).join('')}
                            </div>
                        </div>
                        <div>
                            <div class="text-[11px] sm:text-[10px] text-slate-400 mb-2">何時發文？（空白 = 馬上）</div>
                            <div class="flex flex-col sm:flex-row gap-2">
                                <input id="finalScheduleInput" type="datetime-local" value="${scheduleLocal}" class="flex-1 min-h-[44px] bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-sm sm:text-[10px] text-slate-200 touch-manipulation">
                                <button type="button" id="btnFinalImmediate" class="min-h-[44px] sm:min-h-0 px-4 rounded-lg text-xs sm:text-[10px] font-bold border border-white/10 bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-[0.98] touch-manipulation shrink-0">改為立即</button>
                            </div>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-white/10 space-y-2">
                        <div class="text-[11px] sm:text-[10px] text-slate-400 font-bold leading-snug">🗂️ 生圖批次（跳至該批第一張；發佈可跨批勾選）</div>
                        <div id="batchSelector" class="flex flex-wrap gap-2">
                            ${batches.map((b, idx) => `<button type="button" class="batch-chip min-h-[44px] sm:min-h-0 px-3 py-2.5 sm:px-2 sm:py-1 rounded-xl sm:rounded-lg text-xs sm:text-[10px] font-bold border touch-manipulation active:scale-[0.98] ${b.id === MISSION.selectedImageBatchId ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/10 bg-slate-900 text-slate-400'}" data-batch-id="${b.id}">第 ${batches.length - idx} 批</button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <button type="button" id="btnDeploy" class="w-full min-h-[52px] sm:min-h-0 bg-gradient-to-r ${btnColor} text-white py-4 rounded-xl font-black text-base sm:text-sm shadow-xl active:scale-[0.98] transition-all touch-manipulation">${btnText}</button>
            
            <div class="flex flex-col sm:flex-row gap-2 w-full">
                <button type="button" id="btnRegenerateImages" class="flex-1 min-h-[48px] bg-slate-800 text-slate-300 border border-white/10 py-3.5 sm:py-3 rounded-xl text-sm sm:text-xs font-bold active:scale-[0.98] transition-all hover:bg-slate-700 touch-manipulation">🎲 重算圖（約 500 點）</button>
                <button type="button" id="btnBackToDraft" class="flex-1 min-h-[48px] bg-slate-800 text-slate-300 border border-white/10 py-3.5 sm:py-3 rounded-xl text-sm sm:text-xs font-bold active:scale-[0.98] transition-all hover:bg-slate-700 touch-manipulation">📝 回去改文字</button>
            </div>

            <button type="button" id="btnBottomReturnLobbyFinal" class="w-full min-h-[48px] bg-slate-800 text-slate-300 border border-white/10 py-3.5 sm:py-3 rounded-xl text-sm sm:text-xs font-bold active:scale-[0.98] transition-all hover:bg-slate-700 mt-1 touch-manipulation">
                🔙 先離開，之後從大廳繼續
            </button>

            <div id="finalPublishLightbox" class="hidden fixed inset-0 z-[400] flex flex-col bg-black/92" aria-hidden="true">
                <button type="button" id="finalLbClose" class="absolute top-3 right-3 z-20 min-h-[44px] min-w-[44px] rounded-full bg-white/15 text-white text-lg font-black border border-white/35 active:scale-95 touch-manipulation">✕</button>
                <div id="finalLbStage" class="flex-1 flex items-center justify-center relative px-2 min-h-0 touch-pan-y">
                    <button type="button" id="finalLbPrev" class="absolute left-1 z-10 min-h-[44px] min-w-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-black/75 text-white text-2xl font-bold border border-white/30 active:scale-95 touch-manipulation" aria-label="上一張">‹</button>
                    <img id="finalLbImg" src="" alt="放大預覽" class="max-w-full max-h-[85vh] object-contain cursor-zoom-out select-none touch-manipulation">
                    <button type="button" id="finalLbNext" class="absolute right-1 z-10 min-h-[44px] min-w-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-black/75 text-white text-2xl font-bold border border-white/30 active:scale-95 touch-manipulation" aria-label="下一張">›</button>
                </div>
                <p id="finalLbIdx" class="text-center text-white text-xs font-bold pb-4 shrink-0"></p>
            </div>
        </div>
    `);

    let lightboxOpen = false;

    function syncLightboxContent() {
        if (!lightboxOpen) return;
        const lb = ui.querySelector('#finalPublishLightbox');
        const lbImg = ui.querySelector('#finalLbImg');
        const lbIdx = ui.querySelector('#finalLbIdx');
        const slots = buildFlatPublishSlots();
        const n = slots.length;
        let idx = MISSION.selectedImagePreviewIndex || 0;
        if (n > 0) idx = Math.max(0, Math.min(idx, n - 1));
        if (lb) lb.setAttribute('aria-hidden', n === 0 ? 'true' : 'false');
        if (lbImg) {
            const url = n > 0 ? (slots[idx].img.finalUrl || slots[idx].img.imageUrl || '') : '';
            lbImg.src = url || '';
        }
        if (lbIdx) lbIdx.textContent = n === 0 ? '' : `${idx + 1} / ${n}`;
    }

    function openPublishLightbox() {
        const slots = buildFlatPublishSlots();
        if (!slots.length) return;
        lightboxOpen = true;
        const lb = ui.querySelector('#finalPublishLightbox');
        if (lb) {
            lb.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        syncLightboxContent();
    }

    function closePublishLightbox() {
        lightboxOpen = false;
        const lb = ui.querySelector('#finalPublishLightbox');
        if (lb) lb.classList.add('hidden');
        document.body.style.overflow = '';
    }

    function stepFlatPreview(delta) {
        const slots = buildFlatPublishSlots();
        const n = slots.length;
        if (n <= 0) return;
        let idx = MISSION.selectedImagePreviewIndex || 0;
        idx = (idx + delta + n) % n;
        MISSION.selectedImagePreviewIndex = idx;
        const slot = slots[idx];
        if (slot) MISSION.selectedImageBatchId = slot.batchId;
        syncFinalPreview();
        syncLightboxContent();
    }

    function syncFinalPreview() {
        const rows = MISSION.generatedImageBatches || [];
        const slots = buildFlatPublishSlots();
        const n = slots.length;
        let idx = MISSION.selectedImagePreviewIndex || 0;
        if (n > 0) idx = Math.max(0, Math.min(idx, n - 1));
        else idx = 0;
        MISSION.selectedImagePreviewIndex = idx;
        const slot = n > 0 ? slots[idx] : null;
        if (slot) MISSION.selectedImageBatchId = slot.batchId;
        const batch = slot?.batch || null;
        const imgs = batch?.images || [];
        const imageIndexInBatch = slot?.imageIndex ?? 0;

        const url = slot ? (slot.img.finalUrl || slot.img.imageUrl || '') : '';
        const imgEl = ui.querySelector('#finalPreviewImg');
        const idxBadge = ui.querySelector('#finalImageIdxBadge');
        const batchBadge = ui.querySelector('#finalBatchMetaBadge');
        const hint = ui.querySelector('#finalMultiPublishHint');
        const pickTools = ui.querySelector('#finalPublishPickTools');
        const pickWrap = ui.querySelector('#finalPublishPickWrap');
        const publishCb = ui.querySelector('#finalPublishIncludeCb');
        const previewFrame = ui.querySelector('#finalPreviewFrame');
        const prev = ui.querySelector('#finalImgPrev');
        const next = ui.querySelector('#finalImgNext');

        const mask = batch && imgs.length > 0 ? ensureSyntheticPublishMask(batch.id, imgs.length) : [];
        const included = batch && imgs.length > 0 ? !!mask[imageIndexInBatch] : false;

        if (imgEl) {
            imgEl.classList.add('opacity-80');
            imgEl.onload = () => { imgEl.classList.remove('opacity-80'); };
            imgEl.src = url || '';
        }
        if (idxBadge) idxBadge.textContent = n === 0 ? '—' : `${idx + 1} / ${n}`;
        if (batchBadge) {
            if (batch && rows.length) {
                const ord = rows.findIndex((b) => b.id === batch.id);
                const numFromNewest = ord >= 0 ? rows.length - ord : 0;
                batchBadge.textContent = `第 ${numFromNewest} 批 · 此批 ${imgs.length} 張`;
            } else {
                batchBadge.textContent = '';
            }
        }
        if (pickWrap) pickWrap.classList.toggle('hidden', n === 0);
        if (publishCb) publishCb.checked = included;
        if (previewFrame && n > 0) {
            previewFrame.classList.toggle('ring-rose-500/75', included);
            previewFrame.classList.toggle('ring-white/20', !included);
        } else if (previewFrame) {
            previewFrame.classList.remove('ring-rose-500/75', 'ring-white/20');
        }
        if (pickTools) pickTools.classList.toggle('hidden', n === 0);
        if (hint) {
            if (n > 0) {
                hint.classList.remove('hidden');
                const att = normalizeAttachmentFilesForPublish().length;
                const selSynth = totalSelectedSynthCount();
                hint.innerHTML = `<strong class="text-slate-200">目前張數（跨批次）：</strong>已選 <span class="text-rose-300 font-bold">${selSynth}</span> 張合成圖 + <span class="text-indigo-300 font-bold">${att}</span> 張附件 = <span class="text-white font-black">${selSynth + att}</span> / ${PUBLISH_MEDIA_MAX_TOTAL} 張。可全部不選圖，只發文字也行。`;
            } else {
                hint.classList.add('hidden');
                hint.textContent = '';
            }
        }

        const thumbWrap = ui.querySelector('#finalThumbScrollWrap');
        const thumbStrip = ui.querySelector('#finalThumbStrip');
        if (thumbWrap && thumbStrip) {
            const attCount = normalizeAttachmentFilesForPublish().length;
            if (n === 0 && attCount === 0) {
                thumbWrap.classList.add('hidden');
                thumbStrip.innerHTML = '';
            } else {
                thumbWrap.classList.remove('hidden');
                const synthHtml = slots.map((s, flatI) => {
                    const u = s.img.finalUrl || s.img.imageUrl || '';
                    const m = ensureSyntheticPublishMask(s.batchId, (s.batch.images || []).length);
                    const on = !!m[s.imageIndex];
                    const isCur = flatI === idx;
                    const curRing = isCur ? 'border-indigo-400 ring-2 ring-indigo-500/60' : 'border-white/20';
                    const ord = rows.findIndex((b) => b.id === s.batchId);
                    const batchNum = ord >= 0 ? rows.length - ord : 0;
                    const checkMark = on
                        ? '<span class="pointer-events-none absolute bottom-1 right-1 min-w-[1.5rem] h-6 px-0.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-md" aria-hidden="true">✓</span>'
                        : '';
                    return `
                    <div class="snap-start shrink-0 flex flex-col items-center gap-1 w-[4.85rem] sm:w-[5.35rem]">
                        <button type="button" class="thumb-preview-btn relative w-[4.25rem] h-[4.25rem] sm:w-[4.75rem] sm:h-[4.75rem] rounded-xl overflow-hidden border-[3px] ${curRing} touch-manipulation active:opacity-90 shadow-md bg-slate-800" data-flat-idx="${flatI}" aria-label="第${batchNum}批 第 ${s.imageIndex + 1} 張" aria-current="${isCur ? 'true' : 'false'}">
                            <img src="${u}" alt="" class="w-full h-full object-cover pointer-events-none" loading="lazy" decoding="async">
                            <span class="pointer-events-none absolute top-0.5 left-0.5 min-w-[1.1rem] h-5 flex items-center justify-center bg-black/80 text-[9px] font-black text-white px-1 rounded border border-white/20 leading-none">B${batchNum}</span>
                            ${checkMark}
                        </button>
                        <label class="flex items-center justify-center gap-1.5 w-full min-h-[40px] py-1 rounded-lg active:bg-white/5 touch-manipulation cursor-pointer select-none">
                            <input type="checkbox" class="final-thumb-pub w-[18px] h-[18px] sm:w-4 sm:h-4 accent-rose-500 shrink-0 touch-manipulation" data-batch-id="${s.batchId}" data-img-idx="${s.imageIndex}" ${on ? 'checked' : ''}>
                            <span class="text-[10px] sm:text-[10px] text-slate-400 font-bold">發佈</span>
                        </label>
                    </div>`;
                }).join('');

                const attachHtml = normalizeAttachmentFilesForPublish().map((af, idx) => {
                    const u = af.imageUrl || af.dataUrl || af.data || '';
                    return `
                    <div class="snap-start shrink-0 flex flex-col items-center gap-1 w-[4.85rem] sm:w-[5.35rem] opacity-75">
                        <div class="relative w-[4.25rem] h-[4.25rem] sm:w-[4.75rem] sm:h-[4.75rem] rounded-xl overflow-hidden border-[3px] border-dashed border-indigo-500/50 bg-slate-800 shadow-md">
                            <img src="${u}" alt="" class="w-full h-full object-cover pointer-events-none" loading="lazy">
                            <span class="pointer-events-none absolute top-0.5 left-0.5 min-w-[1.1rem] h-5 flex items-center justify-center bg-indigo-950/80 text-[8px] font-black text-indigo-300 px-1 rounded border border-indigo-500/20 leading-none">附件</span>
                            <span class="pointer-events-none absolute bottom-1 right-1 min-w-[1.5rem] h-6 px-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center border-2 border-white shadow-md">✓</span>
                        </div>
                        <div class="text-[9px] text-slate-500 font-bold text-center min-h-[40px] py-2">固定發佈</div>
                    </div>`;
                }).join('');

                thumbStrip.innerHTML = synthHtml + attachHtml;

                thumbStrip.querySelectorAll('.thumb-preview-btn').forEach((btn) => {
                    btn.onclick = () => {
                        const i = parseInt(btn.dataset.flatIdx, 10);
                        if (!Number.isNaN(i)) {
                            MISSION.selectedImagePreviewIndex = i;
                            const sl = buildFlatPublishSlots()[i];
                            if (sl) MISSION.selectedImageBatchId = sl.batchId;
                            syncFinalPreview();
                        }
                    };
                });
                thumbStrip.querySelectorAll('.final-thumb-pub').forEach((cb) => {
                    cb.onchange = () => {
                        const bid = cb.dataset.batchId;
                        const ii = parseInt(cb.dataset.imgIdx, 10);
                        const batchNow = rows.find((b) => b.id === bid);
                        if (!batchNow || Number.isNaN(ii)) return;
                        const want = cb.checked;
                        if (!trySetPublishInclusion(batchNow, ii, want)) {
                            cb.checked = !want;
                            return showError(`最多只能發 ${PUBLISH_MEDIA_MAX_TOTAL} 張圖（含附件）。請少勾幾張，或回到前面減少附件。`);
                        }
                        syncFinalPreview();
                    };
                });
            }
        }

        const multi = n > 1;
        if (prev) {
            prev.classList.toggle('invisible', !multi);
            prev.toggleAttribute('disabled', !multi);
        }
        if (next) {
            next.classList.toggle('invisible', !multi);
            next.toggleAttribute('disabled', !multi);
        }

        ui.querySelectorAll('.batch-chip').forEach(chip => {
            const on = chip.dataset.batchId === MISSION.selectedImageBatchId;
            chip.classList.toggle('border-indigo-500', on);
            chip.classList.toggle('bg-indigo-600', on);
            chip.classList.toggle('text-white', on);
            chip.classList.toggle('border-white/10', !on);
            chip.classList.toggle('bg-slate-900', !on);
            chip.classList.toggle('text-slate-400', !on);
        });

        syncLightboxContent();
    }

    // 🔙 綁定返回大廳事件
    const returnToLobbyHandler = () => {
        closePublishLightbox();
        releaseUI(ui);
        window.dispatchEvent(new CustomEvent('reloadLobby', { detail: { preserveMission: true } }));
        // 恢復聊天室視窗狀態
        const chatBar = document.getElementById('agentChatBar');
        if(chatBar) chatBar.classList.remove('translate-y-full'); 
    };
    ui.querySelector('#btnTopReturnLobbyFinal').onclick = returnToLobbyHandler;
    ui.querySelector('#btnBottomReturnLobbyFinal').onclick = returnToLobbyHandler;

    ui.querySelectorAll('.final-plat-chip').forEach(btn => {
        btn.onclick = () => {
            const p = btn.dataset.plat;
            if (MISSION.platforms.includes(p)) {
                if (MISSION.platforms.length <= 1) return;
                MISSION.platforms = MISSION.platforms.filter(x => x !== p);
                btn.classList.remove('border-blue-500', 'bg-blue-600', 'text-white');
                btn.classList.add('border-white/10', 'bg-slate-900', 'text-slate-400');
            } else {
                MISSION.platforms.push(p);
                btn.classList.remove('border-white/10', 'bg-slate-900', 'text-slate-400');
                btn.classList.add('border-blue-500', 'bg-blue-600', 'text-white');
            }
        };
    });
    const scheduleInput = ui.querySelector('#finalScheduleInput');
    if (scheduleInput) {
        scheduleInput.onchange = (e) => {
            const v = e.target.value;
            MISSION.scheduledAt = v ? new Date(v).toISOString() : null;
        };
    }
    const immediateBtn = ui.querySelector('#btnFinalImmediate');
    if (immediateBtn) {
        immediateBtn.onclick = () => {
            MISSION.scheduledAt = null;
            if (scheduleInput) scheduleInput.value = '';
        };
    }

    ui.querySelectorAll('.batch-chip').forEach(btn => {
        btn.onclick = () => {
            MISSION.selectedImageBatchId = btn.dataset.batchId;
            const slots = buildFlatPublishSlots();
            const at = slots.findIndex((s) => s.batchId === btn.dataset.batchId);
            MISSION.selectedImagePreviewIndex = at >= 0 ? at : 0;
            const b = getPublishSelectedBatch();
            const ta = ui.querySelector('#finalCaptionEdit');
            if (ta && b && typeof b.caption === 'string') ta.value = b.caption;
            syncFinalPreview();
        };
    });

    const prevImgBtn = ui.querySelector('#finalImgPrev');
    const nextImgBtn = ui.querySelector('#finalImgNext');
    if (prevImgBtn) {
        prevImgBtn.onclick = (e) => {
            e.stopPropagation();
            stepFlatPreview(-1);
        };
    }
    if (nextImgBtn) {
        nextImgBtn.onclick = (e) => {
            e.stopPropagation();
            stepFlatPreview(1);
        };
    }

    const previewImgEl = ui.querySelector('#finalPreviewImg');
    if (previewImgEl) {
        previewImgEl.onclick = (e) => {
            e.stopPropagation();
            openPublishLightbox();
        };
    }

    const lbClose = ui.querySelector('#finalLbClose');
    const lbImg = ui.querySelector('#finalLbImg');
    const lbPrev = ui.querySelector('#finalLbPrev');
    const lbNext = ui.querySelector('#finalLbNext');
    const lbStage = ui.querySelector('#finalLbStage');
    if (lbClose) lbClose.onclick = (e) => { e.stopPropagation(); closePublishLightbox(); };
    if (lbImg) {
        lbImg.onclick = (e) => {
            e.stopPropagation();
            closePublishLightbox();
        };
    }
    if (lbPrev) lbPrev.onclick = (e) => { e.stopPropagation(); stepFlatPreview(-1); };
    if (lbNext) lbNext.onclick = (e) => { e.stopPropagation(); stepFlatPreview(1); };

    let lbTouchX0 = 0;
    if (lbStage) {
        lbStage.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) lbTouchX0 = e.touches[0].clientX;
        }, { passive: true });
        lbStage.addEventListener('touchend', (e) => {
            if (!lightboxOpen || !e.changedTouches.length) return;
            const dx = e.changedTouches[0].clientX - lbTouchX0;
            if (Math.abs(dx) < 56) return;
            if (dx < 0) stepFlatPreview(1);
            else stepFlatPreview(-1);
        }, { passive: true });
    }

    const publishCbEl = ui.querySelector('#finalPublishIncludeCb');
    if (publishCbEl) {
        publishCbEl.addEventListener('change', () => {
            const slots = buildFlatPublishSlots();
            const flatI = MISSION.selectedImagePreviewIndex || 0;
            const slot = slots[flatI];
            if (!slot) return;
            const batch = slot.batch;
            const want = publishCbEl.checked;
            if (!trySetPublishInclusion(batch, slot.imageIndex, want)) {
                publishCbEl.checked = !want;
                return showError(`最多只能發 ${PUBLISH_MEDIA_MAX_TOTAL} 張圖（含附件）。請少勾幾張，或回到前面減少附件。`);
            }
            syncFinalPreview();
        });
    }

    const btnSynthAll = ui.querySelector('#btnSynthPublishAll');
    const btnSynthNone = ui.querySelector('#btnSynthPublishNone');
    if (btnSynthAll) {
        btnSynthAll.onclick = () => {
            const batch = getPublishSelectedBatch();
            const n = batch?.images?.length || 0;
            if (!batch || n < 1) return;
            const att = normalizeAttachmentFilesForPublish().length;
            const others = countSelectedSynthExcludingBatch(batch.id);
            if (others + n + att > PUBLISH_MEDIA_MAX_TOTAL) {
                return showError(`本批全選後合計會超過 ${PUBLISH_MEDIA_MAX_TOTAL} 張（含附件與其他批次已勾選）。請調整。`);
            }
            const mask = ensureSyntheticPublishMask(batch.id, n);
            for (let i = 0; i < n; i++) mask[i] = true;
            syncFinalPreview();
        };
    }
    if (btnSynthNone) {
        btnSynthNone.onclick = () => {
            const batch = getPublishSelectedBatch();
            const n = batch?.images?.length || 0;
            if (!batch || n < 1) return;
            const mask = ensureSyntheticPublishMask(batch.id, n);
            for (let i = 0; i < n; i++) mask[i] = false;
            syncFinalPreview();
        };
    }

    syncFinalPreview();

    ui.querySelector('#btnRegenerateImages').onclick = async () => {
        const capEl = ui.querySelector('#finalCaptionEdit');
        const currentTab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
        if (capEl) {
            MISSION.currentCaptions[currentTab] = capEl.value.trim();
        }
        const tagsString = (MISSION.currentHashtags[currentTab] || []).length > 0
            ? '\n\n' + MISSION.currentHashtags[currentTab].map(t => '#' + t.replace(/^#/, '')).join(' ')
            : '';
        const regeneratedCaption = (MISSION.currentCaptions[currentTab] || '') + tagsString;
        await window.FunnelActions.generateImages(taskId, regeneratedCaption, MISSION.currentPanels);
    };

    ui.querySelector('#btnBackToDraft').onclick = async () => {
        closePublishLightbox();
        releaseUI(ui);
        markImageRegenerationRequired('退回修改草稿');
        const currentTab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
        const finalCapEl = ui.querySelector('#finalCaptionEdit');
        const latestCaption = (finalCapEl ? finalCapEl.value : selectedCaption) || MISSION.currentCaptions[currentTab] || '';
        MISSION.currentCaptions[currentTab] = latestCaption;
        const pseudoDraft = {
            post_caption: latestCaption,
            hashtags: MISSION.currentHashtags[currentTab] || [],
            panels: MISSION.currentPanels
        };
        await renderDraftEditorCard(taskId, pseudoDraft, MISSION.universe === 'COMIC', {
            returnBannerText: '已回到內容編輯卡（不回漏斗）。'
        });
    };

    ui.querySelector('#btnDeploy').onclick = async () => {
        const capEl = ui.querySelector('#finalCaptionEdit');
        if (capEl) selectedCaption = capEl.value;
        const currentCtx = buildImageGenerationContextKey();
        if (MISSION.imageRegenerationRequired || MISSION.lastGeneratedContextKey !== currentCtx) {
            return showError('偵測到你已修改主題/風格/角色/參考圖，請先「重算生圖」後再發佈，避免圖文不一致。');
        }

        const mergedPre = collectSelectedPublishImagesMerged();
        const synthSelPre = mergedPre.length;
        const attPre = normalizeAttachmentFilesForPublish().length;
        if (synthSelPre + attPre > PUBLISH_MEDIA_MAX_TOTAL) {
            return showError(`圖片太多了：合成 + 附件最多 ${PUBLISH_MEDIA_MAX_TOTAL} 張，請調整勾選或附件。`);
        }

        closePublishLightbox();
        releaseUI(ui); const spinId = 'spin_pub_' + Date.now();
        await addLog("系統", "⏳", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">Agent 正在與社群伺服器連線...</span></div>`, true);
        try {
            const finalMultiCaptions = {};
            ['UNIFIED', 'FB', 'IG', 'THREADS'].forEach(p => {
                if (MISSION.currentCaptions[p]) {
                    const tagsStr = MISSION.currentHashtags[p].length > 0 ? '\n\n' + MISSION.currentHashtags[p].map(t => '#' + t).join(' ') : '';
                    finalMultiCaptions[p] = MISSION.currentCaptions[p] + tagsStr;
                }
            });

            const publishImages = collectSelectedPublishImagesMerged();

            const response = await publishTaskAPI({ 
                taskId: taskId, 
                tenantId: STATE.uid, 
                scheduledAt: MISSION.scheduledAt, 
                finalCaption: selectedCaption,
                multiCaptions: finalMultiCaptions, 
                isIndependentPost: MISSION.isIndependentPost,
                attachmentFiles: normalizeAttachmentFilesForPublish(),
                selectedImageBatchId: null,
                selectedImages: publishImages.map(img => ({
                    finalUrl: img.finalUrl || img.imageUrl || '',
                    prompt: img.prompt || ''
                }))
            });
            
            if (response && response.success) {
                const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('bg-emerald-500'); document.getElementById(`text_${spinId}`).innerText = "連線成功"; }
                
                const charged = Number(response.chargedPoints);
                if (Number.isFinite(charged) && charged > 0) {
                    await applyPointDeduction(
                        charged,
                        getBillingActionDisplayName('PUBLISH_POST', '社群發布')
                    );
                } else {
                    await triggerWalletSync();
                }

                const chatBar = document.getElementById('agentChatBar'); if(chatBar) chatBar.classList.add('translate-y-full');
                await addLog("系統", "🎉", `<span class="text-green-400 font-bold">發佈流程完畢</span> 任務圓滿達成！您已跨出商業化第一步！🥂`, true);
                const endUi = createSkillUI(`<button id="btnRestart" class="w-full bg-slate-800 border border-white/10 text-white py-3 rounded-xl font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all shadow-lg">🔄 回到任務大廳</button>`);
                endUi.querySelector('#btnRestart').onclick = () => { releaseUI(endUi); window.dispatchEvent(new Event('reloadLobby')); }; 
            } else { throw new Error(response.message || "未能完成發佈。"); }
        } catch(e) { 
            const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-emerald-500'); spEl.classList.add('border-red-500'); document.getElementById(`text_${spinId}`).innerText = "連線失敗"; }
            showError(`操作失敗：${e.message}`); 
        }
    };
}
