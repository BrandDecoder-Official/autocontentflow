// js/agent_v9_core.js
import { STATE } from './config.js';

const APP_VERSION = "V0.18 體驗極致版";

const MISSION = {
    platforms: [], topic: '', universe: '', style: '', ratio: '9:16', resolution: '1K',
    characters: [], sceneFiles: [], scheduleMode: 'NOW', scheduleDate: '', scheduleTime: ''
};

let IS_EDIT_MODE = false;

const MOCK_STYLES = {
    REALISTIC: [
        { id: 'INFLUENCER', name: '網紅生活', icon: '📸', desc: '高顏值、自然光影' },
        { id: 'PRODUCT', name: '商業質感', icon: '🛍️', desc: '凸顯細節、色彩飽滿' },
        { id: 'VINTAGE', name: '復古底片', icon: '🎞️', desc: 'CCD質感、低重繪高保真' },
        { id: 'SKETCH', name: '結構素描', icon: '✏️', desc: '鉛筆線條、完美保留神韻' },
        { id: 'WATERCOLOR', name: '水彩油畫', icon: '🎨', desc: '藝術暈染、極致意境' },
        { id: '3D_TOY', name: '3D 盲盒', icon: '🧸', desc: '黏土公仔、社群爆發力高' }
    ],
    COMIC: [
        { id: 'MANGA_BW', name: '日系漫畫', icon: '✒️', desc: '經典網點、俐落墨線' },
        { id: 'WEBTOON', name: '韓系條漫', icon: '📱', desc: '精緻唯美、高飽和色彩' }
    ],
    ENHANCE: [
        { id: 'NATURAL', name: '自然清晰', icon: '🍃', desc: '去雜訊、提升畫質' },
        { id: 'STUDIO', name: '棚拍光影', icon: '✨', desc: '增強立體感、商業光影' }
    ]
};

const MOCK_CHARACTERS = [
    { name: '老K', type: 'REALISTIC', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=K&backgroundColor=b6e3f4' },
    { name: '艾莉', type: 'REALISTIC', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elly&backgroundColor=c0aede' },
    { name: '馬克', type: 'REALISTIC', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mark&backgroundColor=ffdfbf' },
    { name: '蘇菲', type: 'REALISTIC', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie&backgroundColor=d1d4f9' },
    { name: '米亞', type: 'COMIC', imageUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=ffdfbf' }
];

function isMissionComplete() {
    if (MISSION.platforms.length === 0 || !MISSION.topic || !MISSION.universe || !MISSION.style) return false;
    if (MISSION.universe === 'ENHANCE' && MISSION.sceneFiles.length === 0) return false; 
    return true;
}

async function showError(msg) {
    const log = document.getElementById('funnelLog'); const div = document.createElement('div');
    div.className = 'flex justify-center w-full my-2 animate-bounce';
    div.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"><span class="text-lg">🚨</span> <span>系統攔截：${msg}</span></div>`;
    log.appendChild(div); scrollDown();
}

function readFileAsDataURL(file) { return new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); }); }

export async function initAgentFunnel() {
    updateStepHeader("COMMAND LOBBY");
    const pointsEl = document.getElementById('userPoints'); if (pointsEl) pointsEl.innerText = (STATE.userPoints || 1250).toLocaleString();
    renderLobby();
}

function renderLobby() {
    const log = document.getElementById('funnelLog');
    log.innerHTML = `
        <div class="max-w-4xl mx-auto mt-4 lg:mt-10 animate-fade-in space-y-6">
            <div class="text-center space-y-2 mb-8">
                <h2 class="text-2xl lg:text-3xl font-black text-white tracking-tight">歡迎回到指揮艙，總編</h2>
                <p class="text-xs text-slate-400">目前運作品牌：<span class="text-blue-400 font-bold">BrandDecoder 官方</span> | 剩餘算力：<span class="text-yellow-400 font-bold">1,250 PTS</span></p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                <div class="bg-slate-800/50 border border-indigo-500/30 rounded-3xl p-6 lg:p-8 hover:bg-slate-800 transition-all cursor-pointer group shadow-xl relative flex flex-col h-full" onclick="alert('全自動情報網建置中，敬請期待後續更新！')">
                    <div class="absolute top-0 right-0 bg-indigo-600 text-[10px] font-black px-3 py-1 rounded-bl-xl tracking-widest uppercase">Auto-Pilot</div>
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">🤖</div>
                    <h3 class="text-lg font-black text-white mb-2">全自動情報偵測</h3>
                    <p class="text-xs text-slate-400 mb-6 leading-relaxed">Agent 根據您的品牌標籤與人設，24小時過濾新聞趨勢，主動撰寫發文草稿。</p>
                </div>
                <div class="bg-blue-600/10 border border-blue-500/50 rounded-3xl p-6 lg:p-8 transition-all cursor-pointer group shadow-[0_0_30px_rgba(59,130,246,0.15)] flex flex-col h-full active:scale-95" id="btnManualStart">
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">✍️</div>
                    <h3 class="text-lg font-black text-white mb-2">手動發起任務</h3>
                    <p class="text-xs text-slate-400 mb-6 leading-relaxed">進入專屬 AI 漏斗。親自指定平台、宇宙與角色，精準掌控每一篇貼文細節。</p>
                    <button class="mt-auto w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">🚀 啟動漏斗</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('btnManualStart').onclick = async () => { log.innerHTML = ''; MISSION.universe = ''; await addLog("專案總監", "👨‍💼", `${APP_VERSION} 漏斗啟動。星狀迴圈架構已部署。`); await triggerPlatformSkill(); };
}

async function triggerPlatformSkill() {
    updateStepHeader("PLATFORM SELECTION"); await addLog("社群總監", "🚀", "請決定本次任務的投遞平台：", true);
    const plats = [
        { id: 'FB', name: 'Facebook', activeColor: 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30' },
        { id: 'IG', name: 'Instagram', activeColor: 'bg-gradient-to-r from-purple-600 to-pink-600 border-pink-500 text-white shadow-lg shadow-pink-900/30' },
        { id: 'THREADS', name: 'Threads', activeColor: 'bg-black border-slate-500 text-white shadow-lg' }
    ];
    let btnsHtml = '';
    plats.forEach(p => {
        const isSelected = MISSION.platforms.includes(p.id);
        const baseClass = "plat-btn px-4 py-3 rounded-xl text-xs font-bold transition-all border active:scale-95";
        const stateClass = isSelected ? p.activeColor : "bg-slate-800 border-white/10 text-slate-400";
        const textStr = isSelected ? `${p.name} <span class="ml-1 text-white">✓</span>` : p.name;
        btnsHtml += `<button class="${baseClass} ${stateClass}" data-val="${p.id}" data-active="${p.activeColor}" data-name="${p.name}">${textStr}</button>`;
    });

    const ui = createSkillUI(`<div class="grid grid-cols-2 gap-2 sm:flex sm:gap-3">${btnsHtml}<button id="btnConfirmPlat" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg ml-auto active:scale-95 transition-all">確認鎖定</button></div>`);
    ui.querySelectorAll('.plat-btn').forEach(btn => {
        btn.onclick = () => {
            const val = btn.dataset.val; const rawName = btn.dataset.name; const activeClasses = btn.dataset.active.split(' ');
            if (MISSION.platforms.includes(val)) { MISSION.platforms = MISSION.platforms.filter(p => p !== val); btn.classList.remove(...activeClasses); btn.classList.add('bg-slate-800', 'border-white/10', 'text-slate-400'); btn.innerHTML = rawName; } 
            else { MISSION.platforms.push(val); btn.classList.remove('bg-slate-800', 'border-white/10', 'text-slate-400'); btn.classList.add(...activeClasses); btn.innerHTML = `${rawName} <span class="ml-1 text-white">✓</span>`; }
        };
    });
    ui.querySelector('#btnConfirmPlat').onclick = async () => { if (MISSION.platforms.length === 0) return showError('請至少選擇一個平台！'); lockUI(ui); await addLog("社群總監", "✅", `已鎖定平台：${MISSION.platforms.join(' / ')}。`); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else { await unlockTopicInput(); } };
}

async function unlockTopicInput() {
    updateStepHeader("TOPIC CAPTURE"); const input = document.getElementById('agentInput'); const btn = document.getElementById('btnSend'); await addLog("專案總監", "👨‍💼", "請在下方輸入框提供您的「貼文主題」。");
    input.disabled = false; input.classList.replace('input-locked', 'input-active'); input.placeholder = "輸入主題..."; if (MISSION.topic) input.value = MISSION.topic; input.focus(); btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');
    btn.onclick = async () => { const val = input.value.trim(); if(!val) return showError('主題不能為空！'); MISSION.topic = val; input.value = ""; input.disabled = true; input.classList.replace('input-active', 'input-locked'); btn.disabled = true; await addLog("總編指令", "🗣️", val); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerUniverseSkill(); } };
}

async function triggerUniverseSkill() {
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const ui = createSkillUI(`<div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC"><span class="text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC"><span class="text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-yellow-500 hover:bg-yellow-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'ENHANCE' ? 'border-yellow-500 bg-yellow-600/20' : 'bg-slate-800'}" data-val="ENHANCE"><span class="text-3xl">✨</span><span class="font-black text-xs text-white">無損美化原圖</span></button></div>`);
    ui.querySelectorAll('.uni-btn').forEach(btn => { btn.onclick = async () => { const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val; if (oldUni !== MISSION.universe) { MISSION.style = ''; MISSION.characters = []; MISSION.sceneFiles = []; MISSION.ratio = MISSION.universe === 'ENHANCE' ? '原圖比例' : '9:16'; } lockUI(ui); await addLog("美術總監", "✅", `切換至宇宙：${MISSION.universe}。`); await triggerStyleSkill(); }; });
}

async function triggerStyleSkill() {
    updateStepHeader("STYLE SELECTION"); const styles = MOCK_STYLES[MISSION.universe];
    let html = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">`; styles.forEach(s => { html += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.id ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.id}" data-name="${s.name}"><span class="text-xl">${s.icon}</span><span class="font-bold text-xs text-white">${s.name}</span><span class="text-[9px] text-slate-400">${s.desc}</span></button>`; }); html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.style-btn').forEach(btn => { btn.onclick = async () => { MISSION.style = btn.dataset.val; lockUI(ui); await addLog("美術總監", "✅", `風格鎖定：${btn.dataset.name}。`); if (IS_EDIT_MODE && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } }; });
}

async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG"); const isEnhance = MISSION.universe === 'ENHANCE';
    await addLog("美術總監", "👨‍🎨", isEnhance ? "美化模式：請上傳 1 張原圖。" : "請確認畫面參數。您可自由召喚角色（非必填，適合商品/純風景），或上傳參考場景：", true);
    document.querySelectorAll('.accept-visual-btn').forEach(btn => { btn.disabled = true; btn.classList.add('opacity-40'); btn.innerHTML = '🔒 已失效'; });
    const ui = createSkillUI(`
        <div class="space-y-4 lg:space-y-6 flex flex-col relative">
            <div class="bg-blue-600/10 p-4 lg:p-5 rounded-2xl border border-blue-500/30">
                <div class="grid grid-cols-2 gap-3">
                    <button ${isEnhance ? 'disabled' : `onclick="window.quickEdit('RATIO')"`} class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95 transition-transform ${isEnhance ? 'opacity-50' : ''}"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white tag-ratio">${MISSION.ratio}</span></button>
                    <button onclick="window.quickEdit('RES')" class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95 transition-transform"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white tag-res">${MISSION.resolution}</span></button>
                </div>
            </div>
            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">
                ${isEnhance ? '' : `<div class="space-y-3"><label class="text-[10px] text-slate-500 font-black">📐 比例</label><div class="grid grid-cols-3 gap-2"><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="9:16">9:16</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="16:9">16:9</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1:1">1:1</button></div></div>`}
                <div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">✨ 解析度</label><div class="grid grid-cols-3 gap-2"><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1K">1K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2K">2K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4K">4K</button></div></div>
            </div>
            <div class="grid grid-cols-2 gap-2 lg:gap-3">
                <button id="btnSummonChar" ${isEnhance ? 'disabled' : ''} class="bg-indigo-600/20 py-4 rounded-xl text-xs font-black border border-indigo-500/50 active:scale-95 transition-transform ${isEnhance ? 'opacity-30' : ''}"><span class="text-lg">🧬</span> 召喚角色(選填)</button>
                <button id="btnUploadScene" class="bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 active:scale-95 transition-colors"><span class="text-lg">📸</span> 參考場景圖</button>
            </div>
            <div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div>
            <button id="btnAcceptVisual" class="accept-visual-btn w-full bg-blue-600 active:bg-blue-500 py-4 lg:py-5 rounded-xl lg:rounded-2xl font-black text-sm shadow-lg mt-auto transition-colors active:scale-[0.98]">✅ 鎖定參數</button>
        </div>
    `);

    window.quickEdit = (type) => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth' }); };
    if (!isEnhance) {
        ui.querySelectorAll('.ratio-btn').forEach(btn => { if(btn.dataset.val === MISSION.ratio) btn.classList.add('bg-blue-600'); btn.onclick = () => { MISSION.ratio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = MISSION.ratio; }; });
        ui.querySelector('#btnSummonChar').onclick = async () => triggerCharacterPicker(ui.querySelector('#dynamicAssetsArea'));
    }
    ui.querySelectorAll('.res-btn').forEach(btn => { if(btn.dataset.val === MISSION.resolution) btn.classList.add('bg-blue-600'); btn.onclick = () => { MISSION.resolution = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = MISSION.resolution; }; });
    
    // 🌟 V0.18 修復上傳圖片關閉對話框時的跳轉失憶問題
    ui.querySelector('#btnUploadScene').onclick = () => { 
        let input = document.getElementById('hidden-file-input');
        if (!input) {
            input = document.createElement('input'); input.type = 'file'; input.id = 'hidden-file-input'; input.style.display = 'none';
            document.body.appendChild(input);
        }
        input.onchange = async (e) => { 
            if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea'), ui); 
            input.value = ''; 
        }; 
        input.click(); 
    };

    ui.querySelector('#btnAcceptVisual').onclick = async () => { if (!isMissionComplete()) { if (isEnhance) return showError('美化模式必須上傳 1 張原圖！'); else return showError('參數尚未完整設定！'); } lockUI(ui); await triggerMissionSummary(); };
}

async function triggerCharacterPicker(container) {
    const existing = container.querySelector('.char-picker-panel'); if (existing) existing.remove();
    const available = MOCK_CHARACTERS.filter(c => c.type === MISSION.universe);
    const panel = document.createElement('div'); panel.className = 'char-picker-panel bg-slate-900/30 rounded-xl border border-white/5 p-3 animate-fade-in';
    panel.innerHTML = `<div class="flex justify-between items-center mb-2"><span class="text-[10px] text-blue-400 font-bold uppercase">名單 (${MISSION.characters.length}/4)</span><span class="text-[10px] text-slate-500 cursor-pointer" onclick="window.openSystemSettings()">⚙️ 品牌後台</span></div>`;
    const list = document.createElement('div'); list.className = 'flex gap-4 overflow-x-auto pb-2 no-scrollbar items-center';
    available.forEach(char => {
        const isSelected = MISSION.characters.includes(char.name);
        const card = document.createElement('div'); card.className = `flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-90 ${isSelected ? 'opacity-50 ring-2 ring-blue-500 rounded-full' : ''}`;
        card.innerHTML = `<div class="w-12 h-12 rounded-full border-2 border-slate-700 overflow-hidden bg-slate-800"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[9px] font-bold text-slate-400">${char.name}</span>`;
        card.onclick = async () => { 
            if (MISSION.characters.includes(char.name)) return;
            if (MISSION.characters.length >= 4) return showError('算力限制：單次任務最多召喚 4 位角色。');
            MISSION.characters.push(char.name); card.classList.add('opacity-50', 'ring-2', 'ring-blue-500', 'rounded-full');
            await addLog("視覺工程師", "✅", `召喚確認 <img src="${char.imageUrl}" class="w-6 h-6 rounded-full inline-block align-middle border border-slate-600 mx-1"> <b>${char.name}</b>`);
            panel.querySelector('span').innerText = `名單 (${MISSION.characters.length}/4)`;
        }; list.appendChild(card);
    });
    panel.appendChild(list); container.appendChild(panel);
}

// 🌟 V0.18 修復往上彈跳 Bug：精準定位，不亂用全域 Selector
async function handleAssetUpload(file, container, parentUI) {
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove();
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in';
    const dataUrl = await readFileAsDataURL(file); MISSION.sceneFiles = [{ file: file, dataUrl: dataUrl }];
    panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 鎖定場景素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`;
    container.appendChild(panel); 
    
    // addLog 本身就會做 scrollDown 到最底下，移除多餘的 scrollIntoView
    await addLog("影像處理組", "📐", `載入場景圖：<img src="${dataUrl}" class="w-8 h-8 rounded border border-slate-600 inline-block align-middle mx-1 object-cover">`);
    
    // 如果真要捲動，只捲動當下這張卡片的按鈕
    if(parentUI) {
        const btn = parentUI.querySelector('.accept-visual-btn');
        if(btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

async function triggerMissionSummary() {
    IS_EDIT_MODE = false; updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "請確認發布清單。所有欄位皆可點擊修改，無誤後請進行排程或生成：", true);

    const uniMap = { 'REALISTIC': '真實攝影', 'COMIC': '2D動漫', 'ENHANCE': '無損美化' };
    const st = MOCK_STYLES[MISSION.universe].find(s => s.id === MISSION.style);
    const basePts = 15; const extraPts = MISSION.universe === 'ENHANCE' ? 0 : MISSION.characters.length; const totalPts = basePts + extraPts;

    let assetsHtml = '<div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[140px] lg:max-w-[200px] justify-end">';
    MISSION.characters.forEach(c => { const o = MOCK_CHARACTERS.find(mc => mc.name === c); if(o) assetsHtml += `<img src="${o.imageUrl}" class="w-6 h-6 rounded-full border border-slate-500 flex-shrink-0">`; });
    if (MISSION.sceneFiles.length > 0) { if(MISSION.characters.length > 0) assetsHtml += '<span class="text-slate-600 mx-1">|</span>'; assetsHtml += `<img src="${MISSION.sceneFiles[0].dataUrl}" class="w-6 h-6 rounded border border-slate-500 object-cover flex-shrink-0">`; }
    assetsHtml += '</div>';
    if (MISSION.characters.length === 0 && MISSION.sceneFiles.length === 0) { assetsHtml = '<span class="text-[10px] lg:text-xs text-orange-400 font-bold border-b border-dashed border-orange-400">尚未召喚角色，如要使用請點擊選取</span>'; }

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-2xl space-y-4 relative">
            <div class="flex justify-between items-center border-b border-white/10 pb-3"><span class="text-xs lg:text-sm font-black text-blue-400">MISSION BRIEF</span><span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">${APP_VERSION}</span></div>
            <div class="space-y-3">
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors" onclick="window.retryStep('PLATFORM')"><span class="text-[11px] lg:text-xs text-slate-500">🚀 平台</span><span class="text-[11px] lg:text-xs font-bold text-white flex items-center gap-1">${MISSION.platforms.join(', ')} <span class="text-[10px] text-blue-400">✎</span></span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors" onclick="window.retryStep('TOPIC')"><span class="text-[11px] lg:text-xs text-slate-500">📝 主題</span><span class="text-[11px] lg:text-xs font-bold text-white truncate max-w-[120px] lg:max-w-[200px] flex items-center gap-1">${MISSION.topic} <span class="text-[10px] text-blue-400">✎</span></span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors" onclick="window.retryStep('UNIVERSE')"><span class="text-[11px] lg:text-xs text-slate-500">🌌 視覺</span><span class="text-[11px] lg:text-xs font-bold text-white flex items-center gap-1">${uniMap[MISSION.universe]} / ${st ? st.name : ''} <span class="text-[10px] text-blue-400">✎</span></span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors" onclick="window.retryStep('VISUAL')"><span class="text-[11px] lg:text-xs text-slate-500">📐 參數</span><span class="text-[11px] lg:text-xs font-bold text-white flex items-center gap-1">${MISSION.ratio} / ${MISSION.resolution} <span class="text-[10px] text-blue-400">✎</span></span></div>
                <div class="flex justify-between items-center cursor-pointer p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors" onclick="window.retryStep('VISUAL')"><span class="text-[11px] lg:text-xs text-slate-500">👥 角色/素材</span><div class="flex items-center gap-2">${assetsHtml} <span class="text-[10px] text-blue-400">✎</span></div></div>
            </div>
            <div class="pt-4 border-t border-white/10">
                <div class="flex justify-between items-center mb-3"><span class="text-[10px] text-indigo-400 font-black uppercase">📅 排程狀態</span><span id="schDisplay" class="text-xs font-bold text-slate-400">立即發布 (NOW)</span></div>
                <div class="flex gap-2">
                    <button id="btnOpenSch" class="flex-1 bg-slate-800 text-slate-300 hover:text-white border border-white/10 py-3 rounded-xl text-xs font-bold transition-colors active:scale-95">🕒 設定排程</button>
                    <button id="btnRender" class="flex-[2] bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-black text-xs lg:text-sm text-white shadow-lg shadow-blue-900/30 transition-colors active:scale-95">⚡ 扣除 ${totalPts} 點並生成</button>
                </div>
            </div>
        </div>
    `);

    window.retryStep = (step) => { IS_EDIT_MODE = true; lockUI(ui); addLog("系統", "🔄", `進入編輯模式...`); if(step === 'PLATFORM') triggerPlatformSkill(); if(step === 'TOPIC') unlockTopicInput(); if(step === 'UNIVERSE') triggerUniverseSkill(); if(step === 'VISUAL') triggerVisualSkill(); };
    ui.querySelector('#btnOpenSch').onclick = () => openScheduleModal(ui);
    ui.querySelector('#btnRender').onclick = async () => { lockUI(ui); await addLog("首席文案", "✍️", "資料封裝完成。啟動社群文案編撰與視覺引擎...", true); };
}

function openScheduleModal(summaryUI) {
    const modal = document.getElementById('scheduleModal'); const panel = document.getElementById('schedulePanel');
    const defaultDate = MISSION.scheduleDate || "today"; const defaultTime = MISSION.scheduleTime || "12:00 PM";

    panel.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-black text-white tracking-widest uppercase">時間指揮艙</h3>
            <button onclick="closeScheduleModal()" class="text-slate-400 hover:text-white p-1 bg-slate-700 rounded-full">✕</button>
        </div>
        <div class="space-y-4">
            <div>
                <p class="text-[10px] text-slate-400 font-bold mb-1">選擇日期 (Date)</p>
                <input type="text" id="flatpickr-input" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 text-center cursor-pointer shadow-inner" readonly>
            </div>
            <div>
                <p class="text-[10px] text-slate-400 font-bold mb-1">選擇時間 (Time)</p>
                <div class="timepicker-ui" id="timepicker-container">
                    <input type="text" class="timepicker-ui-input w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 text-center cursor-pointer shadow-inner" value="${defaultTime}" readonly>
                </div>
            </div>
            <div class="flex gap-2 pt-2">
                <button id="btnSchNow" class="flex-1 bg-slate-700 text-white py-3 rounded-xl text-xs font-bold active:scale-95 transition-transform">取消排程 (NOW)</button>
                <button id="btnConfirmSch" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-transform">✅ 確認寫入</button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden'); setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10);
    
    const fp = flatpickr("#flatpickr-input", { minDate: "today", theme: "dark", dateFormat: "Y-m-d", defaultDate: defaultDate });
    const timepickerEl = document.querySelector('.timepicker-ui');
    const tui = new window.tui.TimepickerUI(timepickerEl, { theme: 'dark', clockType: '12h', mobile: window.innerWidth < 1024, incrementMinutes: 15 });
    tui.create();

    // 🌟 V0.18 核心：MutationObserver 動態隱藏不必要的分鐘刻度
    const observer = new MutationObserver(() => {
        const hideList = ['05', '10', '20', '25', '35', '40', '50', '55'];
        // 選取圓盤內可能生成的所有數字節點
        const clockNodes = panel.querySelectorAll('.timepicker-ui-clock-face__number, span, div');
        clockNodes.forEach(node => {
            if (hideList.includes(node.innerText.trim())) {
                node.style.opacity = '0'; // 物理隱藏
                node.style.pointerEvents = 'none'; // 避免誤觸
            }
        });
    });
    // 監聽整個時間容器的 DOM 變化 (包含圓盤滑入的瞬間)
    observer.observe(panel.querySelector('#timepicker-container'), { childList: true, subtree: true, attributes: true });

    panel.querySelector('#btnConfirmSch').onclick = () => {
        const d = document.getElementById('flatpickr-input').value; const t = document.querySelector('.timepicker-ui-input').value;
        if (!d || !t) return showError("請完整選擇日期與時間");
        MISSION.scheduleMode = 'LATER'; MISSION.scheduleDate = d; MISSION.scheduleTime = t;
        summaryUI.querySelector('#schDisplay').innerText = `預約: ${d} ${t}`; summaryUI.querySelector('#schDisplay').classList.replace('text-slate-400', 'text-green-400');
        summaryUI.querySelector('#btnRender').innerText = `⚡ 扣點算圖，並加入佇列`; window.closeScheduleModal();
    };
    panel.querySelector('#btnSchNow').onclick = () => {
        MISSION.scheduleMode = 'NOW'; MISSION.scheduleDate = ''; MISSION.scheduleTime = '';
        summaryUI.querySelector('#schDisplay').innerText = `立即發布 (NOW)`; summaryUI.querySelector('#schDisplay').classList.replace('text-green-400', 'text-slate-400');
        summaryUI.querySelector('#btnRender').innerText = `⚡ 扣點並立即生成`; window.closeScheduleModal();
    };
}

function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function createSkillUI(html) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'skill-card ml-8 lg:ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6'; div.innerHTML = html; log.appendChild(div); scrollDown(); return div; }
async function addLog(role, icon, msg, skipTyping = false) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'flex items-start gap-3 lg:gap-4 animate-fade-in mb-4'; div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-3 lg:p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[90%] lg:max-w-[85%] shadow-md"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-xs lg:text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`; log.appendChild(div); scrollDown(); if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; } }
