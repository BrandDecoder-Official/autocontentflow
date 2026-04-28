// js/v9_funnel_editor.js
import { STATE } from './config.js'; 
import { MISSION, buildImageGenerationContextKey, markImageRegenerationRequired, recordGeneratedImageBatch } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';
import { publishTaskAPI } from './api.js'; 

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

function getImagePlanSuggestion() {
    const topic = (MISSION.topic || '').toLowerCase();
    const hasStoryIntent = /劇情|連載|短篇漫畫|分鏡|故事|系列|episode|story/.test(topic);
    const hasCompareIntent = /對比|開箱|前後|步驟|教學|清單|攻略|懶人包/.test(topic);

    if (MISSION.universe === 'COMIC') {
        if (hasStoryIntent) {
            return { panelCount: 2, colorMode: 'Color', imageCount: 4, reason: '主題具連續敘事傾向，建議彩色雙格搭配 4 張，兼顧節奏與成本。' };
        }
        if (hasCompareIntent) {
            return { panelCount: 2, colorMode: 'Color', imageCount: 3, reason: '主題偏資訊呈現，2 格有利於對比與重點拆解。' };
        }
        return { panelCount: 1, colorMode: 'Color', imageCount: 2, reason: '一般主題先用 1 格主視覺 + 1 張補圖，重複風險較低。' };
    }

    if (hasCompareIntent) {
        return { panelCount: MISSION.panelCount || 1, colorMode: MISSION.colorMode || '原色直出', imageCount: 3, reason: '資訊型主題建議 3 張內，避免相似圖造成算力浪費。' };
    }
    return { panelCount: MISSION.panelCount || 1, colorMode: MISSION.colorMode || '原色直出', imageCount: 2, reason: '寫實主題通常 2 張即可覆蓋主視覺與情境補圖。' };
}

export async function renderDraftEditorCard(taskId, draftContent, isComic) {
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
            <div class="flex justify-between items-center px-1 mb-2">
                <button id="btnTopReturnLobby" class="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-bold">
                    <i class="fa-solid fa-arrow-left"></i> 暫存並返回大廳
                </button>
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
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                    <div class="bg-slate-900/70 rounded-lg border border-white/10 px-2 py-2 text-slate-300">建議格數：<span id="aiPanelHint" class="text-violet-300 font-bold">${suggestion.panelCount} 格</span></div>
                    <div class="bg-slate-900/70 rounded-lg border border-white/10 px-2 py-2 text-slate-300">建議色系：<span id="aiColorHint" class="text-violet-300 font-bold">${suggestion.colorMode === 'BW' ? '黑白' : suggestion.colorMode}</span></div>
                    <div class="bg-slate-900/70 rounded-lg border border-white/10 px-2 py-2 text-slate-300">建議張數：<span id="aiCountHint" class="text-violet-300 font-bold">${suggestion.imageCount} 張</span></div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label class="text-[10px] text-slate-400 font-bold flex items-center justify-between bg-slate-900/60 rounded-lg px-2 py-2 border border-white/10">
                        <span>本次生圖張數</span>
                        <select id="plannedImageCount" class="bg-slate-800 border border-white/10 rounded px-2 py-1 text-[10px] text-white">
                            ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<option value="${n}" ${MISSION.plannedImageCount === n ? 'selected' : ''}>${n} 張</option>`).join('')}
                        </select>
                    </label>
                    <label class="text-[10px] text-slate-400 font-bold flex items-center gap-2 bg-slate-900/60 rounded-lg px-2 py-2 border border-white/10">
                        <input id="storyModeToggle" type="checkbox" class="accent-violet-500" ${MISSION.isStoryMode ? 'checked' : ''}>
                        連續劇情模式（適合短篇漫畫）
                    </label>
                </div>
            </div>
            
            <button id="btnFinalGenerate" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">✨ 確認劇本與對白，發包生圖</button>
            
            <button id="btnBottomReturnLobby" class="w-full bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700 mt-2">
                🔙 稍後處理，返回大廳
            </button>
        </div>
    `);

    // 🔙 綁定返回大廳事件
    const returnToLobbyHandler = () => {
        saveCurrentCaption(); // 離開前默默存個檔在記憶體裡
        releaseUI(ui);
        window.dispatchEvent(new Event('reloadLobby'));
    };
    ui.querySelector('#btnTopReturnLobby').onclick = returnToLobbyHandler;
    ui.querySelector('#btnBottomReturnLobby').onclick = returnToLobbyHandler;

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

    ui.querySelector('#plannedImageCount').onchange = (e) => {
        MISSION.plannedImageCount = parseInt(e.target.value, 10);
    };
    ui.querySelector('#storyModeToggle').onchange = (e) => {
        MISSION.isStoryMode = !!e.target.checked;
    };
    ui.querySelector('#btnApplyAiSuggestion').onclick = async () => {
        MISSION.plannedImageCount = suggestion.imageCount;
        MISSION.isStoryMode = suggestion.imageCount >= 4;
        if (MISSION.universe === 'COMIC') {
            MISSION.panelCount = suggestion.panelCount;
            MISSION.colorMode = suggestion.colorMode;
        }
        ui.querySelector('#plannedImageCount').value = String(MISSION.plannedImageCount);
        ui.querySelector('#storyModeToggle').checked = MISSION.isStoryMode;
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
    let selectedBatch = batches.find(b => b.id === MISSION.selectedImageBatchId) || batches[0] || null;
    const selectedImages = selectedBatch?.images || [];
    const displayImgUrl = selectedImages && selectedImages.length > 0 ? (selectedImages[0].finalUrl || selectedImages[0].imageUrl || '') : '';
    const selectedCaption = selectedBatch?.caption || finalCaption || '';
    let btnText = "🚀 立即發佈至社群"; let btnColor = "from-green-600 to-emerald-600";
    if(MISSION.scheduledAt) { const dateStr = new Date(MISSION.scheduledAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); btnText = `⏰ 寫入排程 (${dateStr})`; btnColor = "from-orange-500 to-red-500"; }

    const previewNote = MISSION.isIndependentPost ? `<p class="text-[10px] text-amber-400 mb-2">※ 多宇宙模式：此為主要平台預覽，發布時將自動切分各平台專屬文案與標籤。</p>` : '';

    const ui = createSkillUI(`
        <div class="flex flex-col gap-3 w-full animate-fade-in">
            <div class="flex justify-between items-center px-1 mb-2">
                <button id="btnTopReturnLobbyFinal" class="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-bold">
                    <i class="fa-solid fa-arrow-left"></i> 暫存並返回大廳
                </button>
            </div>

            <div class="w-full bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div class="relative w-full aspect-square bg-black flex items-center justify-center">
                    <img src="${displayImgUrl}" class="max-w-full max-h-full object-contain">
                    <div class="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full border border-white/20">當前批次 ${selectedImages ? selectedImages.length : 0} 張圖</div>
                </div>
                <div class="p-4 border-t border-white/5 bg-slate-800/50 shadow-inner">
                    ${previewNote}
                    <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">${selectedCaption}</p>
                    <div class="mt-3 pt-3 border-t border-white/10 space-y-2">
                        <div class="text-[10px] text-slate-400 font-bold">🗂️ 已扣點生圖資產（可切換批次）</div>
                        <div id="batchSelector" class="flex flex-wrap gap-2">
                            ${batches.map((b, idx) => `<button class="batch-chip px-2 py-1 rounded-lg text-[10px] font-bold border ${b.id === MISSION.selectedImageBatchId ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/10 bg-slate-900 text-slate-400'}" data-batch-id="${b.id}">第 ${batches.length - idx} 批</button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
            
            <button id="btnDeploy" class="w-full bg-gradient-to-r ${btnColor} text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">${btnText}</button>
            
            <div class="flex gap-2 w-full">
                <button id="btnRegenerateImages" class="flex-1 bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700">🎲 重算 (約500點)</button>
                <button id="btnBackToDraft" class="flex-1 bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700">📝 退回重改</button>
            </div>

            <button id="btnBottomReturnLobbyFinal" class="w-full bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700 mt-1">
                🔙 任務已保留，返回大廳
            </button>
        </div>
    `);

    // 🔙 綁定返回大廳事件
    const returnToLobbyHandler = () => {
        releaseUI(ui);
        window.dispatchEvent(new Event('reloadLobby'));
        // 恢復聊天室視窗狀態
        const chatBar = document.getElementById('agentChatBar');
        if(chatBar) chatBar.classList.remove('translate-y-full'); 
    };
    ui.querySelector('#btnTopReturnLobbyFinal').onclick = returnToLobbyHandler;
    ui.querySelector('#btnBottomReturnLobbyFinal').onclick = returnToLobbyHandler;

    ui.querySelectorAll('.batch-chip').forEach(btn => {
        btn.onclick = async () => {
            MISSION.selectedImageBatchId = btn.dataset.batchId;
            releaseUI(ui);
            await renderFinalPublishCard(taskId, images, finalCaption);
        };
    });

    ui.querySelector('#btnRegenerateImages').onclick = async () => {
        let currentTab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
        const tagsString = (MISSION.currentHashtags[currentTab] || []).length > 0
            ? '\n\n' + MISSION.currentHashtags[currentTab].map(t => '#' + t.replace(/^#/, '')).join(' ')
            : '';
        const regeneratedCaption = (MISSION.currentCaptions[currentTab] || '') + tagsString;
        await window.FunnelActions.generateImages(taskId, regeneratedCaption, MISSION.currentPanels);
    };

    ui.querySelector('#btnBackToDraft').onclick = async () => {
        releaseUI(ui);
        markImageRegenerationRequired('退回修改草稿');
        await addLog("系統", "🔙", "已退回草稿編輯模式。", true);
        const pseudoDraft = { panels: MISSION.currentPanels };
        await renderDraftEditorCard(taskId, pseudoDraft, MISSION.universe === 'COMIC');
    };

    ui.querySelector('#btnDeploy').onclick = async () => {
        const currentCtx = buildImageGenerationContextKey();
        if (MISSION.imageRegenerationRequired || MISSION.lastGeneratedContextKey !== currentCtx) {
            return showError('偵測到你已修改主題/風格/角色/參考圖，請先「重算生圖」後再發佈，避免圖文不一致。');
        }

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

            const response = await publishTaskAPI({ 
                taskId: taskId, 
                tenantId: STATE.uid, 
                scheduledAt: MISSION.scheduledAt, 
                finalCaption: selectedCaption,
                multiCaptions: finalMultiCaptions, 
                isIndependentPost: MISSION.isIndependentPost,
                attachmentFiles: normalizeAttachmentFilesForPublish(),
                selectedImageBatchId: selectedBatch?.id || null,
                selectedImages: (selectedImages || []).map(img => ({
                    finalUrl: img.finalUrl || img.imageUrl || '',
                    prompt: img.prompt || ''
                }))
            });
            
            if (response && response.success) {
                const spEl = document.getElementById(spinId); if(spEl){ spEl.classList.remove('animate-spin', 'border-t-transparent'); spEl.classList.add('bg-emerald-500'); document.getElementById(`text_${spinId}`).innerText = "連線成功"; }
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
