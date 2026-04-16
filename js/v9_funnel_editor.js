// js/v9_funnel_editor.js
import { STATE } from './config.js'; 
import { MISSION } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';
import { publishTaskAPI } from './api.js'; 

export async function renderDraftEditorCard(taskId, draftContent, isComic) {
    updateStepHeader("DRAFT EDITOR"); 

    // 💡 1. 強化 V10 資料結構初始化 (確保任何情況下都不會報錯)
    MISSION.currentCaptions = MISSION.currentCaptions || { UNIFIED: '', FB: '', IG: '', THREADS: '' };
    MISSION.currentHashtags = MISSION.currentHashtags || { UNIFIED: [], FB: [], IG: [], THREADS: [] };

    // 💡 2. 智慧型資料解析：應對後端回傳格式的各種可能
    if (draftContent && typeof draftContent.captions === 'object') {
        // V10 多軌格式：後端回傳了 { FB: "...", IG: "..." }
        MISSION.currentCaptions = { ...MISSION.currentCaptions, ...draftContent.captions };
        if (draftContent.hashtags && typeof draftContent.hashtags === 'object' && !Array.isArray(draftContent.hashtags)) {
             MISSION.currentHashtags = { ...MISSION.currentHashtags, ...draftContent.hashtags };
        } else if (Array.isArray(draftContent.hashtags)) {
             // 如果 hashtag 還是舊版陣列，就複製給每個平台
             ['UNIFIED', 'FB', 'IG', 'THREADS'].forEach(p => MISSION.currentHashtags[p] = [...draftContent.hashtags]);
        }
    } else {
        // V9 舊版單軌格式：後端只回傳了單一字串或 post_caption
        const defaultCap = typeof draftContent === 'string' ? draftContent : (draftContent.post_caption || '');
        const defaultTags = Array.isArray(draftContent.hashtags) ? draftContent.hashtags : (MISSION.currentHashtagsArray || []);
        
        ['UNIFIED', 'FB', 'IG', 'THREADS'].forEach(p => {
            if (!MISSION.currentCaptions[p]) MISSION.currentCaptions[p] = defaultCap;
            if (MISSION.currentHashtags[p].length === 0) MISSION.currentHashtags[p] = [...defaultTags];
        });
    }

    // 決定目前要顯示哪個平台的 Tab
    let currentTab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
    
    // 生成漫畫分鏡 HTML (所有平台共用同一組圖)
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

    // 準備 Tab 切換 UI
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

    const ui = createSkillUI(`
        <div class="space-y-4 mb-4 animate-fade-in">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 space-y-3 shadow-inner">
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
            <button id="btnFinalGenerate" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">✨ 確認劇本與對白，發包生圖</button>
        </div>
    `);

    // 🏷️ Hashtag 渲染邏輯 (綁定到 currentTab)
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

    // 輸入新 Hashtag
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

    // 儲存目前輸入框的內容到狀態機
    const saveCurrentCaption = () => {
        MISSION.currentCaptions[currentTab] = ui.querySelector('#editCaption').value;
    };
    ui.querySelector('#editCaption').oninput = saveCurrentCaption;

    // 🔄 Tab 切換邏輯
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
            // 💡 確保切換時文字框顯示正確
            ui.querySelector('#editCaption').value = MISSION.currentCaptions[currentTab] || '';
            renderHashtags();
        };
    });

    ui.querySelectorAll('.panel-dialogue').forEach(input => {
        const container = input.closest('.panel-container'); const counter = container.querySelector('.char-counter'); const limit = parseInt(counter.dataset.limit);
        const updateCounter = () => { const len = input.value.length; counter.innerText = `${len} / ${limit} 字`; if (len > limit) { counter.classList.remove('text-slate-500'); counter.classList.add('text-red-500'); input.classList.add('border-red-500', 'text-red-400'); } else { counter.classList.remove('text-red-500'); counter.classList.add('text-slate-500'); input.classList.remove('border-red-500', 'text-red-400'); } };
        input.addEventListener('input', updateCounter); updateCounter();
    });

    ui.querySelector('#btnFinalGenerate').onclick = async () => {
        saveCurrentCaption(); 
        
        // 💡 3. 將 Hashtag 自動貼合到最終字串，為生圖和發布準備！
        // 我們這裡還是傳送一個「主要」字串給舊的生圖邏輯，但把完整的 captions 物件存在 MISSION 裡供發布使用
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

export async function renderFinalPublishCard(taskId, images, finalCaption) {
    updateStepHeader("FINAL DEPLOYMENT"); 
    await addLog("社群總監", "🚀", "大作已完成！請做最後確認，您還可以選擇重新算圖或退回修改：", true);

    const displayImgUrl = images[0].finalUrl; let btnText = "🚀 立即發佈至社群"; let btnColor = "from-green-600 to-emerald-600";
    if(MISSION.scheduledAt) { const dateStr = new Date(MISSION.scheduledAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); btnText = `⏰ 寫入排程 (${dateStr})`; btnColor = "from-orange-500 to-red-500"; }

    // 💡 預覽區域：如果是多平台模式，提示使用者這只是「主要預覽」
    const previewNote = MISSION.isIndependentPost ? `<p class="text-[10px] text-amber-400 mb-2">※ 多宇宙模式：此為主要平台預覽，發布時將自動切分各平台專屬文案與標籤。</p>` : '';

    const ui = createSkillUI(`
        <div class="space-y-4 animate-fade-in mb-4">
            <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div class="relative w-full aspect-square bg-black flex items-center justify-center">
                    <img src="${displayImgUrl}" class="max-w-full max-h-full object-contain">
                    <div class="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full border border-white/20">共 ${images.length} 張圖</div>
                </div>
                <div class="p-4 border-t border-white/5 bg-slate-800/50 shadow-inner">
                    ${previewNote}
                    <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">${finalCaption}</p>
                </div>
            </div>
            <button id="btnDeploy" class="w-full bg-gradient-to-r ${btnColor} text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">${btnText}</button>
            <div class="flex gap-2">
                <button id="btnRegenerateImages" class="flex-1 bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700">🎲 重新算圖 (預計扣 500 算力點)</button>
                <button id="btnBackToDraft" class="flex-1 bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700">📝 退回總編室 (改字)</button>
            </div>
        </div>
    `);

    ui.querySelector('#btnRegenerateImages').onclick = async () => {
        let currentTab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
        await window.FunnelActions.generateImages(taskId, MISSION.currentCaptions[currentTab], MISSION.currentPanels);
    };

    ui.querySelector('#btnBackToDraft').onclick = async () => {
        releaseUI(ui);
        await addLog("系統", "🔙", "已退回草稿編輯模式。", true);
        const pseudoDraft = { panels: MISSION.currentPanels };
        await renderDraftEditorCard(taskId, pseudoDraft, MISSION.universe === 'COMIC');
    };

    ui.querySelector('#btnDeploy').onclick = async () => {
        releaseUI(ui); const spinId = 'spin_pub_' + Date.now();
        await addLog("系統", "⏳", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">Agent 正在與社群伺服器連線...</span></div>`, true);
        try {
            // 💡 4. 第四階段發動準備：將組裝好的【多重宇宙文案與標籤包】傳給後端！
            const finalMultiCaptions = {};
            ['UNIFIED', 'FB', 'IG', 'THREADS'].forEach(p => {
                if (MISSION.currentCaptions[p]) {
                    const tagsStr = MISSION.currentHashtags[p].length > 0 ? '\n\n' + MISSION.currentHashtags[p].map(t => '#' + t).join(' ') : '';
                    finalMultiCaptions[p] = MISSION.currentCaptions[p] + tagsStr;
                }
            });

            // 確保向下相容，同時送出單一 finalCaption 與多軌 multiCaptions
            const response = await publishTaskAPI({ 
                taskId: taskId, 
                tenantId: STATE.uid, 
                scheduledAt: MISSION.scheduledAt, 
                finalCaption: finalCaption,
                multiCaptions: finalMultiCaptions,  // 🌟 V10 多軌傳輸核心
                isIndependentPost: MISSION.isIndependentPost 
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
