// js/agent_v9_core.js
import { STATE, CONFIG } from './config.js';
import * as API from './api.js'; 

// 🌟 引入狀態引擎與 UI 引擎
import { APP_VERSION, MISSION, IS_EDIT_MODE, SYSTEM_DB, isMissionComplete, compressImage } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';

// 重新匯出給 HTML 使用
export { bootSystemData } from './v9_state.js';

// ==========================================
// 🚀 漏斗核心流程
// ==========================================
export async function initAgentFunnel() { updateStepHeader("COMMAND LOBBY"); renderLobby(); }

function renderLobby() {
    const log = document.getElementById('funnelLog');
    Object.assign(MISSION, { persona: '', platforms: [], topic: '', universe: '', style: '', colorMode: '', ratio: '9:16', resolution: '1K', characters: [], sceneFiles: [], scheduledAt: null });
    
    log.innerHTML = `
        <div class="max-w-4xl mx-auto mt-4 lg:mt-10 animate-fade-in space-y-6">
            <div class="text-center space-y-2 mb-8">
                <h2 class="text-2xl lg:text-3xl font-black text-white tracking-tight">歡迎回到指揮艙，總編</h2>
                <p class="text-xs text-slate-400">目前運作品牌：<span class="text-blue-400 font-bold">BrandDecoder 官方</span></p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                <div class="bg-slate-800/50 border border-indigo-500/30 rounded-3xl p-6 lg:p-8 hover:bg-slate-800 transition-all cursor-pointer group shadow-xl relative flex flex-col h-full" onclick="alert('全自動情報網建置中...')">
                    <div class="absolute top-0 right-0 bg-indigo-600 text-[10px] font-black px-3 py-1 rounded-bl-xl tracking-widest uppercase">Auto-Pilot</div>
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">🤖</div>
                    <h3 class="text-lg font-black text-white mb-2">全自動情報偵測</h3>
                    <p class="text-xs text-slate-400 mb-6 leading-relaxed">Agent 根據品牌標籤與人設，24小時過濾趨勢，主動撰寫發文草稿。</p>
                </div>
                <div class="bg-blue-600/10 border border-blue-500/50 rounded-3xl p-6 lg:p-8 transition-all cursor-pointer group shadow-[0_0_30px_rgba(59,130,246,0.15)] flex flex-col h-full active:scale-95" id="btnManualStart">
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">✍️</div>
                    <h3 class="text-lg font-black text-white mb-2">手動發起任務</h3>
                    <p class="text-xs text-slate-400 mb-6 leading-relaxed">進入專屬 AI 漏斗。由您親自指定所有視覺與文案細節。</p>
                    <button class="mt-auto w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">🚀 啟動漏斗</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('btnManualStart').onclick = async () => { 
        log.innerHTML = ''; 
        await addLog("專案總監", "👨‍💼", `${APP_VERSION} 漏斗啟動。讀取真實基因庫中...`); 
        await triggerPersonaSkill();
    };
}

async function triggerPersonaSkill() {
    updateStepHeader("PERSONA SELECTION"); await addLog("專案總監", "🎭", "請指派本次任務的靈魂（品牌人設）：", true);
    let html = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`; 
    SYSTEM_DB.personas.forEach(p => { html += `<button class="persona-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.persona === p.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${p.name}"><span class="text-2xl mb-1">${p.icon}</span><span class="font-bold text-sm text-white">${p.name}</span><span class="text-[10px] text-slate-400">${p.desc}</span></button>`; }); html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.persona-btn').forEach(btn => { btn.onclick = async () => { MISSION.persona = btn.dataset.val; releaseUI(ui); await addLog("專案總監", "✅", `已掛載人設模組：<b>${MISSION.persona}</b>。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerPlatformSkill(); } }; });
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
    const ui = createSkillUI(`<div class="flex flex-col gap-3"><textarea id="inlineTopicInput" class="w-full bg-slate-900 border border-blue-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px] resize-y" placeholder="例如：介紹夏日防曬乳...">${MISSION.topic}</textarea><div class="flex justify-end"><button id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">確認鎖定主題</button></div></div>`);
    const inputEl = ui.querySelector('#inlineTopicInput'); setTimeout(() => { inputEl.focus(); }, 100);
    ui.querySelector('#btnConfirmTopic').onclick = async () => { const val = inputEl.value.trim(); if(!val) return showError('主題不能為空！'); MISSION.topic = val; inputEl.disabled = true; inputEl.classList.add('opacity-50', 'bg-slate-800'); ui.querySelector('#btnConfirmTopic').classList.add('hidden'); releaseUI(ui); await addLog("總編指令", "🗣️", `鎖定主題：${val}`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerUniverseSkill(); } };
}

async function triggerUniverseSkill() {
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const ui = createSkillUI(`
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC"><span class="text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button>
            <button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC"><span class="text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button>
            <button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-yellow-500 hover:bg-yellow-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'ENHANCE' ? 'border-yellow-500 bg-yellow-600/20' : 'bg-slate-800'}" data-val="ENHANCE"><span class="text-3xl">✨</span><span class="font-black text-xs text-white">無損美化</span></button>
        </div>
    `);
    ui.querySelectorAll('.uni-btn').forEach(btn => { 
        btn.onclick = async () => { 
            const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val; 
            if (oldUni !== MISSION.universe) { MISSION.style = ''; MISSION.colorMode = ''; MISSION.characters = []; MISSION.sceneFiles = []; MISSION.ratio = MISSION.universe === 'ENHANCE' ? '原圖比例' : '9:16'; } 
            releaseUI(ui); await addLog("美術總監", "✅", `宇宙鎖定：${MISSION.universe}。`); await triggerStyleSkill(); 
        }; 
    });
}

async function triggerStyleSkill() {
    updateStepHeader("STYLE SELECTION"); 
    const availableStyles = SYSTEM_DB.styles.length > 0 ? SYSTEM_DB.styles : [{id: 'MANGA_BW', name: '預設風格'}];
    let html = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">`; 
    availableStyles.forEach(s => { html += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.name}"><span class="text-xl">${s.icon || '🎨'}</span><span class="font-bold text-xs text-white">${s.name}</span></button>`; }); 
    html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.style-btn').forEach(btn => { btn.onclick = async () => { 
        MISSION.style = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `風格鎖定：${MISSION.style}。`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerColorSkill(); }
    };});
}

async function triggerColorSkill() {
    updateStepHeader("COLOR MODE"); await addLog("美術總監", "🎨", "請決定漫畫色系：", true);
    const ui = createSkillUI(`
        <div class="grid grid-cols-2 gap-3 mb-4">
            <button class="color-btn p-4 rounded-xl border border-white/10 hover:border-slate-400 hover:bg-white/5 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'B&W' ? 'border-blue-500 bg-white/5' : ''}" data-val="B&W"><span class="text-3xl mb-1">🏁</span><span class="font-bold text-xs text-white">經典黑白 (Classic B&W)</span><span class="text-[9px] text-slate-400">日式墨線、懷舊網點質感</span></button>
            <button class="color-btn p-4 rounded-xl border border-white/10 hover:border-pink-400 hover:bg-pink-600/10 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'Color' ? 'border-pink-500 bg-pink-600/10' : ''}" data-val="Color"><span class="text-3xl mb-1">🌈</span><span class="font-bold text-xs text-white">現代全彩 (Modern Color)</span><span class="text-[9px] text-slate-400">飽滿手繪色澤、現代動漫感</span></button>
        </div>
    `);
    ui.querySelectorAll('.color-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.colorMode = btn.dataset.val; releaseUI(ui);
            await addLog("美術總監", "✅", `色系已鎖定：<b>${MISSION.colorMode === 'B&W' ? "黑白漫畫" : "全彩動漫"}</b>。`);
            if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
            else if (MISSION.universe === 'ENHANCE') { await triggerVisualSkill(); }
            else { await triggerCharacterSkill(); }
        };
    });
}

async function triggerCharacterSkill() {
    updateStepHeader("CHARACTER SUMMON"); await addLog("視覺工程師", "🧬", `請勾選要在本次任務中登場的 ${MISSION.universe === 'COMIC' ? '動漫' : '真人'} 角色 (最多4位)：`, true);
    const available = SYSTEM_DB.characters.filter(c => c.type === MISSION.universe);
    if(available.length === 0) {
        const ui = createSkillUI(`<div class="text-center p-4"><p class="text-slate-400 text-xs mb-4">您的基因庫目前沒有角色，將採用純場景模式。</p><button id="btnSkipChar" class="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-bold active:scale-95 shadow-lg">⏭️ 確認並繼續</button></div>`);
        ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "已確認，採用純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } }; return;
    }

    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">`; let tempSelected = [...MISSION.characters];
    available.forEach(char => {
        const isSelected = tempSelected.includes(char.name);
        html += `<div class="char-select-card flex flex-col items-center gap-2 cursor-pointer transition-all p-3 rounded-xl bg-slate-800 relative ${isSelected ? 'border-2 border-blue-500 bg-blue-900/30' : 'border border-white/10 hover:border-slate-500'}" data-name="${char.name}"><div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700 pointer-events-none"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-xs font-bold text-slate-200 pointer-events-none">${char.name}</span>${isSelected ? '<div class="absolute top-2 right-2 text-blue-400 font-black">✓</div>' : ''}</div>`;
    });
    html += `</div><div class="flex gap-2"><button id="btnSkipChar" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all border border-white/10 hover:bg-slate-700">⏭️ 不召喚</button><button id="btnConfirmChar" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認召喚</button></div>`;
    
    const ui = createSkillUI(html);
    ui.querySelectorAll('.char-select-card').forEach(card => {
        card.onclick = () => {
            const name = card.dataset.name;
            if (tempSelected.includes(name)) { tempSelected = tempSelected.filter(n => n !== name); card.classList.remove('border-2', 'border-blue-500', 'bg-blue-900/30'); card.classList.add('border', 'border-white/10'); const check = card.querySelector('.absolute'); if(check) check.remove(); } 
            else { if (tempSelected.length >= 4) return showError('最多 4 位。'); tempSelected.push(name); card.classList.remove('border', 'border-white/10'); card.classList.add('border-2', 'border-blue-500', 'bg-blue-900/30'); card.innerHTML += '<div class="absolute top-2 right-2 text-blue-400 font-black">✓</div>'; }
        };
    });
    ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
    ui.querySelector('#btnConfirmChar').onclick = async () => { MISSION.characters = tempSelected; releaseUI(ui); await addLog("視覺工程師", "✅", MISSION.characters.length > 0 ? `已鎖定角色：<b>${MISSION.characters.join('、')}</b>。` : "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
}

async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG"); const isEnhance = MISSION.universe === 'ENHANCE';
    await addLog("美術總監", "👨‍🎨", isEnhance ? "美化模式：請上傳原圖。" : "請確認畫面比例與參考圖：", true);
    
    let currentRatio = MISSION.ratio; let currentRes = MISSION.resolution;
    const ui = createSkillUI(`
        <div class="space-y-4 lg:space-y-6 flex flex-col relative mb-4">
            <div class="bg-blue-600/10 p-4 lg:p-5 rounded-2xl border border-blue-500/30"><div class="grid grid-cols-2 gap-3"><button ${isEnhance ? 'disabled' : `id="btnEditRatio"`} class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95 ${isEnhance ? 'opacity-50' : ''}"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white tag-ratio">${currentRatio}</span></button><button id="btnEditRes" class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white tag-res">${currentRes}</span></button></div></div>
            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">${isEnhance ? '' : `<div class="space-y-3"><label class="text-[10px] text-slate-500 font-black">📐 比例</label><div class="grid grid-cols-3 gap-2"><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="9:16">9:16</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="16:9">16:9</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1:1">1:1</button></div></div>`}<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">✨ 解析度</label><div class="grid grid-cols-3 gap-2"><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1K">1K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2K">2K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4K">4K</button></div></div></div>
            <button id="btnUploadScene" class="w-full bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 hover:border-slate-500 active:scale-95 transition-all"><span class="text-lg">📸</span> 點此上傳場景或道具圖 (選填)</button>
            <div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div>
            <button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 lg:py-5 rounded-xl font-black text-sm shadow-lg mt-auto active:scale-[0.98]">✅ 鎖定參數</button>
        </div>
    `);

    const openPanel = () => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    if(ui.querySelector('#btnEditRatio')) ui.querySelector('#btnEditRatio').onclick = openPanel;
    if(ui.querySelector('#btnEditRes')) ui.querySelector('#btnEditRes').onclick = openPanel;

    if (!isEnhance) { ui.querySelectorAll('.ratio-btn').forEach(btn => { if(btn.dataset.val === currentRatio) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRatio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = currentRatio; }; }); }
    ui.querySelectorAll('.res-btn').forEach(btn => { if(btn.dataset.val === currentRes) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRes = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = currentRes; }; });
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.onchange=async(e)=>{if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea'))}; i.click(); };
    ui.querySelector('#btnAcceptVisual').onclick = async () => { MISSION.ratio = currentRatio; MISSION.resolution = currentRes; if (!isMissionComplete()) return showError('請完成設定！'); releaseUI(ui); await addLog("美術總監", "✅", `畫面參數已鎖定：<b>${MISSION.ratio} / ${MISSION.resolution}</b>。`); await triggerScheduleSkill(); };
}

async function handleAssetUpload(file, container) { 
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); 
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in'; 
    const dataUrl = await compressImage(file, 800); MISSION.sceneFiles = [{ dataUrl: dataUrl }]; 
    panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 參考素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `已優化並載入圖資。`); 
}

// 🌟 關卡 9: 防彈級專業排程時鐘 (安全氣囊 Try-Catch)
async function triggerScheduleSkill() {
    updateStepHeader("PUBLISH SCHEDULE"); await addLog("社群總監", "📅", "最後一步，請指派部署時間（留空為立即發佈）：", true);
    
    const ui = createSkillUI(`
        <div class="flex flex-col gap-3 mb-4">
            <div class="grid grid-cols-2 gap-3">
                <input type="text" id="datePicker" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="📅 選擇日期 (選填)">
                <div class="timepicker-ui relative" id="timePickerWrapper">
                    <input type="text" id="timePickerInput" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500 timepicker-ui-input" placeholder="⏰ 選擇時間 (選填)">
                </div>
            </div>
            <button id="btnConfirmSchedule" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">確認時間</button>
        </div>
    `);
    
    // 1. 安全載入 Flatpickr (防呆: 如果沒掛語系，就用預設)
    const fpConfig = { dateFormat: "Y-m-d", minDate: "today", time_24hr: true, defaultDate: MISSION.scheduledAt ? new Date(MISSION.scheduledAt) : null };
    if (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.zh) { fpConfig.locale = "zh"; }
    const fp = typeof flatpickr !== 'undefined' ? flatpickr("#datePicker", fpConfig) : null;
    
    // 2. 安全載入 TimepickerUi (防彈機制: 如果沒掛 CDN 就不會死機)
    const timeInput = ui.querySelector('#timePickerInput');
    let tp = null;
    try {
        if (typeof timepickerUi !== 'undefined') {
            timeInput.setAttribute('readonly', true); // 華麗時鐘模式需防寫
            tp = new timepickerUi.TimepickerUi(ui.querySelector('#timePickerWrapper'), {
                clockType: "24h", theme: "dark", okLabel: "確認", cancelLabel: "取消", editable: false, inputClass: "timepicker-ui-input",
                defaultTime: MISSION.scheduledAt ? new Date(MISSION.scheduledAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : null
            });
            setupTimePickerConstraints(ui.querySelector('#timePickerWrapper'));
            timeInput.onclick = () => { tp.open(); };
        } else {
            throw new Error("找不到 timepickerUi 套件");
        }
    } catch (e) {
        console.warn("⚠️ 華麗時鐘載入失敗，降級為原生輸入模式", e);
        timeInput.type = "time"; // 降級為原生時間選單，按鈕一樣可以按！
        timeInput.step = "900";  // 原生限制 15 分鐘
    }
    
    // 3. 綁定確認按鈕 (這段現在受到嚴格保護，絕對不會死掉)
    ui.querySelector('#btnConfirmSchedule').onclick = async () => {
        const dateStr = fp ? fp.input.value : ui.querySelector('#datePicker').value; 
        const timeStr = timeInput.value;
        if(fp) fp.destroy(); if(tp) tp.destroy(); 

        if (dateStr && timeStr) {
            const dtStr = `${dateStr}T${timeStr}:00+08:00`; 
            const schDate = new Date(dtStr);
            if (schDate < new Date()) { showError("部署時間不能小於當前時間！"); await triggerScheduleSkill(); return; }
            MISSION.scheduledAt = schDate.toISOString(); releaseUI(ui);
            const displaySch = schDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            await addLog("社群總監", "✅", `部署時間已寫入排程：<b>${displaySch}</b> (Asia/Taipei)。`);
        } else {
            MISSION.scheduledAt = null; releaseUI(ui); await addLog("社群總監", "⚡", `已選擇<b>「立即部署」</b>模式。`); 
        }
        await triggerMissionSummary();
    };
}

function setupTimePickerConstraints(wrapper) {
    const minutes = [0, 15, 30, 45];
    const hourHand = wrapper.querySelector('.timepicker-ui-hour-hand'); const minuteHand = wrapper.querySelector('.timepicker-ui-minute-hand');
    if (hourHand && minuteHand) {
        const minutesNodes = wrapper.querySelectorAll('.timepicker-ui-minute');
        minutesNodes.forEach(node => {
            const minuteValue = parseInt(node.textContent);
            if (!minutes.includes(minuteValue)) { node.style.opacity = '0.3'; node.style.pointerEvents = 'none'; } 
            else { node.style.fontWeight = 'black'; node.style.color = '#3b82f6'; }
        });
        const input = wrapper.querySelector('.timepicker-ui-input');
        if (input.value) {
            let [h, m] = input.value.split(':'); let mint = parseInt(m);
            if (!minutes.includes(mint)) { mint = minutes.reduce((prev, curr) => (Math.abs(curr - mint) < Math.abs(prev - mint) ? curr : prev)); input.value = `${h}:${String(mint).padStart(2, '0')}`; }
        }
    }
}

// 🌟 Mission Brief (動態扣點)
async function triggerMissionSummary() {
    updateStepHeader("FINAL CONFIRMATION"); await addLog("專案總監", "👨‍💼", "總編，請進行最後確認。點擊 ✎ 可發起反悔修正：", true);

    const pricing = SYSTEM_DB.pricing || { baseDraftPoints: 15, characterImagePointsMultiplier: 10 }; 
    const totalPts = pricing.baseDraftPoints + (MISSION.characters.length * (pricing.characterImagePointsMultiplier || 0));
    
    let charsHtml = '<div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[120px] justify-end">';
    if(MISSION.characters.length > 0) { MISSION.characters.forEach(c => { const o = SYSTEM_DB.characters.find(mc => mc.name === c); if(o && o.imageUrl) charsHtml += `<img src="${o.imageUrl}" class="w-6 h-6 rounded-full border border-blue-500 flex-shrink-0" title="${c}">`; else charsHtml += `<span class="text-[10px] bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded border border-blue-500/50">${c}</span>`; }); } else { charsHtml += `<span class="text-[10px] text-slate-500">純場景</span>`; } charsHtml += '</div>';

    let visHtml = '<div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[120px] justify-end">';
    if (MISSION.sceneFiles.length > 0) visHtml += `<img src="${MISSION.sceneFiles[0].dataUrl}" class="w-6 h-6 rounded border border-slate-500 object-cover flex-shrink-0">`; else visHtml += `<span class="text-[10px] text-slate-500">${MISSION.ratio} / ${MISSION.resolution}</span>`; visHtml += '</div>';

    const schDisplay = MISSION.scheduledAt ? new Date(MISSION.scheduledAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "⚡ 立即部署";
    const clrDisplay = MISSION.colorMode === 'B&W' ? "🏁 經典黑白" : "🌈 現代全彩";

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-3xl p-5 shadow-2xl space-y-4 mb-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3"><span class="text-xs font-black text-blue-400">MISSION BRIEF</span><span class="text-[10px] text-slate-500">${APP_VERSION}</span></div>
            <div class="space-y-3 text-[11px]">
                <div id="retryPersona" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors"><span>🎭 人設</span><span class="text-white font-bold">${MISSION.persona} ✎</span></div>
                <div id="retryPlat" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors"><span>🚀 平台</span><span class="text-white font-bold">${MISSION.platforms.join(', ')} ✎</span></div>
                <div id="retryTopic" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors"><span>📝 主題</span><span class="text-white font-bold truncate max-w-[150px]">${MISSION.topic} ✎</span></div>
                <div id="retryUni" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors"><span>🌌 宇宙 / 🎨 風格 / 🌈 色系</span><span class="text-white font-bold">${MISSION.universe} / ${MISSION.style} / ${clrDisplay} ✎</span></div>
                <div id="retryChar" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors"><span>👥 登場角色</span><div class="flex items-center gap-2">${charsHtml} <span class="text-[10px] text-blue-400 font-bold">✎</span></div></div>
                <div id="retryVis" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors"><span>📐 畫面與參考圖</span><div class="flex items-center gap-2">${visHtml} <span class="text-[10px] text-blue-400 font-bold">✎</span></div></div>
                <div id="retrySch" class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors pt-3 border-t border-white/10"><span class="text-indigo-400 font-black">📅 部署時間</span><span class="text-white font-bold">${schDisplay} ✎</span></div>
            </div>
            <button id="btnRender" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">⚡ 扣除 ${totalPts} 點產出劇本與校稿卡</button>
        </div>
    `);

    const bindRetry = (id, stepFunc) => { const el = ui.querySelector(id); if(el) el.onclick = async () => { IS_EDIT_MODE.value = true; releaseUI(ui); await stepFunc(); }; };
    bindRetry('#retryPersona', triggerPersonaSkill); bindRetry('#retryPlat', triggerPlatformSkill); bindRetry('#retryTopic', triggerTopicSkill); bindRetry('#retryUni', triggerUniverseSkill); bindRetry('#retryChar', triggerCharacterSkill); bindRetry('#retryVis', triggerVisualSkill); bindRetry('#retrySch', triggerScheduleSkill); 

    ui.querySelector('#btnRender').onclick = async () => {
        releaseUI(ui); await addLog("首席文案", "⏳", `<div class="flex items-center gap-2"><div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span>正在產出劇本...</span></div>`, true);

        const referenceImages = []; MISSION.characters.forEach(name => { const charData = SYSTEM_DB.characters.find(c => c.name === name); if(charData && charData.imageUrl) referenceImages.push({ type: 'character', name: name, imageUrl: charData.imageUrl }); }); MISSION.sceneFiles.forEach(sf => { if(sf.dataUrl) referenceImages.push({ type: 'scene', data: sf.dataUrl }); });

        const rawPayload = { tenantId: STATE.uid, topic: MISSION.topic, isComicMode: MISSION.universe === 'COMIC', style: MISSION.style, platforms: MISSION.platforms, persona: MISSION.persona, colorMode: MISSION.colorMode, ratio: MISSION.ratio, resolution: MISSION.resolution, scheduledAt: MISSION.scheduledAt, characters: MISSION.characters.map(name => { const c = SYSTEM_DB.characters.find(x => x.name === name); return { name: name, persona: c ? (c.persona || "") : "" }; }), image_options: { ratio: MISSION.ratio, resolution: MISSION.resolution, referenceImages: referenceImages } };

        try {
            const result = await API.createDraftAPI(JSON.parse(JSON.stringify(rawPayload)));
            if (result.success) {
                STATE.userPoints = result.newBalance || (STATE.userPoints - totalPts); document.getElementById('userPoints').innerText = STATE.userPoints.toLocaleString();
                await addLog("首席文案", "✅", "劇本已產出！", true); await renderDraftEditorCard(result.taskId, result.draftContent, result.isComicMode);
            } else throw new Error(result.message);
        } catch (e) { showError(`發送失敗：${e.message}`); }
    };
}

// 🌟 校稿總編室
async function renderDraftEditorCard(taskId, draftContent, isComic) {
    updateStepHeader("DRAFT EDITOR"); await addLog("首席文案", "📝", "請總編進行社群內文與分鏡對白的最後校稿：", true);

    let panelsHtml = '';
    if (isComic && draftContent.panels) {
        draftContent.panels.forEach((p, idx) => {
            panelsHtml += `<div class="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2"><div class="flex justify-between items-center"><span class="text-[9px] font-black text-indigo-400"># PANEL ${p.panel_number}</span></div><p class="text-[10px] text-slate-400 leading-tight italic">${p.action_zh}</p><input type="text" class="panel-dialogue w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white" value="${p.dialogue}" data-idx="${idx}"></div>`;
        });
    }

    const ui = createSkillUI(`
        <div class="space-y-4 mb-4 animate-fade-in">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 space-y-3 shadow-inner">
                <h3 class="text-xs font-black text-blue-400 uppercase tracking-widest">📝 貼文校稿總編室</h3>
                <div class="space-y-1"><label class="text-[9px] text-slate-500 font-bold">社群內文 (Caption)</label><textarea id="editCaption" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-slate-200 min-h-[100px] focus:border-blue-500 focus:outline-none resize-none">${draftContent.post_caption}</textarea></div>
                <div class="space-y-2 scrollbar-indigo overflow-y-auto max-h-[300px] pr-1">${panelsHtml}</div>
            </div>
            <button id="btnFinalGenerate" class="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">✨ 確認劇本與對白，發包生圖</button>
        </div>
    `);

    ui.querySelector('#btnFinalGenerate').onclick = async () => {
        const editedCaption = ui.querySelector('#editCaption').value; const editedPanels = []; ui.querySelectorAll('.panel-dialogue').forEach(input => { const idx = input.dataset.idx; editedPanels.push({ panel_number: draftContent.panels[idx].panel_number, dialogue: input.value }); });
        releaseUI(ui); await addLog("視覺工程師", "🎨", `<div class="flex items-center gap-2"><div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span>正在進行 AI 影像合成 (預估需 20~30 秒)...</span></div>`, true);
        
        try {
            const payload = { taskId: taskId, tenantId: STATE.uid, editedCaption: editedCaption, editedPanels: editedPanels };
            const result = await API.generateImageAPI(payload);
            if (result.success && result.images && result.images.length > 0) {
                await addLog("視覺工程師", "✅", "影像合成完畢！", true); await renderFinalPublishCard(taskId, result.images, editedCaption);
            } else { throw new Error(result.message || "生圖回傳異常"); }
        } catch (e) { showError(`生圖失敗：${e.message}`); }
    };
}

// 🌟 發佈預覽
async function renderFinalPublishCard(taskId, images, finalCaption) {
    updateStepHeader("FINAL DEPLOYMENT"); await addLog("社群總監", "🚀", "大作已完成！請做最後確認，準備部署至社群：", true);

    const displayImgUrl = images[0].finalUrl; let btnText = "🚀 立即發佈至社群"; let btnColor = "from-green-600 to-emerald-600";
    if(MISSION.scheduledAt) { const dateStr = new Date(MISSION.scheduledAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); btnText = `⏰ 寫入排程 (${dateStr})`; btnColor = "from-orange-500 to-red-500"; }

    const ui = createSkillUI(`
        <div class="space-y-4 animate-fade-in mb-4">
            <div class="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div class="relative w-full aspect-square bg-black flex items-center justify-center"><img src="${displayImgUrl}" class="max-w-full max-h-full object-contain"><div class="absolute top-2 right-2 bg-black/60 text-white text-[9px] px-2 py-1 rounded-full border border-white/20">共 ${images.length} 張圖</div></div>
                <div class="p-4 border-t border-white/5 bg-slate-800/50 shadow-inner"><p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">${finalCaption}</p></div>
            </div>
            <button id="btnDeploy" class="w-full bg-gradient-to-r ${btnColor} text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">${btnText}</button>
        </div>
    `);

    ui.querySelector('#btnDeploy').onclick = async () => {
        releaseUI(ui); await addLog("系統", "⏳", `<div class="flex items-center gap-2"><div class="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span>正在與社群伺服器連線...</span></div>`, true);
        try {
            const payload = { taskId: taskId, tenantId: STATE.uid, finalCaption: finalCaption, scheduledAt: MISSION.scheduledAt };
            const result = await API.publishContentAPI(payload);
            if (result.success) {
                STATE.userPoints = result.newBalance || (STATE.userPoints - (SYSTEM_DB.pricing?.publishPoints || 0)); document.getElementById('userPoints').innerText = STATE.userPoints.toLocaleString();
                await addLog("系統", "🎉", `<span class="text-green-400 font-bold">${result.message}</span> 任務圓滿達成！您已跨出商業化第一步！🥂`, true);
                const endUi = createSkillUI(`<button id="btnRestart" class="w-full bg-slate-800 border border-white/10 text-white py-3 rounded-xl font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all shadow-lg">🔄 發起新任務</button>`);
                endUi.querySelector('#btnRestart').onclick = () => { releaseUI(endUi); initAgentFunnel(); }; 
            } else { throw new Error(result.message || "發佈異常"); }
        } catch(e) { showError(`操作失敗：${e.message}`); }
    };
}

// ==========================================
// 🧬 側欄管理
// ==========================================
window.openCharManager = function() { const modal = document.getElementById('charManageModal'); modal.classList.remove('hidden'); setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10); renderCharGrid(); };
window.closeCharManager = function() { const modal = document.getElementById('charManageModal'); modal.classList.remove('show'); setTimeout(() => { modal.classList.add('hidden'); }, 300); window.cancelNewChar(); };
function renderCharGrid() { const grid = document.getElementById('charGridContainer'); grid.innerHTML = ''; if(SYSTEM_DB.characters.length === 0) { grid.innerHTML = `<div class="col-span-full text-center text-sm text-slate-500 py-10">尚無角色，請立即註冊！</div>`; return; } SYSTEM_DB.characters.forEach(char => { grid.innerHTML += `<div class="bg-slate-800 rounded-xl border border-white/10 p-3 flex flex-col items-center gap-2 relative group"><div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><div class="text-center w-full"><p class="text-xs font-bold text-white truncate">${char.name}</p><p class="text-[9px] text-slate-400 truncate w-full" title="${char.aiExtractedFeatures}">${char.aiExtractedFeatures || '特徵分析中...'}</p></div><button onclick="window.deleteChar('${char.id}')" class="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>`; }); }
let tempCharBase64 = null;
window.openNewCharForm = function() { document.getElementById('newCharForm').classList.remove('hidden'); document.getElementById('btnAddNewCharContainer').classList.add('hidden'); };
window.cancelNewChar = function() { document.getElementById('newCharForm').classList.add('hidden'); document.getElementById('btnAddNewCharContainer').classList.remove('hidden'); document.getElementById('charPreviewEmpty').classList.remove('hidden'); document.getElementById('charPreviewImg').classList.add('hidden'); document.getElementById('newCharName').value = ''; document.getElementById('newCharPersona').value = ''; tempCharBase64 = null; };
window.handleCharPhotoSelect = async function(e) { const file = e.target.files[0]; if(!file) return; tempCharBase64 = await compressImage(file, 600); document.getElementById('charPreviewEmpty').classList.add('hidden'); const img = document.getElementById('charPreviewImg'); img.src = tempCharBase64; img.classList.remove('hidden'); };
window.submitNewChar = async function() { const name = document.getElementById('newCharName').value.trim(); const type = document.getElementById('newCharType').value; const persona = document.getElementById('newCharPersona').value.trim(); if(!name || !tempCharBase64) return alert('請提供照片與名稱！'); const btn = document.getElementById('btnSubmitNewChar'); btn.innerHTML = '<div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></div> 萃取中...'; btn.disabled = true; try { const res = await API.createCharacterAPI({ tenantId: STATE.uid, name, type, persona, imageBase64: tempCharBase64, mimeType: 'image/jpeg' }); if(res.success) { alert('🎉 註冊成功！'); await bootSystemData(); window.cancelNewChar(); renderCharGrid(); } else throw new Error(res.message); } catch(e) { alert(`❌ 失敗: ${e.message}`); } finally { btn.innerHTML = '上傳並萃取基因'; btn.disabled = false; } };
window.deleteChar = async function(charId) { if(!confirm('確定要刪除嗎？')) return; try { const res = await API.deleteCharacterAPI({ charId, tenantId: STATE.uid }); if(res.success) { await bootSystemData(); renderCharGrid(); } else throw new Error(res.message); } catch(e) { alert(`❌ 刪除失敗: ${e.message}`); } };
window.refreshAuditLogs = async function() { const container = document.getElementById('auditLogsContainer'); container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4"><div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div> 讀取中...</div>'; try { const res = await API.fetchAuditLogsAPI(STATE.uid); if(res.success && res.logs.length > 0) { container.innerHTML = ''; res.logs.forEach(log => { const action = (log.actionType || 'SYSTEM_LOG'); const isDeduct = action.includes('GENERATE') || action.includes('PUBLISH') || action.includes('UPLOAD'); const ptClass = isDeduct ? 'text-red-400' : 'text-green-400'; const sign = isDeduct ? '-' : '+'; const pts = log.pointsDeducted || Math.abs(log.pointsChanged || 0); const dateTaipei = new Date(log.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); container.innerHTML += `<div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg text-[11px] mb-2 border border-white/5 shadow-inner"><div><p class="text-white font-bold">${action}</p><p class="text-slate-500 text-[10px]">${dateTaipei}</p></div><span class="${ptClass} font-black text-xs">${sign} ${pts.toLocaleString()} PTS</span></div>`; }); } else { container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4">目前尚無算力紀錄，立即開啟新任務！</div>'; } } catch(e) { container.innerHTML = `<div class="text-center text-xs text-red-400 py-4">讀取失敗 (髒資料跳過)</div>`; } };
