// js/agent_v9_core.js
import { STATE } from './config.js';
import * as API from './api.js'; 

const APP_VERSION = "V0.27 完美封裝版";
const MISSION = { persona: '', platforms: [], topic: '', universe: '', style: '', ratio: '9:16', resolution: '1K', characters: [], sceneFiles: [], scheduleMode: 'NOW', scheduleDate: '', scheduleTime: '' };
let IS_EDIT_MODE = false;

export const SYSTEM_DB = {
    styles: [], characters: [],
    personas: [
        { id: 'HUMOR', name: '幽默酸民', icon: '🤡', desc: '時事嘲諷、網路迷因語氣' },
        { id: 'PRO', name: '專業權威', icon: '💼', desc: '數據導向、菁英分析觀點' },
        { id: 'WARM', name: '溫暖知性', icon: '☕', desc: '心靈雞湯、柔和共鳴語氣' }
    ]
};

// 啟動資料同步
export async function bootSystemData() {
    try {
        const result = await API.fetchSystemOptionsAPI(STATE.uid);
        if(result.success && result.data) {
            SYSTEM_DB.styles = result.data.styles || [];
            SYSTEM_DB.characters = result.data.characters || [];
            const charCountEl = document.getElementById('charCountLabel');
            if (charCountEl) charCountEl.innerText = `已擁有 ${SYSTEM_DB.characters.length} 組角色模型`;
        }
    } catch(e) { console.error("同步資料失敗", e); }
}

function isMissionComplete() {
    if (!MISSION.persona || MISSION.platforms.length === 0 || !MISSION.topic || !MISSION.universe || !MISSION.style) return false;
    return !(MISSION.universe === 'ENHANCE' && MISSION.sceneFiles.length === 0);
}

async function showError(msg) {
    const log = document.getElementById('funnelLog'); const div = document.createElement('div');
    div.className = 'flex justify-center w-full my-2 animate-bounce';
    div.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"><span class="text-lg">🚨</span> <span>${msg}</span></div>`;
    const activeCard = document.getElementById('activeControlCard');
    if (activeCard) log.insertBefore(div, activeCard); else log.appendChild(div);
    scrollDown();
}

function readFileAsDataURL(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); }); }

// ==========================================
// 漏斗主邏輯 (完整無刪減)
// ==========================================
export async function initAgentFunnel() { updateStepHeader("COMMAND LOBBY"); renderLobby(); }

function renderLobby() {
    const log = document.getElementById('funnelLog');
    log.innerHTML = `
        <div class="max-w-4xl mx-auto mt-4 lg:mt-10 animate-fade-in space-y-6">
            <div class="text-center space-y-2 mb-8">
                <h2 class="text-2xl lg:text-3xl font-black text-white tracking-tight">歡迎回到指揮艙，總編</h2>
                <p class="text-xs text-slate-400">目前運作品牌：<span class="text-blue-400 font-bold">BrandDecoder 官方</span></p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
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
        log.innerHTML = ''; MISSION.universe = ''; MISSION.persona = ''; MISSION.platforms = []; MISSION.topic = '';
        await addLog("專案總監", "👨‍💼", `${APP_VERSION} 漏斗啟動。讀取真實基因庫中...`); 
        await triggerPersonaSkill();
    };
}

async function triggerPersonaSkill() {
    updateStepHeader("PERSONA SELECTION"); await addLog("專案總監", "🎭", "請指派本次任務的靈魂（品牌人設）：", true);
    let html = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`; 
    SYSTEM_DB.personas.forEach(p => { html += `<button class="persona-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.persona === p.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${p.name}"><span class="text-2xl mb-1">${p.icon}</span><span class="font-bold text-sm text-white">${p.name}</span><span class="text-[10px] text-slate-400">${p.desc}</span></button>`; }); html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.persona-btn').forEach(btn => { btn.onclick = async () => { MISSION.persona = btn.dataset.val; releaseUI(ui); await addLog("專案總監", "✅", `已掛載人設模組：<b>${MISSION.persona}</b>。`); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else if(IS_EDIT_MODE) { await triggerPlatformSkill(); } else { await triggerPlatformSkill(); } }; });
}

async function triggerPlatformSkill() {
    updateStepHeader("PLATFORM SELECTION"); await addLog("社群總監", "🚀", "請決定投遞平台：", true);
    const plats = [{ id: 'FB', name: 'Facebook', activeColor: 'bg-blue-600 border-blue-500 text-white' }, { id: 'IG', name: 'Instagram', activeColor: 'bg-gradient-to-r from-purple-600 to-pink-600 border-pink-500 text-white' }, { id: 'THREADS', name: 'Threads', activeColor: 'bg-black border-slate-500 text-white' }];
    let btnsHtml = ''; let tempPlats = [...MISSION.platforms];
    plats.forEach(p => { const isSelected = tempPlats.includes(p.id); const stateClass = isSelected ? p.activeColor : "bg-slate-800 border-white/10 text-slate-400"; btnsHtml += `<button class="plat-btn px-4 py-3 rounded-xl text-xs font-bold transition-all border ${stateClass}" data-val="${p.id}" data-active="${p.activeColor}" data-name="${p.name}">${isSelected ? p.name + ' ✓' : p.name}</button>`; });
    const ui = createSkillUI(`<div class="grid grid-cols-2 gap-2 sm:flex sm:gap-3">${btnsHtml}<button id="btnConfirmPlat" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg ml-auto active:scale-95 transition-all">確認鎖定</button></div>`);
    ui.querySelectorAll('.plat-btn').forEach(btn => { btn.onclick = () => { const val = btn.dataset.val; const activeClasses = btn.dataset.active.split(' '); if (tempPlats.includes(val)) { tempPlats = tempPlats.filter(p => p !== val); btn.classList.remove(...activeClasses); btn.classList.add('bg-slate-800', 'border-white/10', 'text-slate-400'); btn.innerText = btn.dataset.name; } else { tempPlats.push(val); btn.classList.remove('bg-slate-800', 'border-white/10', 'text-slate-400'); btn.classList.add(...activeClasses); btn.innerText = `${btn.dataset.name} ✓`; } }; });
    ui.querySelector('#btnConfirmPlat').onclick = async () => { if (tempPlats.length === 0) return showError('請至少選擇一個平台！'); MISSION.platforms = tempPlats; releaseUI(ui); await addLog("社群總監", "✅", `已鎖定平台：${MISSION.platforms.join(' / ')}。`); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerTopicSkill(); } };
}

async function triggerTopicSkill() {
    updateStepHeader("TOPIC CAPTURE"); await addLog("專案總監", "📝", "請在下方填寫本次貼文的主題與要求：", true);
    const ui = createSkillUI(`<div class="flex flex-col gap-3"><textarea id="inlineTopicInput" class="w-full bg-slate-900 border border-blue-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[100px] resize-y" placeholder="例如：介紹夏日防曬乳...">${MISSION.topic}</textarea><div class="flex justify-end"><button id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">確認鎖定主題</button></div></div>`);
    const inputEl = ui.querySelector('#inlineTopicInput'); setTimeout(() => { inputEl.focus(); }, 100);
    ui.querySelector('#btnConfirmTopic').onclick = async () => { const val = inputEl.value.trim(); if(!val) return showError('主題不能為空！'); MISSION.topic = val; inputEl.disabled = true; inputEl.classList.add('opacity-50', 'bg-slate-800'); ui.querySelector('#btnConfirmTopic').classList.add('hidden'); releaseUI(ui); await addLog("總編指令", "🗣️", `鎖定主題：${val}`); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerUniverseSkill(); } };
}

async function triggerUniverseSkill() {
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const ui = createSkillUI(`<div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC"><span class="text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC"><span class="text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button></div>`);
    ui.querySelectorAll('.uni-btn').forEach(btn => { btn.onclick = async () => { const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val; if (oldUni !== MISSION.universe) { MISSION.style = ''; MISSION.characters = []; MISSION.sceneFiles = []; } releaseUI(ui); await addLog("美術總監", "✅", `宇宙鎖定：${MISSION.universe}。`); await triggerStyleSkill(); }; });
}

async function triggerStyleSkill() {
    updateStepHeader("STYLE SELECTION"); 
    const availableStyles = SYSTEM_DB.styles.length > 0 ? SYSTEM_DB.styles : [{id: 'MANGA_BW', name: '預設風格', desc: '資料庫無可用風格'}];
    let html = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">`; 
    availableStyles.forEach(s => { html += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.name}" data-name="${s.name}"><span class="text-xl">${s.icon || '🎨'}</span><span class="font-bold text-xs text-white">${s.name}</span><span class="text-[9px] text-slate-400">${s.description || s.desc || ''}</span></button>`; }); 
    html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.style-btn').forEach(btn => { btn.onclick = async () => { MISSION.style = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `風格鎖定：${btn.dataset.name}。`); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } }; });
}

async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG"); await addLog("美術總監", "👨‍🎨", "請確認參數。可自由從您的雲端基因庫召喚角色：", true);
    let currentRatio = MISSION.ratio; let currentRes = MISSION.resolution;
    const ui = createSkillUI(`
        <div class="space-y-4 lg:space-y-6 flex flex-col relative">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30">
                <div class="grid grid-cols-2 gap-3"><button class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 opacity-50 cursor-not-allowed"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white">${currentRatio}</span></button><button class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 opacity-50 cursor-not-allowed"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white">${currentRes}</span></button></div>
            </div>
            <div class="grid grid-cols-2 gap-2"><button id="btnSummonChar" class="bg-indigo-600/20 py-4 rounded-xl text-xs font-black border border-indigo-500/50 active:scale-95"><span class="text-lg">🧬</span> 召喚專屬角色</button><button id="btnUploadScene" class="bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 active:scale-95"><span class="text-lg">📸</span> 場景/道具參考圖</button></div>
            <div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div>
            <button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 rounded-xl font-black text-sm shadow-lg mt-auto active:scale-[0.98]">✅ 鎖定參數</button>
        </div>
    `);
    ui.querySelector('#btnSummonChar').onclick = () => triggerCharacterPicker(ui.querySelector('#dynamicAssetsArea'));
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.onchange=async(e)=>{if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea'))}; i.click(); };
    ui.querySelector('#btnAcceptVisual').onclick = async () => { if (!isMissionComplete()) return showError('請完成設定！'); releaseUI(ui); await triggerMissionSummary(); };
}

// 🌟 V0.27: 智慧過濾角色 (透過 type 欄位)
async function triggerCharacterPicker(container) {
    const existing = container.querySelector('.char-picker-panel'); if (existing) existing.remove();
    // 只顯示符合目前宇宙 (REALISTIC 或 COMIC) 的角色
    const available = SYSTEM_DB.characters.filter(c => c.type === MISSION.universe);
    
    if(available.length === 0) return showError(`您的基因庫目前沒有 ${MISSION.universe === 'COMIC' ? '動漫' : '真人'} 角色！請至系統設定新增。`);

    const panel = document.createElement('div'); panel.className = 'char-picker-panel bg-slate-900/30 rounded-xl border border-white/5 p-3 animate-fade-in';
    panel.innerHTML = `<div class="flex justify-between items-center mb-3"><span class="text-[10px] text-blue-400 font-bold uppercase">🧬 適合此宇宙的分身 (Max 4)</span><button id="btnConfirmBatch" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black active:scale-95">✅ 確認</button></div><div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar items-center" id="charGrid"></div>`;

    const grid = panel.querySelector('#charGrid'); let tempSelected = [...MISSION.characters];
    available.forEach(char => {
        const isSelected = tempSelected.includes(char.name);
        const card = document.createElement('div'); card.className = `flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer transition-all p-1 rounded-xl ${isSelected ? 'char-card-selected' : ''}`;
        card.innerHTML = `<div class="w-12 h-12 rounded-full border border-slate-700 overflow-hidden bg-slate-800"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[9px] font-bold text-slate-400">${char.name}</span>`;
        card.onclick = () => {
            if (tempSelected.includes(char.name)) { tempSelected = tempSelected.filter(n => n !== char.name); card.classList.remove('char-card-selected'); } 
            else { if (tempSelected.length >= 4) return showError('算力限制：單次最多 4 位。'); tempSelected.push(char.name); card.classList.add('char-card-selected'); }
        };
        grid.appendChild(card);
    });

    panel.querySelector('#btnConfirmBatch').onclick = async () => { MISSION.characters = tempSelected; const names = MISSION.characters.join('、'); await addLog("視覺工程師", "🧬", MISSION.characters.length > 0 ? `召喚確認：<b>${names}</b>。` : "已清空召喚名單。"); panel.remove(); };
    container.appendChild(panel);
}

async function handleAssetUpload(file, container) { if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in'; const dataUrl = await readFileAsDataURL(file); MISSION.sceneFiles = [{ file: file, dataUrl: dataUrl }]; panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 參考素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `載入圖資：<img src="${dataUrl}" class="w-8 h-8 rounded border border-slate-600 inline-block align-middle mx-1 object-cover">`); }

async function triggerMissionSummary() {
    IS_EDIT_MODE = false; updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "請確認清單。即將發送至雲端進行劇本創作：", true);

    const basePts = 15; const totalPts = basePts + MISSION.characters.length;
    let assetsHtml = '<div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[150px] justify-end">';
    MISSION.characters.forEach(c => { const o = SYSTEM_DB.characters.find(mc => mc.name === c); if(o) assetsHtml += `<img src="${o.imageUrl}" class="w-6 h-6 rounded-full border border-slate-500 flex-shrink-0">`; });
    if (MISSION.sceneFiles.length > 0) assetsHtml += `<img src="${MISSION.sceneFiles[0].dataUrl}" class="w-6 h-6 rounded border border-slate-500 object-cover flex-shrink-0">`;
    assetsHtml += '</div>';

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3"><span class="text-xs font-black text-blue-400">MISSION BRIEF</span><span class="text-[10px] text-slate-500">${APP_VERSION}</span></div>
            <div class="space-y-3 text-[11px]">
                <div class="flex justify-between"><span>🎭 人設</span><span class="text-white">${MISSION.persona}</span></div>
                <div class="flex justify-between"><span>🚀 平台</span><span class="text-white">${MISSION.platforms.join(', ')}</span></div>
                <div class="flex justify-between"><span>📝 主題</span><span class="text-white truncate max-w-[150px]">${MISSION.topic}</span></div>
                <div class="flex justify-between"><span>🌌 宇宙</span><span class="text-white">${MISSION.universe} / ${MISSION.style}</span></div>
                <div class="flex justify-between"><span>👥 角色素材</span><div>${assetsHtml}</div></div>
            </div>
            <button id="btnRender" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">⚡ 扣除 ${totalPts} 點發送指令</button>
        </div>
    `);

    ui.querySelector('#btnRender').onclick = async () => {
        releaseUI(ui);
        await addLog("首席文案", "⏳", `<div class="flex items-center gap-2"><div class="spinner"></div><span>正在為您產出腳本，請稍候...</span></div>`, true);

        // 🌟 V0.27: 完美封裝 Payload (包含特徵圖與角色設定)
        const referenceImages = [];
        
        MISSION.characters.forEach(name => {
            const charData = SYSTEM_DB.characters.find(c => c.name === name);
            if(charData) referenceImages.push({ type: 'character', name: name, imageUrl: charData.imageUrl });
        });

        MISSION.sceneFiles.forEach(sf => {
            referenceImages.push({ type: 'scene', data: sf.dataUrl });
        });

        const payload = {
            tenantId: STATE.uid,
            topic: MISSION.topic,
            isComicMode: MISSION.universe === 'COMIC',
            style: MISSION.style,
            platforms: MISSION.platforms,
            persona: MISSION.persona,
            // 角色陣列包入 persona，讓後端精準寫出對白
            characters: MISSION.characters.map(name => {
                const c = SYSTEM_DB.characters.find(x => x.name === name);
                return { name: name, persona: c ? c.persona : "" };
            }),
            image_options: { referenceImages: referenceImages }
        };

        try {
            const result = await API.createDraftAPI(payload);
            if (result.success) {
                STATE.userPoints -= totalPts;
                document.getElementById('userPoints').innerText = STATE.userPoints.toLocaleString();
                await addLog("首席文案", "✅", "劇本建立成功！已進入校稿階段。", true);
                
                // 🌟 觸發校稿總編室
                await renderDraftEditorCard(result.taskId, result.draftContent, result.isComicMode);
            } else throw new Error(result.message);
        } catch (e) { showError(`發送失敗：${e.message}`); }
    };
}

// 🌟 V0.27: 校稿總編室 UI
async function renderDraftEditorCard(taskId, draftContent, isComic) {
    let panelsHtml = '';
    if (isComic && draftContent.panels) {
        draftContent.panels.forEach((p, idx) => {
            panelsHtml += `
                <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2">
                    <div class="flex justify-between items-center"><span class="text-[9px] font-black text-indigo-400"># PANEL ${p.panel_number}</span></div>
                    <p class="text-[10px] text-slate-400 leading-tight italic">${p.action_zh}</p>
                    <input type="text" class="panel-dialogue w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white" value="${p.dialogue}" data-idx="${idx}">
                </div>
            `;
        });
    }

    const ui = createSkillUI(`
        <div class="space-y-4">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 space-y-3">
                <h3 class="text-xs font-black text-blue-400 uppercase tracking-widest">📝 貼文校稿總編室</h3>
                <div class="space-y-1">
                    <label class="text-[9px] text-slate-500 font-bold">社群內文 (Caption)</label>
                    <textarea id="editCaption" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-slate-200 min-h-[100px] focus:border-blue-500 focus:outline-none">${draftContent.post_caption}</textarea>
                </div>
                <div class="space-y-2">${panelsHtml}</div>
            </div>
            <button id="btnFinalGenerate" class="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">✨ 確認劇本，發包生圖</button>
        </div>
    `);

    ui.querySelector('#btnFinalGenerate').onclick = async () => {
        const editedCaption = ui.querySelector('#editCaption').value;
        const editedPanels = [];
        ui.querySelectorAll('.panel-dialogue').forEach(input => {
            const idx = input.dataset.idx;
            editedPanels.push({ panel_number: draftContent.panels[idx].panel_number, dialogue: input.value });
        });

        releaseUI(ui);
        await addLog("視覺工程師", "🎨", `<div class="flex items-center gap-2"><div class="spinner"></div><span>正在進行 AI 影像合成，這將花費較長時間，請稍候...</span></div>`, true);
        
        console.log("🚀 發包生圖 Payload:", { taskId, tenantId: STATE.uid, editedCaption, editedPanels });
        setTimeout(() => { addLog("系統", "🚧", "視覺合成模組介接中，敬請期待 V0.28！"); }, 3000);
    };
}

// 輔助工具與 Log (保持不變)
function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function createSkillUI(html) { const log = document.getElementById('funnelLog'); const oldActive = document.getElementById('activeControlCard'); if (oldActive) { oldActive.removeAttribute('id'); oldActive.querySelectorAll('button').forEach(b => b.disabled = true); const inputs = oldActive.querySelectorAll('input, textarea'); if(inputs) inputs.forEach(i => i.disabled = true); } const div = document.createElement('div'); div.className = 'skill-card ml-8 lg:ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6'; div.id = 'activeControlCard'; div.innerHTML = html; log.appendChild(div); scrollDown(); return div; }
function releaseUI(ui) { lockUI(ui); ui.removeAttribute('id'); ui.querySelectorAll('button').forEach(b => b.disabled = true); const inputs = ui.querySelectorAll('input, textarea'); if(inputs) inputs.forEach(i => i.disabled = true); }
async function addLog(role, icon, msg, skipTyping = false) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'flex items-start gap-3 lg:gap-4 animate-fade-in mb-4'; div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-3 lg:p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[90%] lg:max-w-[85%] shadow-md"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-xs lg:text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`; const activeCard = document.getElementById('activeControlCard'); if (activeCard) { log.insertBefore(div, activeCard); } else { log.appendChild(div); } scrollDown(); if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; } }
