// public/js/workflow.js
import { STATE } from './config.js';
import * as API from './api.js';
import * as UI from './ui.js';
import { showToast } from './utils.js';
import { compressImageToBase64 } from './image.js';

export async function setAppMode(mode) {
    STATE.isComicModeActive = (mode === 'manga');
    const styleSection = document.getElementById('style-selector-area'); 
    const charLibrary = document.getElementById('character-library-area');
    const photoOptions = document.getElementById('photo-mode-options');

    if (mode === 'photo') {
        if(styleSection) styleSection.classList.add('hidden');
        if(charLibrary) charLibrary.classList.add('hidden');
        if(photoOptions) photoOptions.classList.remove('hidden');
        await window.addAgentLog('美術總監', '📸', '已切換至「真實攝影模式」。請選擇您的拍攝主題：網美拍照 或 商品展示。');
    } else {
        if(styleSection) styleSection.classList.remove('hidden');
        if(charLibrary) charLibrary.classList.remove('hidden');
        if(photoOptions) photoOptions.classList.add('hidden');
        await window.addAgentLog('美術總監', '🎨', '已切換至「漫畫連載模式」。請挑選您喜愛的畫風！');
    }
}

export function backToStep1() { document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step1-setup').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
export function backToStep2() { document.getElementById('step3-publish').classList.add('hidden'); document.getElementById('step2-review').classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

export function resetToStep1() {
    document.getElementById('step3-publish').classList.add('hidden'); document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step1-setup').classList.remove('hidden');
    STATE.currentTaskId = null; STATE.multiImages = []; document.getElementById('agentForm').reset();
    document.getElementById('characterList').innerHTML = ''; document.getElementById('scenePreview').innerHTML = ''; document.getElementById('objectPreview').innerHTML = '';
    
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
        } catch (priceErr) { console.warn("⚠️ 動態定價載入失敗，將使用預設點數"); }

        if (typeof UI.renderDynamicOptions === 'function') UI.renderDynamicOptions(STATE.isComicModeActive ? 'ANIME' : 'REALISTIC', res.data);
    } catch (error) { showToast('❌ 資料庫連線失敗', 'error'); }
}

export async function addCharacterFromDB(dbChar) {
    const targetButton = window.LAST_CLICKED_EL;
    const list = document.getElementById('characterList');
    if (list.children.length >= 4) return showToast('❌ 最多 4 位角色！', 'error');
    const item = document.createElement('div');
    item.className = 'char-item relative animate-fade-in flex items-start gap-3 bg-white p-3 border border-blue-200 rounded-xl shadow-sm mb-3 group'; 
    item.innerHTML = `<button type="button" onclick="window.removeCharFromList('${dbChar.name}')" class="absolute -top-2 -right-2 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-sm z-10">&times;</button><img src="${dbChar.imageUrl || ''}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-100 flex-shrink-0 shadow-sm"><div class="flex-grow"><div class="flex items-center mb-1.5"><span class="font-black text-gray-800 text-sm mr-2">${dbChar.name}</span><span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center">🔒 基因鎖定</span></div><input type="hidden" name="charName" value="${dbChar.name}"><input type="hidden" class="char-db-features" value="${dbChar.aiExtractedFeatures || ''}"><input type="hidden" class="char-image-url" value="${dbChar.imageUrl || ''}"><input type="text" name="charPersona" class="w-full p-1.5 border border-gray-200 rounded-md text-xs bg-gray-50 focus:bg-white transition-colors" placeholder="可在此微調服裝/表情" value="${dbChar.persona || ''}"></div>`;
    list.appendChild(item);
    showToast(`✅ 已讓 ${dbChar.name} 進入候場區！`, 'success');
    if (typeof window.addAgentLog === 'function') await window.addAgentLog('視覺工程師', '👁️', `成功捕獲「${dbChar.name}」的視覺基因！`, false, targetButton);
}

export async function removeCharFromList(charName) {
    const targetButton = window.LAST_CLICKED_EL;
    const item = targetButton.closest('.char-item');
    await window.addAgentLog('視覺工程師', '👁️', `已釋放「${charName}」的視覺基因。`, false, targetButton);
    if(item) item.remove();
}

export async function submitNewCharacter() {
    const name = document.getElementById('newCharName').value.trim();
    const fileInput = document.getElementById('newCharImage');
    const targetButton = window.LAST_CLICKED_EL;
    if (!name || !fileInput.files?.[0]) return showToast('❌ 請填寫名稱與圖片', 'error');
    
    const btn = document.getElementById('btnSubmitNewChar');
    btn.disabled = true; btn.innerHTML = '🧬 基因掃描中...';
    try {
        const base64Info = await compressImageToBase64(fileInput.files[0], 800, false);
        const res = await window.executeWithRetry(() => API.createCharacterAPI({ name, imageBase64: base64Info.data, mimeType: base64Info.mimeType, tenantId: window.getTenantIdFromToken() }), '視覺工程師', '基因寫入');
        showToast(res.message, 'success'); 
        
        const charCost = STATE.globalPricing?.CREATE_CHARACTER?.retailPoints ?? 5;
        if(window.showPointDeduction) window.showPointDeduction(btn, charCost); 
        if (typeof window.addAgentLog === 'function') await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${charCost} 點)`, false, targetButton);
        
        UI.closeCreateCharModal(); 
        await window.initSystemData();
        if (typeof window.addAgentLog === 'function') await window.addAgentLog('視覺工程師', '🧬', `新角色「${name}」的基因已登錄雲端。`, false, targetButton);
    } catch(e) { showToast(`❌ 建立失敗: ${e.message}`, 'error'); } finally { btn.disabled = false; btn.innerHTML = '🧬 開始基因掃描'; }
}

export async function executeStep1Logic(payloadData) {
    const btnSubmit = document.getElementById('btnStep1Submit');
    const publishBtn = document.getElementById('btnPublish');
    if(publishBtn) { publishBtn.disabled = false; publishBtn.innerHTML = '🚀 立刻發射！'; }

    btnSubmit.disabled = true; btnSubmit.classList.replace('bg-blue-600', 'bg-gray-500');
    document.getElementById('btnTextStep1').innerHTML = '⚡ 執行中，請看右側進度...';

    try {
        let promptStyle = '', negativeStyle = '', styleName = '預設風格';
        
        if (!STATE.isComicModeActive) {
            const photoModeType = document.querySelector('input[name="photoMode"]:checked')?.value || 'BEAUTY';
            if (photoModeType === 'BEAUTY') { promptStyle = 'Instagram influencer photography style. Beautiful face, soft aesthetic lighting, shallow depth of field, stunning background.'; styleName = '網美拍照模式'; } 
            else { promptStyle = 'Commercial product photography. Studio lighting, crisp details, high-end presentation, minimalist background.'; styleName = '商品展示模式'; }
        } else {
            const selectedStyleId = document.querySelector('input[name="targetStyle"]:checked')?.value;
            if (selectedStyleId && STATE.globalSystemStyles) {
                const obj = STATE.globalSystemStyles.find(s => s.id === selectedStyleId);
                if (obj) { promptStyle = obj.promptPrefix; negativeStyle = obj.negativePrompt; styleName = obj.name; }
            }
        }
        STATE.currentStyleName = styleName;

        const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'COLOR';
        const panelCountEl = document.getElementById('panelCountSelect');
        const desiredPanelCount = (STATE.isComicModeActive && panelCountEl) ? parseInt(panelCountEl.value) : 1;
        const presentationMode = document.querySelector('input[name="presentationMode"]:checked')?.value || 'CLASSIC';

        const payload = {
            tenantId: window.getTenantIdFromToken(), platforms: payloadData.selectedPlatforms, topic: payloadData.topic, isComicMode: STATE.isComicModeActive, colorMode: colorMode, 
            aspectRatio: document.getElementById('aspectRatioSelect').value, style: promptStyle, negativePrompt: negativeStyle, resolution: document.getElementById('resolutionSelect').value, 
            comicCharacters: [], image_options: { referenceImages: [] }, panelCount: desiredPanelCount, presentationMode: presentationMode
        };

        if (STATE.isComicModeActive) {
            const charItems = document.querySelectorAll('#characterList .char-item');
            if (charItems.length > 0) await window.addAgentLog('視覺工程師', '👁️', `正在轉換 ${charItems.length} 位角色的 AI 基因參數...`, true);
            charItems.forEach(item => {
                const name = item.querySelector('[name="charName"]')?.value;
                if (name) {
                    payload.comicCharacters.push({ name, persona: item.querySelector('[name="charPersona"]')?.value, aiExtractedFeatures: item.querySelector('.char-db-features')?.value });
                    const url = item.querySelector('.char-image-url')?.value;
                    if (url) payload.image_options.referenceImages.push({ type: 'character', name, imageUrl: url });
                }
            });
        }

        if (STATE.sceneFiles && STATE.sceneFiles.length > 0) {
            await window.addAgentLog('影像處理組', '📐', `偵測到 ${STATE.sceneFiles.length} 張背景圖...`, true);
            for (let file of STATE.sceneFiles) { const b64 = await compressImageToBase64(file, 600, colorMode === 'BW'); if (b64) payload.image_options.referenceImages.push({ type: 'scene_background', ...b64 }); }
        }
        if (STATE.objectFiles && STATE.objectFiles.length > 0) {
            await window.addAgentLog('影像處理組', '🍔', `偵測到 ${STATE.objectFiles.length} 張道具圖...`, true);
            for (let file of STATE.objectFiles) { const b64 = await compressImageToBase64(file, 600, colorMode === 'BW'); if (b64) payload.image_options.referenceImages.push({ type: 'scene_object', ...b64 }); }
        }

        await window.addAgentLog('首席文案', '✍️', `正在與大腦連線，撰寫【${desiredPanelCount}格】腳本...`, true);
        const result = await window.executeWithRetry(() => API.createDraftAPI(payload), '首席文案', '腳本連線');
        
        const draftCost = STATE.globalPricing?.GENERATE_DRAFT?.retailPoints ?? 10;
        if(window.showPointDeduction) window.showPointDeduction(btnSubmit, draftCost); 
        await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${draftCost} 點)`, false);
        
        STATE.currentTaskId = result.taskId; 
        STATE.multiImages = [{ id: `cover_${Date.now()}`, originalUrl: '', processType: 'AI_SYNTHESIS' }];
        
        document.getElementById('step1-setup').classList.add('hidden'); document.getElementById('step2-review').classList.remove('hidden');
        document.getElementById('step2StyleBadge').innerText = `🎨 模式：${STATE.currentStyleName}`;
        document.getElementById('reviewCaption').value = result.draftContent.post_caption;
        
        STATE.currentTags = result.draftContent.hashtags || [];
        if(window.renderTagChips) window.renderTagChips();
        
        const panContainer = document.getElementById('reviewPanelsContainer');
        if (STATE.isComicModeActive && result.draftContent.panels) {
            panContainer.classList.remove('hidden');
            let html = `<div class="flex justify-between items-end mb-2"><label class="block text-sm font-bold text-gray-700">🎬 分鏡腳本確認</label><span class="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold shadow-sm">共 ${result.draftContent.panels.length} 格</span></div><div id="panelsWrapper">`;
            result.draftContent.panels.forEach(p => { html += `<div class="panel-item mb-4 p-4 bg-white rounded-xl shadow-sm transition-all" data-panel="${p.panel_number}"><p class="text-xs text-gray-500 font-bold mb-1">🎥 ${p.action_zh || p.action_en || '場景'}</p><textarea id="panel_${p.panel_number}" class="w-full p-2 bg-gray-50 border rounded-lg text-sm cursor-text focus:ring-2 focus:ring-indigo-300 transition-shadow">${p.dialogue}</textarea></div>`; });
            html += `</div>`; panContainer.innerHTML = html;
        } else { panContainer.classList.add('hidden'); }
        
        showToast('✅ 腳本生成完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
        await window.addAgentLog('專案總監', '⏸️', '腳本已就緒，請核對台詞，確認無誤後即可發包。');
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `發生錯誤: ${e.message}`); showToast(`❌ 錯誤: ${e.message}`, 'error'); } 
    finally { btnSubmit.disabled = false; btnSubmit.classList.replace('bg-gray-500', 'bg-blue-600'); document.getElementById('btnTextStep1').innerHTML = '⚡ 1️⃣ 第一步：AI 撰寫貼文腳本'; }
}

export async function submitForImageGeneration() {
    const btn = document.getElementById('btnStep2Submit');
    if (!STATE.multiImages?.length) return showToast('❌ 需要至少 1 張圖片！', 'error');

    const editedPanels = [];
    if (STATE.isComicModeActive) {
        document.querySelectorAll('.panel-item textarea').forEach(ta => { editedPanels.push({ panel_number: parseInt(ta.id.split('_')[1]), dialogue: ta.value }); });
    }

    btn.disabled = true; btn.classList.replace('bg-indigo-600', 'bg-gray-500'); btn.innerHTML = '🎨 執行中...'; window.scrollTo({ top: 0, behavior: 'smooth' });
    await window.addAgentLog('美術總監', '👨‍🎨', '收到發包指令！我們將為您生成極致的合成美圖...', true, btn);

    try {
        const imageCost = STATE.globalPricing?.GENERATE_IMAGE?.retailPoints ?? 20;
        await window.addAgentLog('算圖農場', '🤖', `極速渲染中，請稍候...`, true);

        const res = await window.executeWithRetry(() => API.generateImageAPI({ 
            taskId: STATE.currentTaskId, tenantId: window.getTenantIdFromToken(), editedCaption: document.getElementById('reviewCaption').value, editedPanels, 
            incomingImages: STATE.multiImages.map(img => ({ processType: img.processType, originalUrl: img.originalUrl })) 
        }), '算圖農場', '雲端算圖');
        
        if (window.showPointDeduction) window.showPointDeduction(btn, imageCost); 
        await window.addAgentLog('財務總監', '💳', `(AI算力扣除 ${imageCost} 點)`, false);
        
        document.getElementById('step2-review').classList.add('hidden'); document.getElementById('step3-publish').classList.remove('hidden');
        document.getElementById('step3StyleBadge').innerText = `🎨 模式：${STATE.currentStyleName}`;
        
        const finalContainer = document.getElementById('finalImageContainer'); finalContainer.className = 'w-full my-4'; 
        const mainAiImage = res.images.find(img => img.processType === 'AI_SYNTHESIS');
        
        if (mainAiImage && mainAiImage.qaStatus === 'ERROR') {
             await window.addAgentLog('視覺工程師', '👁️', `報告總編，偵測到文字模糊，已為您開啟修復通道！<br><button onclick="window.retrySingleImage(0)" class="mt-3 text-xs bg-red-100 hover:bg-red-500 hover:text-white text-red-600 font-bold border border-red-200 py-1.5 px-4 rounded-full transition-colors shadow-sm">✨ 免費 VIP 重抽</button>`, false);
        } else { await window.addAgentLog('視覺工程師', '✅', '視覺質檢通過！文字與畫風完美融合。', false); }

        finalContainer.innerHTML = `<div class="w-full p-2 bg-gray-50 rounded-xl flex flex-col items-center justify-center relative"><img id="finalRenderedImg_0" src="${res.images[0].finalUrl}" onclick="window.open(this.src, '_blank')" class="w-full max-w-md h-auto block rounded-xl shadow-md border border-gray-200 cursor-pointer hover:shadow-lg transition-all animate-fade-in">${mainAiImage && mainAiImage.qaStatus === 'ERROR' ? `<span class="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-md">文字需修復</span>` : ''}</div><p class="text-center text-[10px] text-gray-400 mt-2">💡 點擊放大檢視</p>`;

        let combinedCaption = document.getElementById('reviewCaption').value.trim();
        if (STATE.currentTags && STATE.currentTags.length > 0) combinedCaption += '\n\n' + STATE.currentTags.map(t => '#' + t.replace(/^#/, '').trim()).join(' ');
        document.getElementById('finalCaptionDisplay').value = combinedCaption;

        showToast('✅ 圖片處理完畢！', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `生圖失敗: ${e.message}`); showToast(`❌ 生圖失敗: ${e.message}`, 'error'); } 
    finally { btn.disabled = false; btn.classList.replace('bg-gray-500', 'bg-indigo-600'); btn.innerHTML = '🎨 2️⃣ 第二步：發包生圖'; }
}

export async function retrySingleImage(index) {
    const btn = window.event?.target;
    if(btn) { btn.disabled = true; btn.innerHTML = '⚙️ 系統重繪中...'; }
    await window.addAgentLog('視覺工程師', '⚙️', '收到！正在啟動免扣點通道為您重新繪製，請稍候...', true);

    try {
        const editedPanels = [];
        if (STATE.isComicModeActive) { document.querySelectorAll('.panel-item textarea').forEach(ta => { editedPanels.push({ panel_number: parseInt(ta.id.split('_')[1]), dialogue: ta.value }); }); }
        const res = await window.executeWithRetry(async () => { const r = await fetch('/api/content/regenerate-single', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: STATE.currentTaskId, tenantId: window.getTenantIdFromToken(), imageIndex: index, editedPanels }) }); return r.json(); }, '算圖農場', '免扣點修復');
        
        if (!res.success) throw new Error(res.message);
        const imgEl = document.getElementById(`finalRenderedImg_${index}`);
        if(imgEl) { imgEl.src = res.image.finalUrl; const badge = imgEl.parentElement.querySelector('.bg-red-500'); if(badge) badge.remove(); }
        if(btn) { btn.innerHTML = '✅ 修復完成'; btn.className = 'mt-3 text-xs bg-green-100 text-green-600 font-bold border border-green-200 py-1.5 px-4 rounded-full shadow-sm'; }
        if (res.image.qaStatus === 'ERROR') await window.addAgentLog('視覺工程師', '⚠️', `修復完畢，但文字還是不太對。您可以選擇再抽一次！<br><button onclick="window.retrySingleImage(${index})" class="mt-3 text-xs bg-red-100 hover:bg-red-500 hover:text-white text-red-600 font-bold border border-red-200 py-1.5 px-4 rounded-full transition-colors shadow-sm">🔄 再抽一次</button>`, false);
        else await window.addAgentLog('視覺工程師', '✨', '修復完美成功！', false);
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `修復失敗: ${e.message}`); if(btn) { btn.disabled = false; btn.innerHTML = '🔄 重新嘗試'; } }
}

export async function publishToSocial(manualRetryPlatforms = null) {
    const btn = document.getElementById('btnPublish');
    const scheduleTime = document.getElementById('scheduleTime').value;
    const scheduledAt = scheduleTime ? new Date(scheduleTime).toISOString() : null;
    
    btn.disabled = true; window.scrollTo({ top: 0, behavior: 'smooth' });
    await window.addAgentLog('社群總監', scheduledAt ? '🗓️' : '🚀', scheduledAt ? `排程任務寫入中...` : '啟動發射程序...', true, btn);

    let currentAttempt = 0, targetPlatforms = manualRetryPlatforms, finalFailedPlatforms = [];
    try {
        while (currentAttempt <= 1) {
            const res = await window.executeWithRetry(() => API.publishContentAPI({ taskId: STATE.currentTaskId, tenantId: window.getTenantIdFromToken(), finalCaption: document.getElementById('finalCaptionDisplay').value, scheduledAt, retryPlatforms: targetPlatforms }), '社群總監', '社群發射');
            if (res.failedPlatforms && res.failedPlatforms.length > 0) {
                if (currentAttempt < 1 && !scheduledAt) {
                    await window.addAgentLog('社群總監', '🔄', `偵測到 [${res.failedPlatforms.join(', ')}] 無回應。自動修復中...`, true);
                    currentAttempt++; targetPlatforms = res.failedPlatforms; await new Promise(r => setTimeout(r, 3000)); continue; 
                } else { finalFailedPlatforms = res.failedPlatforms; break; }
            } else break;
        }

        if (finalFailedPlatforms.length > 0) {
            await window.addAgentLog('社群總監', '⚠️', `發射失敗：[${finalFailedPlatforms.join(', ')}]。請檢查 Meta 授權。`, false);
            btn.innerHTML = '🔄 重試失敗平台'; btn.classList.replace('bg-gray-500', 'bg-yellow-500'); btn.disabled = false; btn.onclick = () => window.publishToSocial(finalFailedPlatforms);
            return showToast(`⚠️ 部分發布失敗，請重試！`, 'warning');
        }

        if(window.showPointDeduction) window.showPointDeduction(btn, STATE.globalPricing?.PUBLISH_POST?.retailPoints ?? 5); 
        await window.addAgentLog('系統管理員', '✅', scheduledAt ? '排程成功！' : '發送成功！', false);
        btn.innerHTML = scheduledAt ? '✅ 預約成功！' : '✅ 發布成功！'; btn.classList.replace('bg-green-600', 'bg-gray-500');
        showToast('🎉 任務大成功！', 'success');

        if (!scheduledAt && typeof confetti === 'function') { const d=2000, e=Date.now()+d; (function f() { confetti({particleCount:4,angle:60,spread:55,origin:{x:0}}); confetti({particleCount:4,angle:120,spread:55,origin:{x:1}}); if(Date.now()<e) requestAnimationFrame(f); }()); }
        setTimeout(() => { btn.disabled=false; btn.classList.replace('bg-gray-500','bg-blue-600'); btn.innerHTML='✨ 再來一篇！'; btn.onclick=window.resetToStep1; }, 2500);
    } catch (e) { await window.addAgentLog('系統警報', '🚨', `失敗: ${e.message}`); showToast(`❌ 失敗`, 'error'); btn.disabled=false; btn.innerHTML='🚀 重試'; btn.onclick=() => window.publishToSocial(targetPlatforms); }
}

export async function resumeTaskWithStyle(styleId) {
    const radio = document.querySelector(`input[name="targetStyle"][value="${styleId}"]`);
    if(radio) radio.checked = true;
    await window.addAgentLog('專案總監', '👨‍💼', `已補齊畫風。重啟管線...`, true);
    if (STATE.pendingTaskPayload) await executeStep1Logic(STATE.pendingTaskPayload);
}
