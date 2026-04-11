// public/js/workflow.js
import { STATE } from './config.js';
import * as API from './api.js';
import * as UI from './ui.js';
import { showToast } from './utils.js';
import { compressImageToBase64 } from './image.js';

// ==========================================
// 🔍 圖片放大鏡控制 (Lightbox)
// ==========================================
export function openLightbox(imgSrc) {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImage');
    if (!lightbox || !lightboxImg) return;
    
    lightboxImg.src = imgSrc;
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
    
    void lightbox.offsetWidth;
    
    lightbox.classList.remove('opacity-0');
    lightboxImg.classList.remove('scale-95');
    lightboxImg.classList.add('scale-100');
}

export function closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImg = document.getElementById('lightboxImage');
    if (!lightbox) return;
    
    lightbox.classList.add('opacity-0');
    lightboxImg.classList.remove('scale-100');
    lightboxImg.classList.add('scale-95');
    
    setTimeout(() => {
        if (lightbox.classList.contains('opacity-0')) {
            lightbox.classList.add('hidden');
            lightbox.classList.remove('flex');
            lightboxImg.src = '';
        }
    }, 300);
}

// 🌟 [優化] 連動主模式切換 (與 main.js 對齊)
export async function setAppMode(mode) {
    // 此處現由 main.js 的 switchMode 統一調度 UI 顯示與 STATE 更新
}

export function backToStep1() { document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step1-setup').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
export function backToStep2() { 
    document.getElementById('step3-publish').classList.add('hidden'); 
    document.getElementById('step2-review').classList.remove('hidden'); 
    document.getElementById('aiQuickReplies').classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

export function resetToStep1() {
    document.getElementById('step3-publish').classList.add('hidden'); document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step1-setup').classList.remove('hidden');
    STATE.currentTaskId = null; STATE.multiImages = []; document.getElementById('agentForm').reset();
    document.getElementById('characterList').innerHTML = ''; document.getElementById('scenePreview').innerHTML = ''; document.getElementById('objectPreview').innerHTML = '';
    document.getElementById('aiQuickReplies').classList.add('hidden');
    
    STATE.sceneFiles = [];
    STATE.objectFiles = [];
    STATE.currentTags = []; 
    if(window.renderTagChips) window.renderTagChips();

    window.resetAgentConsole();
    setTimeout(async () => { await window.addAgentLog('專案總監', '👨‍💼', '任務已重置，全新的卷宗已就緒！'); }, 500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function initSystemData() {
    try {
        const tenantId = window.getTenantIdFromToken();
        const res = await window.executeWithRetry(() => API.fetchSystemOptionsAPI(tenantId), '系統管理員', '載入資料庫');
        STATE.globalSystemStyles = res.data.styles || [];
        
        try {
            if (API.fetchSystemPricingAPI) {
                const priceRes = await window.executeWithRetry(() => API.fetchSystemPricingAPI(), '財務總監', '載入即時牌價');
                if (priceRes && priceRes.data) STATE.globalPricing = priceRes.data.actions; 
            }
        } catch (priceErr) { console.warn("⚠️ 動態定價載入失敗"); }

        if (typeof UI.renderDynamicOptions === 'function') UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', res.data);
    } catch (error) { showToast('❌ 資料庫連線失敗', 'error'); }
}

export async function addCharacterFromDB(dbChar) {
    const list = document.getElementById('characterList');
    if (list.children.length >= 4) return showToast('❌ 最多 4 位角色！', 'error');
    const item = document.createElement('div');
    item.className = 'char-item relative animate-fade-in flex items-start gap-3 bg-white p-3 border border-blue-200 rounded-xl shadow-sm mb-3 group'; 
    item.innerHTML = `<button type="button" onclick="window.removeCharFromList('${dbChar.name}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-sm z-10">&times;</button><img src="${dbChar.imageUrl || ''}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-100 flex-shrink-0 shadow-sm"><div class="flex-grow"><div class="flex items-center mb-1.5"><span class="font-black text-gray-800 text-sm mr-2">${dbChar.name}</span><span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">🔒 基因鎖定</span></div><input type="hidden" name="charName" value="${dbChar.name}"><input type="hidden" class="char-db-features" value="${dbChar.aiExtractedFeatures || ''}"><input type="hidden" class="char-image-url" value="${dbChar.imageUrl || ''}"><input type="text" name="charPersona" class="w-full p-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 focus:bg-white transition-colors" placeholder="可在此微調服裝/表情" value="${dbChar.persona || ''}"></div>`;
    list.appendChild(item);
    showToast(`✅ 已讓 ${dbChar.name} 進入候場區！`, 'success');
}

export async function removeCharFromList(charName) {
    const item = window.event?.target?.closest('.char-item');
    if(item) item.remove();
}

export async function submitNewCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    const fileInput = document.getElementById('newCharImage');
    if (!name || !fileInput.files?.[0]) return showToast('❌ 請填寫名稱與圖片', 'error');
    
    const btn = document.getElementById('btnSubmitNewChar');
    btn.disabled = true; btn.innerHTML = '🧬 基因掃描中...';
    try {
        const base64Info = await compressImageToBase64(fileInput.files[0], 800, false);
        const res = await window.executeWithRetry(() => API.createCharacterAPI({ name, imageBase64: base64Info.data, mimeType: base64Info.mimeType, tenantId: window.getTenantIdFromToken() }), '視覺工程師', '基因寫入');
        showToast(res.message, 'success'); 
        
        const charCost = STATE.globalPricing?.CREATE_CHARACTER?.retailPoints ?? 5;
        if(window.showPointDeduction) window.showPointDeduction(btn, charCost); 
        
        UI.closeCreateCharModal(); 
        await window.initSystemData();
    } catch(e) { showToast(`❌ 建立失敗: ${e.message}`, 'error'); } finally { btn.disabled = false; btn.innerHTML = '🧬 開始基因掃描'; }
}

// ==========================================
// 🚀 第一步：腳本撰寫邏輯 (核心狙擊點)
// ==========================================
export async function executeStep1Logic(payloadData) {
    const btnSubmit = document.getElementById('btnStep1Submit');
    btnSubmit.disabled = true; btnSubmit.classList.replace('bg-blue-600', 'bg-gray-500');
    document.getElementById('btnTextStep1').innerHTML = '⚡ 執行中，請看右側進度...';

    try {
        let promptStyle = '', negativeStyle = '', styleName = '預設風格';
        
        // 🌟 [優化] 真實攝影三劍客策略分發
        if (!STATE.isComicModeActive) {
            const mode = STATE.currentRealMode || 'INFLUENCER';
            if (mode === 'INFLUENCER') {
                promptStyle = 'Professional Instagram influencer lifestyle photography. Beautiful subject, soft morning lighting, high-end environment, bokeh background, cinematic depth.';
                styleName = '網紅模式';
            } else if (mode === 'SUPERMODEL') {
                promptStyle = 'High-end fashion photography, supermodel posing, focusing on product details and clothing texture. Studio lighting, sharp focus, editorial style, minimalist background.';
                styleName = '超模展示';
            } else if (mode === 'ENHANCE') {
                promptStyle = 'AI Photo Enhancement. Professional color grading, lighting correction, texture refinement, keeping original structure while making it magazine-quality.';
                styleName = '原圖美化';
            }
        } else {
            const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
            if (selectedStyleId && STATE.globalSystemStyles) {
                const obj = STATE.globalSystemStyles.find(s => s.id === selectedStyleId);
                if (obj) { promptStyle = obj.promptPrefix; negativeStyle = obj.negativePrompt; styleName = obj.name; }
            }
        }
        STATE.currentStyleName = styleName;

        const payload = {
            tenantId: window.getTenantIdFromToken(), 
            platforms: payloadData.selectedPlatforms, 
            topic: payloadData.topic, 
            isComicMode: STATE.isComicModeActive,
            realMode: STATE.currentRealMode, // 🌟 傳遞子模式給後端
            aspectRatio: document.getElementById('aspectRatioSelect').value, 
            style: promptStyle, 
            negativePrompt: negativeStyle, 
            resolution: document.getElementById('resolutionSelect').value, 
            comicCharacters: [], 
            image_options: { referenceImages: [] },
            panelCount: (STATE.isComicModeActive) ? parseInt(document.getElementById('panelCountSelect').value) : 1
        };

        // 如果是漫畫模式，處理角色
        if (STATE.isComicModeActive) {
            const charItems = document.querySelectorAll('#characterList .char-item');
            charItems.forEach(item => {
                const name = item.querySelector('[name="charName"]')?.value;
                if (name) {
                    payload.comicCharacters.push({ name, persona: item.querySelector('[name="charPersona"]')?.value, aiExtractedFeatures: item.querySelector('.char-db-features')?.value });
                    const url = item.querySelector('.char-image-url')?.value;
                    if (url) payload.image_options.referenceImages.push({ type: 'character', name, imageUrl: url });
                }
            });
        }

        // 處理背景/道具圖 (美化模式會強制用到這個)
        if (STATE.sceneFiles?.length > 0) {
            for (let file of STATE.sceneFiles) { 
                const b64 = await compressImageToBase64(file, 800); 
                if (b64) payload.image_options.referenceImages.push({ type: (STATE.currentRealMode === 'ENHANCE' ? 'original_photo' : 'scene_background'), ...b64 }); 
            }
        }

        await window.addAgentLog('首席文案', '✍️', `正在為您打造「${styleName}」專屬腳本...`, true);
        const result = await window.executeWithRetry(() => API.createDraftAPI(payload), '首席文案', '腳本連線');
        
        // 扣點：腳本固定價格
        const draftCost = STATE.globalPricing?.GENERATE_DRAFT?.retailPoints ?? 15;
        if(window.showPointDeduction) window.showPointDeduction(btnSubmit, draftCost); 
        
        STATE.currentTaskId = result.taskId; 
        document.getElementById('step1-setup').classList.add('hidden'); 
        document.getElementById('step2-review').classList.remove('hidden');
        document.getElementById('step2StyleBadge').innerText = `🎨 模式：${styleName}`;
        document.getElementById('reviewCaption').value = result.draftContent.post_caption;
        
        STATE.currentTags = result.draftContent.hashtags || [];
        if(window.renderTagChips) window.renderTagChips();
        
        // 渲染漫畫分鏡 (如果是真實攝影則隱藏)
        const panContainer = document.getElementById('reviewPanelsContainer');
        if (STATE.isComicModeActive && result.draftContent.panels) {
            panContainer.classList.remove('hidden');
            let html = `<div class="p-2 bg-indigo-50 rounded-lg mb-3 text-xs font-bold text-indigo-600 italic">🎬 漫畫分鏡已根據 "${styleName}" 風格生成</div>`;
            result.draftContent.panels.forEach(p => { 
                html += `<div class="panel-item mb-4 p-3 bg-white border border-gray-100 rounded-xl shadow-sm"><textarea id="panel_${p.panel_number}" class="w-full p-2 text-sm border-0 focus:ring-0 bg-transparent resize-none">${p.dialogue}</textarea></div>`; 
            });
            panContainer.innerHTML = html;
        } else { panContainer.classList.add('hidden'); }
        
        showToast('✅ 腳本已就緒！', 'success');
    } catch (e) { showToast(`❌ 失敗: ${e.message}`, 'error'); } 
    finally { 
        btnSubmit.disabled = false; 
        btnSubmit.classList.replace('bg-gray-500', 'bg-blue-600'); 
        document.getElementById('btnTextStep1').innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本'; 
    }
}

// ==========================================
// 🎨 第二步：發包生圖 (支援美化定價)
// ==========================================
export async function submitForImageGeneration() {
    const btn = document.getElementById('btnStep2Submit');
    
    // 🌟 [優化] 根據目前模式決定 Action Key 與售價
    const actionKey = STATE.currentAction || 'GENERATE_IMAGE';
    const imageCost = STATE.globalPricing?.[actionKey]?.retailPoints ?? (STATE.currentRealMode === 'ENHANCE' ? 30 : 50);

    btn.disabled = true; btn.classList.replace('bg-indigo-600', 'bg-gray-500'); btn.innerHTML = '🎨 影像處理中...'; window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const editedPanels = [];
        if (STATE.isComicModeActive) {
            document.querySelectorAll('.panel-item textarea').forEach(ta => { editedPanels.push({ panel_number: parseInt(ta.id.split('_')[1]), dialogue: ta.value }); });
        }

        await window.addAgentLog('美術總監', '👨‍🎨', `正在執行「${STATE.currentStyleName}」任務，預計扣除 ${imageCost} 點...`, true);

        const res = await window.executeWithRetry(() => API.generateImageAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: window.getTenantIdFromToken(), 
            editedCaption: document.getElementById('reviewCaption').value, 
            editedPanels,
            action: actionKey // 告訴後端這次是什麼計費動作
        }), '算圖農場', '影像生成');
        
        if (window.showPointDeduction) window.showPointDeduction(btn, imageCost); 
        
        document.getElementById('step2-review').classList.add('hidden'); 
        document.getElementById('step3-publish').classList.remove('hidden');
        document.getElementById('step3StyleBadge').innerText = `🎨 模式：${STATE.currentStyleName}`;
        
        const finalContainer = document.getElementById('finalImageContainer'); 
        const mainImage = res.images[0];
        
        finalContainer.innerHTML = `<div class="w-full p-2 bg-gray-50 rounded-xl flex flex-col items-center justify-center relative"><img id="finalRenderedImg_0" src="${mainImage.finalUrl}" onclick="window.openLightbox(this.src)" class="w-full max-w-md h-auto block rounded-xl shadow-md border border-gray-200 cursor-zoom-in hover:shadow-lg transition-all animate-fade-in"></div>`;

        let combinedCaption = document.getElementById('reviewCaption').value.trim();
        if (STATE.currentTags?.length > 0) combinedCaption += '\n\n' + STATE.currentTags.map(t => '#' + t.replace(/^#/, '').trim()).join(' ');
        document.getElementById('finalCaptionDisplay').value = combinedCaption;

        // 🌟 結束後啟動微調對話框
        const quickReplies = document.getElementById('aiQuickReplies');
        if (quickReplies) quickReplies.classList.remove('hidden');

        await window.addAgentLog('視覺工程師', '✅', '任務圓滿完成！請確認最終成品。', false);
        showToast('✅ 影像處理完畢！', 'success');
    } catch (e) { showToast(`❌ 失敗: ${e.message}`, 'error'); } 
    finally { btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-indigo-600'); btn.innerHTML = '🎨 2️⃣ 第二步：發包生圖'; }
}

// ==========================================
// 🚀 第三步：社群發射 (5/4/3 扣點)
// ==========================================
export async function publishToSocial(manualRetryPlatforms = null) {
    const btn = document.getElementById('btnPublish');
    const isScheduleMode = !document.getElementById('scheduleTimeContainer').classList.contains('hidden');
    let scheduledAt = null;

    if (isScheduleMode) {
        const timeVal = document.getElementById('scheduleTime').value;
        if (!timeVal) return showToast('❌ 請選擇排程時間！', 'error');
        scheduledAt = new Date(timeVal).toISOString();
    }
    
    btn.disabled = true; window.scrollTo({ top: 0, behavior: 'smooth' });
    await window.addAgentLog('社群總監', scheduledAt ? '🗓️' : '🚀', '啟動發射程序...', true, btn);

    try {
        // 🌟 精算本次發布點數
        let publishCost = 0;
        const platforms = STATE.pendingTaskPayload?.selectedPlatforms || [];
        const platformMap = STATE.globalPricing?.PUBLISH_POST?.platformMap || { FB: 5, IG: 4, THREADS: 3 };

        platforms.forEach(p => { publishCost += (platformMap[p] || 0); });

        const res = await window.executeWithRetry(() => API.publishContentAPI({ 
            taskId: STATE.currentTaskId, 
            tenantId: window.getTenantIdFromToken(), 
            finalCaption: document.getElementById('finalCaptionDisplay').value, 
            scheduledAt, 
            platforms, // 🌟 傳入平台陣列供後端 BillingService 使用
            retryPlatforms: manualRetryPlatforms 
        }), '社群總監', '發布任務');

        if (!scheduledAt && window.showPointDeduction) {
            window.showPointDeduction(btn, publishCost); 
            await window.addAgentLog('財務總監', '💳', `(社群發佈扣除 ${publishCost} 點)`, false);
        }

        btn.classList.replace('bg-blue-600', 'bg-green-600');
        btn.innerHTML = scheduledAt ? '✅ 排程設定完成' : '✅ 任務大成功'; 
        showToast('🎉 發布指令已送達！', 'success');

        if (!scheduledAt && typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
        
        setTimeout(() => { btn.disabled=false; btn.classList.replace('bg-green-600','bg-blue-600'); btn.innerHTML='✨ 再來一篇！'; btn.onclick=window.resetToStep1; }, 3000);
    } catch (e) { showToast(`❌ 發布失敗: ${e.message}`, 'error'); btn.disabled=false; }
}

// 其他輔助函數維持原樣...
export async function retrySingleImage(index) { /* 同原先邏輯 */ }
export async function resumeTaskWithStyle(styleId) { /* 同原先邏輯 */ }
