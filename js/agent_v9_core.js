// js/agent_v9_core.js
import { STATE } from './config.js';
import * as API from './api.js'; 

const APP_VERSION = "V0.26 數據貫通版";

const MISSION = { persona: '', platforms: [], topic: '', universe: '', style: '', ratio: '9:16', resolution: '1K', characters: [], sceneFiles: [], scheduleMode: 'NOW', scheduleDate: '', scheduleTime: '' };
let IS_EDIT_MODE = false;

// 🌟 V0.26 全域資料暫存庫 (取代原本的 MOCK 資料)
export const SYSTEM_DB = {
    styles: [],      
    characters: [],  
    personas: [ // Persona 後端目前沒提供，保留前端彈性陣列
        { id: 'HUMOR', name: '幽默酸民', icon: '🤡', desc: '時事嘲諷、網路迷因語氣' },
        { id: 'PRO', name: '專業權威', icon: '💼', desc: '數據導向、菁英分析觀點' },
        { id: 'WARM', name: '溫暖知性', icon: '☕', desc: '心靈雞湯、柔和共鳴語氣' }
    ]
};

// 🌟 V0.26 啟動時的資料同步
export async function bootSystemData() {
    try {
        const result = await API.fetchSystemOptionsAPI(STATE.uid);
        if(result.success && result.data) {
            // 將後端陣列存入前端全域變數
            SYSTEM_DB.styles = result.data.styles || [];
            SYSTEM_DB.characters = result.data.characters || [];
            document.getElementById('charCountLabel').innerText = `已擁有 ${SYSTEM_DB.characters.length} 組角色模型`;
            console.log("✅ 雲端基因庫同步完成", SYSTEM_DB);
        }
    } catch(e) { console.error("同步資料失敗", e); }
}

function isMissionComplete() {
    if (!MISSION.persona || MISSION.platforms.length === 0 || !MISSION.topic || !MISSION.universe || !MISSION.style) return false;
    if (MISSION.universe === 'ENHANCE' && MISSION.sceneFiles.length === 0) return false; 
    return true;
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
// 漏斗流程 (Funnel Flow)
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
    // 🌟 V0.26 動態過濾資料庫裡的 Styles (這裡假設後端吐回來的都是可以用的風格，或是您可自訂過濾條件)
    const availableStyles = SYSTEM_DB.styles.length > 0 ? SYSTEM_DB.styles : [{id: 'MANGA_BW', name: '預設漫畫風格', desc: '資料庫無可用風格'}];
    
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
                <div class="grid grid-cols-2 gap-3"><button onclick="window.quickEdit('RATIO')" class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white tag-ratio">${currentRatio}</span></button><button onclick="window.quickEdit('RES')" class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white tag-res">${currentRes}</span></button></div>
            </div>
            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10">...</div>
            <div class="grid grid-cols-2 gap-2"><button id="btnSummonChar" class="bg-indigo-600/20 py-4 rounded-xl text-xs font-black border border-indigo-500/50 active:scale-95"><span class="text-lg">🧬</span> 召喚專屬角色</button><button id="btnUploadScene" class="bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 active:scale-95"><span class="text-lg">📸</span> 場景參考圖</button></div>
            <div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div>
            <button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 rounded-xl font-black text-sm shadow-lg mt-auto active:scale-[0.98]">✅ 鎖定參數</button>
        </div>
    `);

    ui.querySelector('#btnSummonChar').onclick = async () => triggerCharacterPicker(ui.querySelector('#dynamicAssetsArea'));
    ui.querySelector('#btnUploadScene').onclick = () => { let input = document.createElement('input'); input.type = 'file'; input.onchange = async (e) => { if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea')); }; input.click(); };
    ui.querySelector('#btnAcceptVisual').onclick = async () => { MISSION.ratio = currentRatio; MISSION.resolution = currentRes; if (!isMissionComplete()) return showError('請完成設定！'); releaseUI(ui); await triggerMissionSummary(); };
}

// 🌟 V0.26 動態渲染角色召喚面板
async function triggerCharacterPicker(container) {
    const existing = container.querySelector('.char-picker-panel'); if (existing) existing.remove();
    const available = SYSTEM_DB.characters; // 直接讀取剛才抓下來的真實資料
    
    if(available.length === 0) return showError('您的基因庫空空如也，請先至系統設定新增角色！');

    const panel = document.createElement('div'); panel.className = 'char-picker-panel bg-slate-900/30 rounded-xl border border-white/5 p-3 animate-fade-in';
    panel.innerHTML = `<div class="flex justify-between items-center mb-3"><span class="text-[10px] text-blue-400 font-bold uppercase">🧬 您的雲端分身 (Max 4)</span><button id="btnConfirmBatch" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black active:scale-95">✅ 確認</button></div><div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar items-center" id="charGrid"></div>`;

    const grid = panel.querySelector('#charGrid'); let tempSelected = [...MISSION.characters];
    available.forEach(char => {
        const isSelected = tempSelected.includes(char.name);
        const card = document.createElement('div'); card.className = `flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer transition-all p-1 rounded-xl ${isSelected ? 'char-card-selected' : ''}`;
        card.innerHTML = `<div class="w-12 h-12 rounded-full border border-slate-700 overflow-hidden bg-slate-800"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[9px] font-bold text-slate-400">${char.name}</span>`;
        card.onclick = () => { if (tempSelected.includes(char.name)) { tempSelected = tempSelected.filter(n => n !== char.name); card.classList.remove('char-card-selected'); } else { if (tempSelected.length >= 4) return showError('算力限制：單次最多 4 位。'); tempSelected.push(char.name); card.classList.add('char-card-selected'); } };
        grid.appendChild(card);
    });

    panel.querySelector('#btnConfirmBatch').onclick = async () => { MISSION.characters = tempSelected; const names = MISSION.characters.join('、'); await addLog("視覺工程師", "🧬", MISSION.characters.length > 0 ? `召喚確認：<b>${names}</b>。` : "已清空召喚名單。"); panel.remove(); };
    container.appendChild(panel);
}

async function handleAssetUpload(file, container) {
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove();
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in';
    const dataUrl = await readFileAsDataURL(file); MISSION.sceneFiles = [{ file: file, dataUrl: dataUrl }];
    panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 參考素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`;
    container.appendChild(panel); await addLog("影像處理組", "📐", `載入圖資：<img src="${dataUrl}" class="w-8 h-8 rounded border border-slate-600 inline-block align-middle mx-1 object-cover">`);
}

async function triggerMissionSummary() {
    IS_EDIT_MODE = false; updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "請確認清單。點擊 ✎ 可隨時發起反悔修正：", true);

    const basePts = 15; const extraPts = MISSION.characters.length; const totalPts = basePts + extraPts;
    let assetsHtml = '<div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[150px] justify-end">';
    MISSION.characters.forEach(c => { const o = SYSTEM_DB.characters.find(mc => mc.name === c); if(o) assetsHtml += `<img src="${o.imageUrl}" class="w-6 h-6 rounded-full border border-slate-500 flex-shrink-0">`; });
    if (MISSION.sceneFiles.length > 0) assetsHtml += `<img src="${MISSION.sceneFiles[0].dataUrl}" class="w-6 h-6 rounded border border-slate-500 object-cover flex-shrink-0">`;
    assetsHtml += '</div>';

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3"><span class="text-xs font-black text-blue-400">MISSION BRIEF</span><span class="text-[10px] text-slate-500">${APP_VERSION}</span></div>
            <div class="space-y-3">
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5" onclick="window.retryStep('PERSONA')"><span class="text-[11px] text-slate-500">🎭 人設</span><span class="text-[11px] font-bold text-white">${MISSION.persona} ✎</span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5" onclick="window.retryStep('PLATFORM')"><span class="text-[11px] text-slate-500">🚀 平台</span><span class="text-[11px] font-bold text-white">${MISSION.platforms.join(', ')} ✎</span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5" onclick="window.retryStep('TOPIC')"><span class="text-[11px] text-slate-500">📝 主題</span><span class="text-[11px] font-bold text-white truncate max-w-[120px]">${MISSION.topic} ✎</span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5" onclick="window.retryStep('UNIVERSE')"><span class="text-[11px] text-slate-500">🌌 視覺</span><span class="text-[11px] font-bold text-white">${MISSION.universe} / ${MISSION.style} ✎</span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5" onclick="window.retryStep('VISUAL')"><span class="text-[11px] text-slate-500">👥 角色/素材</span><div class="flex items-center gap-2">${assetsHtml} <span class="text-[10px] text-blue-400 font-bold">✎</span></div></div>
            </div>
            <div class="pt-4 border-t border-white/10">
                <div class="flex justify-between items-center mb-3"><span class="text-[10px] text-indigo-400 font-black uppercase">📅 排程</span><span id="schDisplay" class="text-xs font-bold text-slate-400">立即發布 (NOW)</span></div>
                <div class="flex gap-2">
                    <button id="btnOpenSch" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all">🕒 排程</button>
                    <button id="btnRender" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">⚡ 扣除 ${totalPts} 點生成</button>
                </div>
            </div>
        </div>
    `);

    window.retryStep = async (step) => { IS_EDIT_MODE = true; releaseUI(ui); await addLog("系統", "🔄", `啟動修改卡片...`); if(step === 'PERSONA') await triggerPersonaSkill(); if(step === 'PLATFORM') await triggerPlatformSkill(); if(step === 'TOPIC') await triggerTopicSkill(); if(step === 'UNIVERSE') await triggerUniverseSkill(); if(step === 'VISUAL') await triggerVisualSkill(); };
    ui.querySelector('#btnOpenSch').onclick = () => alert("排程模組");
    
    ui.querySelector('#btnRender').onclick = async () => {
        releaseUI(ui); 
        await addLog("首席文案", "⏳", `<div class="flex items-center gap-2"><div class="spinner"></div><span>正在與雲端 AI 引擎同步運算中，請稍候...</span></div>`, true);
        
        const payload = {
            tenantId: STATE.uid, topic: MISSION.topic, isComicMode: MISSION.universe === 'COMIC',
            style: MISSION.style, platforms: MISSION.platforms, persona: MISSION.persona,
            // 🌟 這裡把名字轉成後端要的 [{name: 'xxx'}]
            characters: MISSION.characters.map(name => ({ name: name })),
            image_options: { referenceImages: MISSION.sceneFiles.map(sf => ({ mimeType: 'image/jpeg', data: sf.dataUrl })) }
        };

        try {
            const result = await API.createDraftAPI(payload);
            if (result.success) {
                // 🌟 V0.26 即時扣點 UI 互動 (預扣)
                STATE.userPoints -= totalPts;
                const ptEl = document.getElementById('userPoints');
                ptEl.innerText = STATE.userPoints.toLocaleString();
                ptEl.classList.add('text-red-400', 'scale-110');
                setTimeout(() => ptEl.classList.remove('text-red-400', 'scale-110'), 1000);

                await addLog("首席文案", "✅", `<div class="space-y-2"><p class="font-bold text-green-400">草稿建立成功！(TaskID: ${result.taskId})</p><div class="bg-slate-900 p-3 rounded-lg border border-white/5 text-[10px] text-slate-300 max-h-32 overflow-y-auto"><pre>${JSON.stringify(result.draftContent, null, 2)}</pre></div><button class="w-full bg-green-600 text-white py-2 rounded-lg font-bold shadow-lg mt-2">繼續生成影像 (下一版實作)</button></div>`, true);
            } else throw new Error(result.message || '未知錯誤');
        } catch (error) { showError(`發送失敗：${error.message}`); }
    };
}


// ==========================================
// 🧬 V0.26 角色基因庫管理系統 (CRUD)
// ==========================================
let tempCharBase64 = null;

window.openCharManager = function() {
    const modal = document.getElementById('charManageModal');
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10);
    renderCharGrid();
};
window.closeCharManager = function() {
    const modal = document.getElementById('charManageModal');
    modal.classList.remove('show'); setTimeout(() => { modal.classList.add('hidden'); }, 300);
    window.cancelNewChar();
};

function renderCharGrid() {
    const grid = document.getElementById('charGridContainer');
    grid.innerHTML = '';
    if(SYSTEM_DB.characters.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-sm text-slate-500 py-10">尚無角色，請立即註冊第一位視覺分身！</div>`;
        return;
    }
    SYSTEM_DB.characters.forEach(char => {
        grid.innerHTML += `
            <div class="bg-slate-800 rounded-xl border border-white/10 p-3 flex flex-col items-center gap-2 relative group">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div>
                <div class="text-center w-full"><p class="text-xs font-bold text-white truncate">${char.name}</p><p class="text-[9px] text-slate-400 truncate w-full" title="${char.aiExtractedFeatures}">${char.aiExtractedFeatures || '特徵分析中...'}</p></div>
                <button onclick="window.deleteChar('${char.id}')" class="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            </div>
        `;
    });
}

window.openNewCharForm = function() { document.getElementById('newCharForm').classList.remove('hidden'); document.getElementById('btnAddNewCharContainer').classList.add('hidden'); };
window.cancelNewChar = function() { document.getElementById('newCharForm').classList.add('hidden'); document.getElementById('btnAddNewCharContainer').classList.remove('hidden'); document.getElementById('charPreviewEmpty').classList.remove('hidden'); document.getElementById('charPreviewImg').classList.add('hidden'); document.getElementById('newCharName').value = ''; document.getElementById('newCharPersona').value = ''; tempCharBase64 = null; };

window.handleCharPhotoSelect = async function(e) {
    const file = e.target.files[0]; if(!file) return;
    tempCharBase64 = await readFileAsDataURL(file);
    document.getElementById('charPreviewEmpty').classList.add('hidden');
    const img = document.getElementById('charPreviewImg'); img.src = tempCharBase64; img.classList.remove('hidden');
};

window.submitNewChar = async function() {
    const name = document.getElementById('newCharName').value.trim();
    const persona = document.getElementById('newCharPersona').value.trim();
    if(!name || !tempCharBase64) return alert('請提供照片與角色名稱！');

    const btn = document.getElementById('btnSubmitNewChar'); btn.innerHTML = '<div class="spinner"></div> 分析中...'; btn.disabled = true;

    try {
        const payload = { tenantId: STATE.uid, name, persona, imageBase64: tempCharBase64, mimeType: 'image/jpeg' };
        const res = await API.createCharacterAPI(payload);
        if(res.success) {
            alert('🎉 角色註冊成功！');
            await bootSystemData(); // 重新抓取 DB 刷新前端
            window.cancelNewChar(); renderCharGrid();
        } else throw new Error(res.message);
    } catch(e) { alert(`❌ 失敗: ${e.message}`); }
    finally { btn.innerHTML = '上傳並萃取基因'; btn.disabled = false; }
};

window.deleteChar = async function(charId) {
    if(!confirm('確定要永久刪除此角色嗎？')) return;
    try {
        const res = await API.deleteCharacterAPI({ charId, tenantId: STATE.uid });
        if(res.success) { await bootSystemData(); renderCharGrid(); } else throw new Error(res.message);
    } catch(e) { alert(`❌ 刪除失敗: ${e.message}`); }
};

// ==========================================
// 📜 V0.26 動態抓取算力歷史 (Audit Logs)
// ==========================================
window.refreshAuditLogs = async function() {
    const container = document.getElementById('auditLogsContainer');
    container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4"><div class="spinner inline-block align-middle mr-2"></div> 讀取中...</div>';
    try {
        const res = await API.fetchAuditLogsAPI(STATE.uid);
        if(res.success && res.logs.length > 0) {
            container.innerHTML = '';
            res.logs.forEach(log => {
                const isDeduct = log.actionType.includes('GENERATE') || log.actionType.includes('PUBLISH');
                const ptClass = isDeduct ? 'text-red-400' : 'text-green-400';
                const sign = isDeduct ? '-' : '+';
                const pts = log.pointsDeducted || Math.abs(log.pointsChanged) || 0;
                
                container.innerHTML += `
                    <div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg text-[11px] mb-2">
                        <div><p class="text-white font-bold">${log.actionType}</p><p class="text-slate-500">${new Date(log.createdAt).toLocaleString('zh-TW')}</p></div>
                        <span class="${ptClass} font-bold">${sign} ${pts} PTS</span>
                    </div>
                `;
            });
        } else { container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4">目前尚無扣點紀錄。</div>'; }
    } catch(e) { container.innerHTML = `<div class="text-center text-xs text-red-400 py-4">讀取失敗：${e.message}</div>`; }
};

// 工具函數：更新 Header 與滾動
function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function createSkillUI(html) { const log = document.getElementById('funnelLog'); const oldActive = document.getElementById('activeControlCard'); if (oldActive) { oldActive.removeAttribute('id'); oldActive.querySelectorAll('button').forEach(b => b.disabled = true); const inputs = oldActive.querySelectorAll('input, textarea'); if(inputs) inputs.forEach(i => i.disabled = true); } const div = document.createElement('div'); div.className = 'skill-card ml-8 lg:ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6'; div.id = 'activeControlCard'; div.innerHTML = html; log.appendChild(div); scrollDown(); return div; }
function releaseUI(ui) { lockUI(ui); ui.removeAttribute('id'); ui.querySelectorAll('button').forEach(b => b.disabled = true); const inputs = ui.querySelectorAll('input, textarea'); if(inputs) inputs.forEach(i => i.disabled = true); }
async function addLog(role, icon, msg, skipTyping = false) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'flex items-start gap-3 lg:gap-4 animate-fade-in mb-4'; div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-3 lg:p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[90%] lg:max-w-[85%] shadow-md"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-xs lg:text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`; const activeCard = document.getElementById('activeControlCard'); if (activeCard) { log.insertBefore(div, activeCard); } else { log.appendChild(div); } scrollDown(); if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; } }
