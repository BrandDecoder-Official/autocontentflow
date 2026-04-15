// js/v9_funnel.js
import { STATE } from './config.js'; 
import { APP_VERSION, MISSION, IS_EDIT_MODE, SYSTEM_DB, isMissionComplete, compressImage } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';
import { applyPointDeduction, validatePoints } from './v9_finance.js';
import { generateDraftAPI, generateImageFromDraftAPI, publishTaskAPI } from './api.js'; 

function decodeHTMLEntities(text) {
    if(!text) return '';
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

export async function startNewFunnel() { await triggerPersonaSkill(); }

async function triggerPersonaSkill() { 
    updateStepHeader("PERSONA SELECTION"); await addLog("專案總監", "🎭", "請指派本次任務的靈魂（品牌人設）：", true);
    let html = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`; 
    SYSTEM_DB.personas.forEach(p => { html += `<button class="persona-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.persona === p.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${p.name}"><span class="text-2xl mb-1">${p.icon}</span><span class="font-bold text-sm text-white">${p.name}</span><span class="text-[10px] text-slate-400">${p.desc}</span></button>`; }); 
    html += `</div>`;
    const ui = createSkillUI(html); 
    ui.querySelectorAll('.persona-btn').forEach(btn => { btn.onclick = async () => { MISSION.persona = btn.dataset.val; releaseUI(ui); await addLog("專案總監", "✅", `已掛載人設模組：<b>${MISSION.persona}</b>。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerPlatformSkill(); } }; });
}

async function triggerPlatformSkill() { 
    updateStepHeader("PLATFORM SELECTION"); await addLog("社群總監", "🚀", "請決定投遞平台：", true);
    const plats = [{ id: 'FB', name: 'Facebook', activeColor: 'bg-blue-600 border-blue-500 text-white' }, { id: 'IG', name: 'Instagram', activeColor: 'bg-gradient-to-r from-purple-600 to-pink-600 border-pink-500 text-white' }, { id: 'THREADS', name: 'Threads', activeColor: 'bg-black border-slate-500 text-white' }];
    let btnsHtml = ''; let tempPlats = [...MISSION.platforms];
    plats.forEach(p => { const isSelected = tempPlats.includes(p.id); const stateClass = isSelected ? p.activeColor : "bg-slate-800 border-white/10 text-slate-400"; btnsHtml += `<button class="plat-btn px-4 py-3 rounded-xl text-xs font-bold transition-all border ${stateClass}" data-val="${p.id}" data-active="${p.activeColor}" data-name="${p.name}">${isSelected ? p.name + ' ✓' : p.name}</button>`; });
    const ui = createSkillUI(`<div class="grid grid-cols-2 gap-2 sm:flex sm:gap-3">${btnsHtml}<button id="btnConfirmPlat" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg ml-auto active:scale-95 transition-all">確認鎖定</button></div>`);
    ui.querySelectorAll('.plat-btn').forEach(btn => { btn.onclick = () => { const val = btn.dataset.val; const activeClasses = btn.dataset.active.split(' '); if (tempPlats.includes(val)) { tempPlats = tempPlats.filter(p => p !== val); btn.classList.remove(...activeClasses); btn.classList.add('bg-slate-800', 'border-white/10', 'text-slate-400'); btn.innerText = btn.dataset.name; } else { tempPlats.push(val); btn.classList.remove('bg-slate-800', 'border-white/10', 'text-slate-400'); btn.classList.add(...activeClasses); btn.innerText = `${btn.dataset.name} ✓`; } }; });
    ui.querySelector('#btnConfirmPlat').onclick = async () => { if (tempPlats.length === 0) return showError('請至少選擇一個平台！'); MISSION.platforms = tempPlats; releaseUI(ui); await addLog("社群總監", "✅", `已鎖定平台：${MISSION.platforms.join(' / ')}。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerTopicSkill(); } };
}

async function triggerTopicSkill() { 
    updateStepHeader("TOPIC CAPTURE"); await addLog("專案總監", "📝", "請在下方填寫本次貼文的主題與要求：", true);
    const strategyPanelHTML = `<div class="mt-4 p-5 bg-slate-800/80 border border-indigo-500/30 rounded-2xl shadow-inner text-left animate-fade-in"><h4 class="text-xs font-black text-indigo-300 mb-3 flex items-center gap-2"><span>🎯</span> 單次發文戰術配置</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label class="block text-[10px] font-bold text-slate-400 mb-1">開場勾子 (Hook)</label><select id="selHookType" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"><option value="痛點提問" ${MISSION.hookType === '痛點提問' ? 'selected' : ''}>❓ 痛點提問</option><option value="反直覺爆點" ${MISSION.hookType === '反直覺爆點' ? 'selected' : ''}>💥 反直覺爆點</option><option value="利益誘惑" ${MISSION.hookType === '利益誘惑' ? 'selected' : ''}>🎁 利益誘惑</option><option value="爭議站隊" ${MISSION.hookType === '爭議站隊' ? 'selected' : ''}>⚔️ 爭議站隊</option></select></div><div><label class="block text-[10px] font-bold text-slate-400 mb-1">文案長度節奏</label><select id="selLength" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"><option value="短平快 (約150字)" ${MISSION.contentLength === '短平快 (約150字)' ? 'selected' : ''}>⚡ 短平快 (IG/Threads)</option><option value="深度文 (約300字)" ${MISSION.contentLength === '深度文 (約300字)' ? 'selected' : ''}>📖 深度文 (FB/Blog)</option></select></div></div></div>`;
    const ui = createSkillUI(`<div class="flex flex-col gap-3"><textarea id="inlineTopicInput" class="w-full bg-slate-900 border border-blue-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px] resize-y" placeholder="請描述您的產品、活動或想表達的情境...">${decodeHTMLEntities(MISSION.topic)}</textarea>${strategyPanelHTML}<div class="flex justify-end mt-2"><button id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">確認鎖定主題與戰術</button></div></div>`);
    const inputEl = ui.querySelector('#inlineTopicInput'); setTimeout(() => { inputEl.focus(); }, 100);
    ui.querySelector('#btnConfirmTopic').onclick = async () => { const val = inputEl.value.trim(); if(!val) return showError('主題不能為空！'); MISSION.topic = val; MISSION.hookType = ui.querySelector('#selHookType').value; MISSION.contentLength = ui.querySelector('#selLength').value; inputEl.disabled = true; inputEl.classList.add('opacity-50', 'bg-slate-800'); ui.querySelector('#btnConfirmTopic').classList.add('hidden'); releaseUI(ui); await addLog("總編指令", "🗣️", `鎖定主題：${val}<br><span class="text-[10px] text-indigo-400">📝 戰術配置：${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]}</span>`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerUniverseSkill(); } };
}

async function triggerUniverseSkill() { 
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const ui = createSkillUI(`<div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC"><span class="text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC"><span class="text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-yellow-500 hover:bg-yellow-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'ENHANCE' ? 'border-yellow-500 bg-yellow-600/20' : 'bg-slate-800'}" data-val="ENHANCE"><span class="text-3xl">✨</span><span class="font-black text-xs text-white">無損美化</span></button></div>`);
    ui.querySelectorAll('.uni-btn').forEach(btn => { btn.onclick = async () => { const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val; if (oldUni !== MISSION.universe) { MISSION.style = ''; MISSION.colorMode = ''; MISSION.characters = []; MISSION.sceneFiles = []; MISSION.ratio = MISSION.universe === 'ENHANCE' ? '原圖比例' : '9:16'; } releaseUI(ui); await addLog("美術總監", "✅", `宇宙鎖定：${MISSION.universe}。`); await triggerStyleSkill(); }; });
}

async function triggerStyleSkill() { 
    updateStepHeader("STYLE SELECTION"); const availableStyles = SYSTEM_DB.styles.length > 0 ? SYSTEM_DB.styles : [{id: 'MANGA_BW', name: '預設風格'}];
    let html = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">`; availableStyles.forEach(s => { html += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.name}"><span class="text-xl">${s.icon || '🎨'}</span><span class="font-bold text-xs text-white">${s.name}</span></button>`; }); html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.style-btn').forEach(btn => { btn.onclick = async () => { MISSION.style = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `風格鎖定：${MISSION.style}。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerColorSkill(); } }; });
}

async function triggerColorSkill() { 
    updateStepHeader("COLOR MODE"); await addLog("美術總監", "🎨", "請決定漫畫色系：", true);
    const ui = createSkillUI(`<div class="grid grid-cols-2 gap-3 mb-4"><button class="color-btn p-4 rounded-xl border border-white/10 hover:border-slate-400 hover:bg-white/5 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'BW' ? 'border-blue-500 bg-white/5' : ''}" data-val="BW"><span class="text-3xl mb-1">🏁</span><span class="font-bold text-xs text-white">經典黑白</span><span class="text-[9px] text-slate-400">懷舊網點質感</span></button><button class="color-btn p-4 rounded-xl border border-white/10 hover:border-pink-400 hover:bg-pink-600/10 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'Color' ? 'border-pink-500 bg-pink-600/10' : ''}" data-val="Color"><span class="text-3xl mb-1">🌈</span><span class="font-bold text-xs text-white">現代全彩</span><span class="text-[9px] text-slate-400">飽滿現代動漫感</span></button></div>`);
    ui.querySelectorAll('.color-btn').forEach(btn => { btn.onclick = async () => { MISSION.colorMode = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `色系已鎖定：<b>${MISSION.colorMode === 'BW' ? "黑白漫畫" : "全彩動漫"}</b>。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else if (MISSION.universe === 'ENHANCE') { await triggerVisualSkill(); } else { await triggerCharacterSkill(); } }; });
}

async function triggerCharacterSkill() { 
    updateStepHeader("CHARACTER SUMMON"); await addLog("視覺工程師", "🧬", `請勾選要在本次任務中登場的角色 (最多4位)：`, true);
    const available = SYSTEM_DB.characters.filter(c => c.type === MISSION.universe);
    if(available.length === 0) { const ui = createSkillUI(`<div class="text-center p-4"><p class="text-slate-400 text-xs mb-4">您的基因庫目前沒有角色，將採用純場景模式。</p><button id="btnSkipChar" class="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-bold active:scale-95 shadow-lg">⏭️ 確認並繼續</button></div>`); ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } }; return; }
    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">`; let tempSelected = [...MISSION.characters];
    available.forEach(char => { const isSelected = tempSelected.includes(char.name); html += `<div class="char-select-card flex flex-col items-center gap-2 cursor-pointer transition-all p-3 rounded-xl bg-slate-800 relative ${isSelected ? 'border-2 border-blue-500 bg-blue-900/30' : 'border border-white/10 hover:border-slate-500'}" data-name="${char.name}"><div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700 pointer-events-none"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-xs font-bold text-slate-200 pointer-events-none">${char.name}</span>${isSelected ? '<div class="absolute top-2 right-2 text-blue-400 font-black">✓</div>' : ''}</div>`; });
    html += `</div><div class="flex gap-2"><button id="btnSkipChar" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all border border-white/10 hover:bg-slate-700">⏭️ 不召喚</button><button id="btnConfirmChar" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認召喚</button></div>`;
    const ui = createSkillUI(html);
    ui.querySelectorAll('.char-select-card').forEach(card => { card.onclick = () => { const name = card.dataset.name; if (tempSelected.includes(name)) { tempSelected = tempSelected.filter(n => n !== name); card.classList.remove('border-2', 'border-blue-500', 'bg-blue-900/30'); card.classList.add('border', 'border-white/10'); const check = card.querySelector('.absolute'); if(check) check.remove(); } else { if (tempSelected.length >= 4) return showError('最多 4 位。'); tempSelected.push(name); card.classList.remove('border', 'border-white/10'); card.classList.add('border-2', 'border-blue-500', 'bg-blue-900/30'); card.innerHTML += '<div class="absolute top-2 right-2 text-blue-400 font-black">✓</div>'; } }; });
    ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
    ui.querySelector('#btnConfirmChar').onclick = async () => { MISSION.characters = tempSelected; releaseUI(ui); await addLog("視覺工程師", "✅", MISSION.characters.length > 0 ? `已鎖定角色：<b>${MISSION.characters.join('、')}</b>。` : "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
}

async function triggerVisualSkill() { 
    updateStepHeader("VISUAL CONFIG"); const isEnhance = MISSION.universe === 'ENHANCE'; const isComic = MISSION.universe === 'COMIC';
    await addLog("美術總監", "👨‍🎨", isEnhance ? "美化模式：請上傳原圖。" : "請確認畫面參數：", true);
    let currentRatio = MISSION.ratio; let currentRes = MISSION.resolution; let currentPanelCount = MISSION.panelCount || 4;
    const panelHtml = isComic ? `<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">🖼️ 漫畫格數</label><div class="grid grid-cols-4 gap-2"><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1">1格</button><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2">2格</button><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="3">3格</button><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4">4格</button></div></div>` : '';
    const ui = createSkillUI(`<div class="space-y-4 lg:space-y-6 flex flex-col relative mb-4"><div class="bg-blue-600/10 p-4 lg:p-5 rounded-2xl border border-blue-500/30"><div class="grid grid-cols-2 gap-3"><button ${isEnhance ? 'disabled' : `id="btnEditRatio"`} class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95 ${isEnhance ? 'opacity-50' : ''}"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white tag-ratio">${currentRatio}</span></button><button id="btnEditRes" class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white tag-res">${currentRes}</span></button></div></div><div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">${isEnhance ? '' : `<div class="space-y-3"><label class="text-[10px] text-slate-500 font-black">📐 比例</label><div class="grid grid-cols-3 gap-2"><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="9:16">9:16</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="16:9">16:9</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1:1">1:1</button></div></div>`}<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">✨ 解析度</label><div class="grid grid-cols-3 gap-2"><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1K">1K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2K">2K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4K">4K</button></div></div>${panelHtml}</div><button id="btnUploadScene" class="w-full bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 hover:border-slate-500 active:scale-95 transition-all"><span class="text-lg">📸</span> 點此上傳場景圖 (選填)</button><div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div><button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 lg:py-5 rounded-xl font-black text-sm shadow-lg mt-auto active:scale-[0.98]">✅ 鎖定參數</button></div>`);
    const openPanel = () => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    if(ui.querySelector('#btnEditRatio')) ui.querySelector('#btnEditRatio').onclick = openPanel;
    if(ui.querySelector('#btnEditRes')) ui.querySelector('#btnEditRes').onclick = openPanel;
    if (!isEnhance) { ui.querySelectorAll('.ratio-btn').forEach(btn => { if(btn.dataset.val === currentRatio) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRatio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = currentRatio; }; }); }
    ui.querySelectorAll('.res-btn').forEach(btn => { if(btn.dataset.val === currentRes) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRes = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = currentRes; }; });
    if (isComic) { ui.querySelectorAll('.panel-btn').forEach(btn => { if(parseInt(btn.dataset.val) === currentPanelCount) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentPanelCount = parseInt(btn.dataset.val); ui.querySelectorAll('.panel-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); }; }); }
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.onchange = async (e) => { if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea')); }; i.click(); };
    ui.querySelector('#btnAcceptVisual').onclick = async () => { MISSION.ratio = currentRatio; MISSION.resolution = currentRes; MISSION.panelCount = currentPanelCount; if (!isMissionComplete()) return showError('請完成設定！'); releaseUI(ui); await addLog("美術總監", "✅", `畫面參數鎖定：<b>${MISSION.ratio} / ${isComic ? currentPanelCount+'格' : ''}</b>。`); await triggerScheduleSkill(); };
}

async function handleAssetUpload(file, container) { 
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); 
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in'; 
    const dataUrl = await compressImage(file, 800); MISSION.sceneFiles = [{ dataUrl: dataUrl }]; 
    panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 參考素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `已優化並載入圖資。`); 
}

async function triggerScheduleSkill() { 
    updateStepHeader("PUBLISH SCHEDULE"); await addLog("社群總監", "📅", "最後一步，請指派部署時間（留空為立即發佈）：", true);
    const ui = createSkillUI(`<div class="flex flex-col gap-3 mb-4"><div class="grid grid-cols-2 gap-3 relative"><input type="text" id="datePicker" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="📅 選擇日期 (選填)"><div class="relative w-full" id="timePickerWrapper"><input type="time" id="timePickerInput" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="⏰ 選擇時間 (選填)"></div></div><button id="btnConfirmSchedule" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">確認時間</button></div>`);
    const fpConfig = { dateFormat: "Y-m-d", minDate: "today", time_24hr: true, defaultDate: MISSION.scheduledAt ? new Date(MISSION.scheduledAt) : null };
    if (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.zh) { fpConfig.locale = "zh"; }
    const fp = typeof flatpickr !== 'undefined' ? flatpickr("#datePicker", fpConfig) : null;
    const timeWrapper = ui.querySelector('#timePickerWrapper');
    timeWrapper.innerHTML += `<button id="btnClearTime" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors z-10">清除</button>`;
    ui.querySelector('#btnClearTime').onclick = (e) => { e.preventDefault(); ui.querySelector('#timePickerInput').value = ""; if(fp) fp.clear(); ui.querySelector('#datePicker').value = ""; };
    ui.querySelector('#btnConfirmSchedule').onclick = async () => {
        const dateStr = fp ? fp.input.value : ui.querySelector('#datePicker').value; const timeStr = ui.querySelector('#timePickerInput').value; if(fp) fp.destroy(); 
        if (dateStr && timeStr) { const dtStr = `${dateStr}T${timeStr}:00+08:00`; const schDate = new Date(dtStr); if (schDate < new Date()) { showError("部署時間不能小於當前時間！"); await triggerScheduleSkill(); return; } MISSION.scheduledAt = schDate.toISOString(); releaseUI(ui); const displaySch = schDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); await addLog("社群總監", "✅", `部署時間已寫入排程：<b>${displaySch}</b>。`); } 
        else { MISSION.scheduledAt = null; releaseUI(ui); await addLog("社群總監", "⚡", `已選擇<b>「立即部署」</b>模式。`); }
        await triggerMissionSummary();
    };
}

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

export async function triggerMissionSummary() {
    updateStepHeader("MISSION CONTROL");
    await addLog("專案總監", "📋", "總編，這是目前的任務總表。您可以點擊各項進行微調，或透過對話讓 Agent 協助您。", true);

    const isComic = MISSION.universe === 'COMIC';
    const isEnhance = MISSION.universe === 'ENHANCE';
    const decodedTopic = decodeHTMLEntities(MISSION.topic);

    let charsHtml = '';
    if(MISSION.characters.length > 0) {
        charsHtml = '<div class="flex items-center gap-2 flex-wrap">';
        MISSION.characters.forEach(c => {
            const o = SYSTEM_DB.characters.find(mc => mc.name === c);
            if(o && o.imageUrl) charsHtml += `<img src="${o.imageUrl}" class="w-8 h-8 rounded-full border border-indigo-500 flex-shrink-0" title="${c}">`;
            else charsHtml += `<span class="text-[10px] bg-indigo-900/50 text-indigo-200 px-2 py-1 rounded border border-indigo-500/50">${c}</span>`;
        });
        charsHtml += '</div>';
    } else {
        charsHtml = `<span class="text-xs text-slate-500">純場景模式</span>`;
    }

    const stylePrefix = isEnhance ? 'REALISTIC' : MISSION.universe;
    const availableStyles = SYSTEM_DB.styles.filter(s => s.type === stylePrefix);

    const ui = createSkillUI(`
        <div id="missionDashboard" class="bg-slate-900 border border-indigo-500/30 rounded-3xl p-4 lg:p-6 shadow-2xl space-y-4 mb-4 animate-fade-in text-[11px] lg:text-xs">
            
            <div class="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl flex items-start gap-3">
                <span class="text-xl">🤖</span>
                <p id="agentDashboardAdvice" class="text-indigo-300 italic leading-relaxed">
                    「目前人設為【${MISSION.persona}】，我已準備好最佳配置。點擊下方選項可即時微調內容。」
                </p>
            </div>

            <div class="space-y-2">
                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-topic">
                        <span class="text-slate-400 font-bold">📝 任務主題</span>
                        <span class="text-white font-black dash-val-topic truncate max-w-[200px] text-right">${decodedTopic} ✎</span>
                    </button>
                    <div id="dash-topic" class="hidden p-4 bg-black/20 space-y-3 border-t border-white/5">
                        <p class="text-[10px] text-slate-400 mb-1">請在此編輯完整主題或補充細節：</p>
                        <textarea id="editDashTopic" class="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-xs text-white focus:border-indigo-500 outline-none h-32 resize-y">${decodedTopic}</textarea>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-strategy">
                        <span class="text-slate-400 font-bold">🎯 發文戰術</span>
                        <span class="text-white font-black dash-val-strategy">${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]} ✎</span>
                    </button>
                    <div id="dash-strategy" class="hidden p-4 bg-black/20 grid grid-cols-2 gap-3 border-t border-white/5">
                        <div class="space-y-1">
                            <label class="text-[10px] text-slate-500">開場勾子</label>
                            <select id="editDashHook" class="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
                                <option value="痛點提問" ${MISSION.hookType==='痛點提問'?'selected':''}>❓ 痛點提問</option>
                                <option value="反直覺爆點" ${MISSION.hookType==='反直覺爆點'?'selected':''}>💥 反直覺爆點</option>
                                <option value="利益誘惑" ${MISSION.hookType==='利益誘惑'?'selected':''}>🎁 利益誘惑</option>
                                <option value="爭議站隊" ${MISSION.hookType==='爭議站隊'?'selected':''}>⚔️ 爭議站隊</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] text-slate-500">文案節奏</label>
                            <select id="editDashLen" class="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none">
                                <option value="短平快 (約150字)" ${MISSION.contentLength.includes('短平快')?'selected':''}>⚡ 短平快 (IG/Threads)</option>
                                <option value="深度文 (約300字)" ${MISSION.contentLength.includes('深度文')?'selected':''}>📖 深度文 (FB/Blog)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-team">
                        <span class="text-slate-400 font-bold">🎭 人設與平台</span>
                        <span class="text-white font-black dash-val-team text-right">${MISSION.persona} / ${MISSION.platforms.join(',')} ✎</span>
                    </button>
                    <div id="dash-team" class="hidden p-4 bg-black/20 space-y-4 border-t border-white/5">
                        <div class="space-y-2">
                            <label class="text-[10px] text-slate-500">指派人設角色</label>
                            <div class="flex flex-wrap gap-2">
                                ${SYSTEM_DB.personas.map(p => `<button class="btn-dash-persona px-3 py-2 rounded-lg border ${MISSION.persona===p.name?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${p.name}">${p.icon} ${p.name}</button>`).join('')}
                            </div>
                        </div>
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">部署社群平台 (可多選)</label>
                            <div class="flex flex-wrap gap-2">
                                ${['FB','IG','THREADS'].map(plat => `<button class="btn-dash-plat px-3 py-2 rounded-lg border ${MISSION.platforms.includes(plat)?'border-blue-500 bg-blue-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${plat}">${plat}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-characters">
                        <span class="text-slate-400 font-bold">👥 登場角色基因</span>
                        <div class="flex items-center gap-2 max-w-[150px] overflow-hidden dash-val-characters">${charsHtml} ✎</div>
                    </button>
                    <div id="dash-characters" class="hidden p-4 bg-black/20 space-y-3 border-t border-white/5">
                        <div class="dash-val-characters-list">${charsHtml}</div>
                        <p class="text-[10px] text-slate-400 pt-2 border-t border-white/5">若需更換登場角色，請對 Agent 說「我想更換角色」，或點擊下方重啟召喚儀式。</p>
                        <button id="btnBackToChar" class="bg-slate-800 border border-white/10 text-slate-200 px-4 py-2 rounded-lg text-xs active:scale-95 transition-all">✎ 重啟召喚儀式</button>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-universe-style">
                        <span class="text-slate-400 font-bold">🌌 風格宇宙與色系</span>
                        <span class="text-white font-black dash-val-universe-style text-right">${MISSION.universe} / ${MISSION.style} / ${MISSION.colorMode==='BW'?'黑白':'彩色'} ✎</span>
                    </button>
                    <div id="dash-universe-style" class="hidden p-4 bg-black/20 space-y-4 border-t border-white/5">
                        <div class="space-y-2">
                            <label class="text-[10px] text-slate-500">宇宙類型</label>
                            <div class="grid grid-cols-3 gap-2">
                                ${[{v:'REALISTIC',i:'📷',n:'攝影'},{v:'COMIC',i:'🎨',n:'動漫'},{v:'ENHANCE',i:'✨',n:'美化'}].map(u => `<button class="btn-dash-uni py-2 rounded-lg border ${MISSION.universe===u.v?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${u.v}">${u.i} ${u.n}</button>`).join('')}
                            </div>
                        </div>
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">視覺風格</label>
                            <div class="flex flex-wrap gap-2">
                                ${availableStyles.map(s => `<button class="btn-dash-style px-3 py-2 rounded-lg border ${MISSION.style===s.name?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${s.name}">${s.name}</button>`).join('')}
                            </div>
                        </div>
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">色系模式</label>
                            <div class="grid grid-cols-2 gap-2">
                                ${[{v:'BW',i:'🏁',n:'黑白'},{v:'Color',i:'🌈',n:'彩色'}].map(c => `<button class="btn-dash-color py-2 rounded-lg border ${MISSION.colorMode===c.v?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${c.v}">${c.i} ${c.n}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dashboard-item border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                    <button class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-all accordion-trigger" data-target="dash-visual-specs">
                        <span class="text-slate-400 font-bold">📐 畫面規格</span>
                        <span class="text-white font-black dash-val-visual-specs">${MISSION.ratio} / ${isComic ? MISSION.panelCount + '格' : ''} ✎</span>
                    </button>
                    <div id="dash-visual-specs" class="hidden p-4 bg-black/20 space-y-4 border-t border-white/5">
                        ${!isEnhance ? `
                        <div class="space-y-2">
                            <label class="text-[10px] text-slate-500">漫畫格數</label>
                            <div class="grid grid-cols-4 gap-2">
                                ${[1,2,3,4].map(n => `<button class="btn-dash-panel py-2 rounded-lg border ${MISSION.panelCount===n?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${n}">${n}格</button>`).join('')}
                            </div>
                        </div>` : ''}
                        <div class="space-y-2 pt-3 border-t border-white/5">
                            <label class="text-[10px] text-slate-500">畫面比例</label>
                            <div class="grid grid-cols-3 gap-2">
                                ${['9:16','16:9','1:1'].map(r => `<button class="btn-dash-ratio py-2 rounded-lg border ${MISSION.ratio===r?'border-indigo-500 bg-indigo-500/20 text-white':'border-white/10 text-slate-400'}" data-val="${r}">${r}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button id="btnRender" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95 transition-all">
                ⚡ 鎖定配置並產出校稿卡
            </button>
        </div>
    `);

    // --- 🔧 修復：手風琴開關邏輯 (展開時徹底隱藏右上角的預覽 span) ---
    ui.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.onclick = () => {
            const targetId = trigger.dataset.target;
            const targetEl = ui.querySelector(`#${targetId}`);
            const isHidden = targetEl.classList.contains('hidden');
            
            // 先關閉所有區塊，並把所有隱藏的 preview 顯示回來
            ui.querySelectorAll('.dashboard-item > div:not(.hidden)').forEach(el => el.classList.add('hidden'));
            ui.querySelectorAll('.accordion-trigger > span:nth-child(2)').forEach(span => span.style.display = 'block');

            if (isHidden) {
                targetEl.classList.remove('hidden');
                // 將點擊展開的這一個預覽文字徹底隱藏，不佔空間
                trigger.querySelector('span:nth-child(2)').style.display = 'none';
            }
        };
    });

    const updateDashDisplay = () => {
        ui.querySelector('.dash-val-topic').innerText = decodeHTMLEntities(MISSION.topic) + ' ✎';
        ui.querySelector('.dash-val-strategy').innerText = `${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]} ✎`;
        ui.querySelector('.dash-val-team').innerText = `${MISSION.persona} / ${MISSION.platforms.join(',')} ✎`;
        const isComicNow = MISSION.universe === 'COMIC';
        ui.querySelector('.dash-val-universe-style').innerText = `${MISSION.universe} / ${MISSION.style} / ${MISSION.colorMode==='BW'?'黑白':'彩色'} ✎`;
        ui.querySelector('.dash-val-visual-specs').innerText = `${MISSION.ratio} / ${isComicNow ? MISSION.panelCount + '格' : ''} ✎`;
    };

    ui.querySelector('#editDashTopic').oninput = (e) => { MISSION.topic = e.target.value; updateDashDisplay(); };
    ui.querySelector('#editDashHook').onchange = (e) => { MISSION.hookType = e.target.value; updateDashDisplay(); };
    ui.querySelector('#editDashLen').onchange = (e) => { MISSION.contentLength = e.target.value; updateDashDisplay(); };

    ui.querySelectorAll('.btn-dash-persona').forEach(btn => {
        btn.onclick = () => {
            MISSION.persona = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-persona').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-persona').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    ui.querySelectorAll('.btn-dash-plat').forEach(btn => {
        btn.onclick = () => {
            const p = btn.dataset.val;
            if (MISSION.platforms.includes(p)) {
                if (MISSION.platforms.length > 1) MISSION.platforms = MISSION.platforms.filter(x => x!==p);
            } else { MISSION.platforms.push(p); }
            btn.classList.toggle('border-blue-500'); btn.classList.toggle('bg-blue-500/20'); btn.classList.toggle('text-white'); btn.classList.toggle('border-white/10'); btn.classList.toggle('text-slate-400');
            updateDashDisplay();
        };
    });

    ui.querySelector('#btnBackToChar').onclick = async () => { IS_EDIT_MODE.value = true; releaseUI(ui); await triggerCharacterSkill(); };

    ui.querySelectorAll('.btn-dash-uni').forEach(btn => {
        btn.onclick = async () => {
            const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val;
            if (oldUni !== MISSION.universe) {
                MISSION.style = ''; MISSION.colorMode = ''; MISSION.characters = []; MISSION.sceneFiles = [];
            }
            releaseUI(ui); await triggerMissionSummary(); 
        };
    });

    ui.querySelectorAll('.btn-dash-style').forEach(btn => {
        btn.onclick = () => {
            MISSION.style = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-style').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-style').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    ui.querySelectorAll('.btn-dash-color').forEach(btn => {
        btn.onclick = () => {
            MISSION.colorMode = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-color').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-color').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    if (!isEnhance && isComic) {
        ui.querySelectorAll('.btn-dash-panel').forEach(btn => {
            btn.onclick = () => {
                MISSION.panelCount = parseInt(btn.dataset.val);
                ui.querySelectorAll('.btn-dash-panel').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
                ui.querySelectorAll('.btn-dash-panel').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
                btn.classList.remove('border-white/10', 'text-slate-400');
                btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
                updateDashDisplay();
            };
        });
    }

    ui.querySelectorAll('.btn-dash-ratio').forEach(btn => {
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val;
            ui.querySelectorAll('.btn-dash-ratio').forEach(b => b.classList.add('border-white/10', 'text-slate-400'));
            ui.querySelectorAll('.btn-dash-ratio').forEach(b => b.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white'));
            btn.classList.remove('border-white/10', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
            updateDashDisplay();
        };
    });

    ui.querySelector('#btnRender').onclick = async () => {
        await window.FunnelActions.generateDraft();
    };

    window.refreshMissionDashboard = () => {
        updateDashDisplay();
        ui.querySelector('#agentDashboardAdvice').innerHTML = `「已根據指示更新參數。總編確認沒問題後，即可發包。」`;
        
        ui.querySelectorAll('button[data-val]').forEach(btn => {
            const val = btn.dataset.val;
            let isActive = false;
            
            if (btn.classList.contains('btn-dash-plat')) {
                isActive = MISSION.platforms.includes(val);
                if (isActive) {
                    btn.classList.add('border-blue-500', 'bg-blue-500/20', 'text-white');
                    btn.classList.remove('border-white/10', 'text-slate-400');
                } else {
                    btn.classList.remove('border-blue-500', 'bg-blue-500/20', 'text-white');
                    btn.classList.add('border-white/10', 'text-slate-400');
                }
                return; 
            }

            if (btn.classList.contains('btn-dash-persona')) isActive = (val === MISSION.persona);
            else if (btn.classList.contains('btn-dash-uni')) isActive = (val === MISSION.universe);
            else if (btn.classList.contains('btn-dash-style')) isActive = (val === MISSION.style);
            else if (btn.classList.contains('btn-dash-color')) isActive = (val === MISSION.colorMode);
            else if (btn.classList.contains('btn-dash-panel')) isActive = (parseInt(val) === MISSION.panelCount);
            else if (btn.classList.contains('btn-dash-ratio')) isActive = (val === MISSION.ratio);

            if (isActive) {
                btn.classList.add('border-indigo-500', 'bg-indigo-500/20', 'text-white');
                btn.classList.remove('border-white/10', 'text-slate-400');
            } else {
                btn.classList.remove('border-indigo-500', 'bg-indigo-500/20', 'text-white');
                btn.classList.add('border-white/10', 'text-slate-400');
            }
        });
    };
}

// ==========================================
// 🎨 卡片渲染器 (負責草稿與 Hashtag 拖曳)
// ==========================================
export async function renderDraftEditorCard(taskId, draftContent, isComic) {
    updateStepHeader("DRAFT EDITOR"); 

    let panelsHtml = '';
    const activePanels = MISSION.currentPanels || draftContent.panels;
    const activeCaption = MISSION.currentCaption || draftContent.post_caption;

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

    const ui = createSkillUI(`
        <div class="space-y-4 mb-4 animate-fade-in">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 space-y-3 shadow-inner">
                <h3 class="text-xs font-black text-blue-400 uppercase tracking-widest">📝 貼文校稿總編室</h3>
                
                <div class="space-y-1">
                    <label class="text-[9px] text-slate-500 font-bold">社群內文 (Caption)</label>
                    <textarea id="editCaption" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-slate-200 min-h-[100px] focus:border-blue-500 focus:outline-none resize-none">${activeCaption}</textarea>
                </div>
                
                <div class="space-y-1 pt-3 border-t border-white/10">
                    <label class="text-[9px] text-slate-500 font-bold flex items-center gap-1">🏷️ 貼文標籤 (可滑鼠拖曳排序)</label>
                    <div id="hashtagContainer" class="flex flex-wrap gap-2 items-center min-h-[30px] pb-2"></div>
                    <input type="text" id="hashtagInput" class="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-slate-200 focus:border-blue-500 outline-none" placeholder="輸入標籤後按 Enter 新增 (不需打 #)...">
                </div>

                <div class="space-y-2 scrollbar-indigo overflow-y-auto max-h-[300px] pr-1 pt-3 border-t border-white/10">${panelsHtml}</div>
            </div>
            <button id="btnFinalGenerate" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">✨ 確認劇本與對白，發包生圖</button>
        </div>
    `);

    // 🏷️ 活化 Hashtag 拖曳與新增邏輯
    const renderHashtags = () => {
        const container = ui.querySelector('#hashtagContainer');
        container.innerHTML = '';
        MISSION.currentHashtags.forEach((tag, idx) => {
            const cleanTag = tag.replace(/^#/, ''); 
            const pill = document.createElement('div');
            pill.className = 'flex items-center gap-1 bg-indigo-600/30 border border-indigo-500 text-indigo-300 px-2 py-1 rounded-full text-[10px] font-bold cursor-move select-none shadow-sm hover:bg-indigo-600/50 transition-colors';
            pill.draggable = true;
            pill.dataset.idx = idx;
            pill.innerHTML = `<span>#${cleanTag}</span><button class="hover:text-white ml-1 delete-tag-btn font-black" data-idx="${idx}">×</button>`;
            
            // 拖曳事件
            pill.ondragstart = (e) => { e.dataTransfer.setData('text/plain', idx); pill.classList.add('opacity-50', 'scale-105'); };
            pill.ondragend = () => pill.classList.remove('opacity-50', 'scale-105');
            pill.ondragover = (e) => e.preventDefault();
            pill.ondrop = (e) => {
                e.preventDefault();
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                if (fromIdx === idx) return;
                const moved = MISSION.currentHashtags.splice(fromIdx, 1)[0];
                MISSION.currentHashtags.splice(idx, 0, moved);
                renderHashtags();
            };
            container.appendChild(pill);
        });
        
        ui.querySelectorAll('.delete-tag-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation(); 
                MISSION.currentHashtags.splice(btn.dataset.idx, 1);
                renderHashtags();
            };
        });
    };
    renderHashtags();

    ui.querySelector('#hashtagInput').onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim().replace(/^#/, '');
            if (val && !MISSION.currentHashtags.includes(val)) {
                MISSION.currentHashtags.push(val);
                renderHashtags();
            }
            e.target.value = '';
        }
    };

    ui.querySelectorAll('.panel-dialogue').forEach(input => {
        const container = input.closest('.panel-container'); const counter = container.querySelector('.char-counter'); const limit = parseInt(counter.dataset.limit);
        const updateCounter = () => { const len = input.value.length; counter.innerText = `${len} / ${limit} 字`; if (len > limit) { counter.classList.remove('text-slate-500'); counter.classList.add('text-red-500'); input.classList.add('border-red-500', 'text-red-400'); } else { counter.classList.remove('text-red-500'); counter.classList.add('text-slate-500'); input.classList.remove('border-red-500', 'text-red-400'); } };
        input.addEventListener('input', updateCounter); updateCounter();
    });

    ui.querySelector('#btnFinalGenerate').onclick = async () => {
        const editedCaption = ui.querySelector('#editCaption').value; 
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

    const ui = createSkillUI(`
        <div class="space-y-4 animate-fade-in mb-4">
            <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div class="relative w-full aspect-square bg-black flex items-center justify-center">
                    <img src="${displayImgUrl}" class="max-w-full max-h-full object-contain">
                    <div class="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full border border-white/20">共 ${images.length} 張圖</div>
                </div>
                <div class="p-4 border-t border-white/5 bg-slate-800/50 shadow-inner">
                    <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">${finalCaption}</p>
                </div>
            </div>
            <button id="btnDeploy" class="w-full bg-gradient-to-r ${btnColor} text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">${btnText}</button>
            <div class="flex gap-2">
                <button id="btnRegenerateImages" class="flex-1 bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700">🎲 重新算圖 (扣50點)</button>
                <button id="btnBackToDraft" class="flex-1 bg-slate-800 text-slate-300 border border-white/10 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all hover:bg-slate-700">📝 退回總編室 (改字)</button>
            </div>
        </div>
    `);

    ui.querySelector('#btnRegenerateImages').onclick = async () => {
        await window.FunnelActions.generateImages(taskId, MISSION.currentCaption, MISSION.currentPanels);
    };

    ui.querySelector('#btnBackToDraft').onclick = async () => {
        releaseUI(ui);
        await addLog("系統", "🔙", "已退回草稿編輯模式。", true);
        await renderDraftEditorCard(taskId, MISSION.currentDraft, MISSION.universe === 'COMIC');
    };

    ui.querySelector('#btnDeploy').onclick = async () => {
        releaseUI(ui); const spinId = 'spin_pub_' + Date.now();
        await addLog("系統", "⏳", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">Agent 正在與社群伺服器連線...</span></div>`, true);
        try {
            const response = await publishTaskAPI({ taskId: taskId, tenantId: STATE.uid, scheduledAt: MISSION.scheduledAt, finalCaption: finalCaption });
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
