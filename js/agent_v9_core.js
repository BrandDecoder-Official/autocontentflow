// js/agent_v9_core.js
import { STATE } from './config.js';

// 🌟 版本控制號
const APP_VERSION = "V0.2版";

// 🚀 任務卷宗 (漏斗數據中心)
const MISSION = {
    platforms: [],
    topic: '',
    universe: 'REALISTIC', // REALISTIC 或 COMIC
    style: '',             // 具體的風格代號
    ratio: '9:16',
    resolution: '1K',
    characters: [],
    sceneFiles: [],
    objectFiles: []
};

// 🌟 局部修改模式標記
let IS_EDIT_MODE = false;

// 🎭 假資料：風格宇宙對照表
const MOCK_STYLES = {
    REALISTIC: [
        { id: 'INFLUENCER', name: '網紅生活', icon: '📸', desc: '高顏值、自然光影' },
        { id: 'SUPERMODEL', name: '超模棚拍', icon: '✨', desc: '商業棚燈、高級感' },
        { id: 'PRODUCT', name: '商品情境', icon: '🛍️', desc: '特寫、質感凸顯' }
    ],
    COMIC: [
        { id: 'MANGA', name: '日系王道', icon: '🌸', desc: '經典賽璐璐上色' },
        { id: 'WEBTOON', name: '韓系條漫', icon: '📱', desc: '精緻唯美、高反差' },
        { id: 'AMERICAN', name: '美漫英雄', icon: '💥', desc: '粗曠線條、美式網點' }
    ]
};

// ==========================================
// 🚀 核心：初始化與流程控制
// ==========================================

export async function initAgentFunnel() {
    updateStepHeader("SYSTEM READY");
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = (STATE.userPoints || 0).toLocaleString();

    await addLog("專案總監", "👨‍💼", `${APP_VERSION} - 總編您好，全流程測試骨架已掛載。我們開始吧！`);
    await triggerPlatformSkill();
}

/**
 * 🛠️ Skill 1: 平台鎖定
 */
async function triggerPlatformSkill() {
    updateStepHeader("PLATFORM SELECTION");
    await addLog("社群總監", "🚀", "請決定本次任務的投遞平台：", true);
    
    const ui = createSkillUI(`
        <div class="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <button class="plat-btn border border-white/10 px-4 py-3 rounded-xl hover:bg-blue-600 transition-all text-xs font-bold ${MISSION.platforms.includes('FB') ? 'bg-blue-600' : ''}" data-val="FB">Facebook</button>
            <button class="plat-btn border border-white/10 px-4 py-3 rounded-xl hover:bg-pink-600 transition-all text-xs font-bold ${MISSION.platforms.includes('IG') ? 'bg-blue-600' : ''}" data-val="IG">Instagram</button>
            <button class="plat-btn border border-white/10 px-4 py-3 rounded-xl hover:bg-slate-700 transition-all text-xs font-bold ${MISSION.platforms.includes('THREADS') ? 'bg-blue-600' : ''}" data-val="THREADS">Threads</button>
            <button id="btnConfirmPlat" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg ml-auto">確認鎖定</button>
        </div>
    `);

    ui.querySelectorAll('.plat-btn').forEach(btn => btn.onclick = () => btn.classList.toggle('bg-blue-600'));

    ui.querySelector('#btnConfirmPlat').onclick = async () => {
        const selected = Array.from(ui.querySelectorAll('.plat-btn.bg-blue-600')).map(b => b.dataset.val);
        if (selected.length === 0) return alert('請至少選擇一個平台');
        
        MISSION.platforms = selected;
        lockUI(ui);
        await addLog("社群總監", "✅", `已鎖定平台：${selected.join(' / ')}。`);
        
        if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } 
        else { await unlockTopicInput(); }
    };
}

/**
 * 🛠️ Skill 2: 主題捕獲
 */
async function unlockTopicInput() {
    updateStepHeader("TOPIC CAPTURE");
    const input = document.getElementById('agentInput');
    const btn = document.getElementById('btnSend');

    await addLog("專案總監", "👨‍💼", "請在下方輸入框提供您的「貼文主題」。");
    
    input.disabled = false; input.classList.replace('input-locked', 'input-active');
    input.placeholder = "輸入主題...";
    if (MISSION.topic) input.value = MISSION.topic; 
    input.focus(); btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');

    btn.onclick = async () => {
        const val = input.value.trim();
        if(!val) return;
        MISSION.topic = val;
        input.value = ""; input.disabled = true; input.classList.replace('input-active', 'input-locked'); btn.disabled = true;

        await addLog("總編指令", "🗣️", val);
        
        if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } 
        else { await triggerUniverseSkill(); } // 🌟 進入宇宙選擇
    };
}

/**
 * 🛠️ Skill 3: 宇宙選擇 (真實 vs 動漫)
 */
async function triggerUniverseSkill() {
    updateStepHeader("UNIVERSE SELECTION");
    await addLog("美術總監", "🌌", "請選擇本次內容的視覺宇宙：", true);

    const ui = createSkillUI(`
        <div class="grid grid-cols-2 gap-3">
            <button class="uni-btn p-5 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC">
                <span class="text-3xl">📷</span>
                <span class="font-black text-sm text-white">真實攝影</span>
                <span class="text-[10px] text-slate-400">3D 人物與寫實場景</span>
            </button>
            <button class="uni-btn p-5 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC">
                <span class="text-3xl">🎨</span>
                <span class="font-black text-sm text-white">2D 動漫</span>
                <span class="text-[10px] text-slate-400">插畫與漫畫分鏡</span>
            </button>
        </div>
    `);

    ui.querySelectorAll('.uni-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.universe = btn.dataset.val;
            MISSION.style = ''; // 切換宇宙需重置風格
            lockUI(ui);
            await addLog("美術總監", "✅", `已鎖定「${MISSION.universe === 'REALISTIC' ? '真實攝影' : '2D 動漫'}」宇宙。正在調用專屬風格庫...`);
            await triggerStyleSkill(); // 🌟 連動到風格選擇
        };
    });
}

/**
 * 🛠️ Skill 4: 動態風格選擇
 */
async function triggerStyleSkill() {
    updateStepHeader("STYLE SELECTION");
    const styles = MOCK_STYLES[MISSION.universe];
    
    let styleHtml = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`;
    styles.forEach(s => {
        styleHtml += `
            <button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.id ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.id}" data-name="${s.name}">
                <span class="text-xl">${s.icon}</span>
                <span class="font-bold text-xs text-white">${s.name}</span>
                <span class="text-[9px] text-slate-400">${s.desc}</span>
            </button>
        `;
    });
    styleHtml += `</div>`;

    const ui = createSkillUI(styleHtml);

    ui.querySelectorAll('.style-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.style = btn.dataset.val;
            const styleName = btn.dataset.name;
            lockUI(ui);
            await addLog("美術總監", "✅", `風格鎖定為「${styleName}」。`);
            
            if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } 
            else { await triggerVisualSkill(); }
        };
    });
}

/**
 * 🛠️ Skill 5: 視覺決策中心 (微調參數與素材)
 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "參數配置已生成，您可以點擊標籤微調，或直接確認：", true);

    const ui = createSkillUI(`
        <div class="space-y-6">
            <div class="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/30">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="summaryTags">
                    <button onclick="window.quickEdit('RATIO')" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">比例</span>
                        <span class="text-xs font-black text-white tag-ratio">${MISSION.ratio}</span>
                    </button>
                    <button onclick="window.quickEdit('RES')" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">解析度</span>
                        <span class="text-xs font-black text-white tag-res">${MISSION.resolution}</span>
                    </button>
                </div>
            </div>

            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">
                <div class="space-y-3">
                    <label class="text-[10px] text-slate-500 font-black tracking-widest uppercase">選擇比例</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='9:16'?'bg-blue-600':''}" data-val="9:16">9:16</button>
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='16:9'?'bg-blue-600':''}" data-val="16:9">16:9</button>
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='1:1'?'bg-blue-600':''}" data-val="1:1">1:1</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <button id="btnSummonChar" class="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 py-4 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1">
                    <span class="text-lg">🧬</span> 召喚角色基因
                </button>
                <button id="btnUploadScene" class="bg-slate-800 hover:bg-slate-700 border border-white/10 py-4 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1">
                    <span class="text-lg">📸</span> 上傳場景圖
                </button>
            </div>

            <button id="btnAcceptVisual" class="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all">
                ✅ 鎖定參數
            </button>
        </div>
    `);

    window.quickEdit = (type) => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth' }); };
    
    ui.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val;
            ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600'));
            btn.classList.add('bg-blue-600');
            ui.querySelector('.tag-ratio').innerText = MISSION.ratio; 
        };
    });

    ui.querySelector('#btnSummonChar').onclick = async () => triggerCharacterPicker();
    ui.querySelector('#btnUploadScene').onclick = () => {
        const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
        input.onchange = (e) => handleAssetUpload(e.target.files); input.click();
    };

    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        lockUI(ui);
        if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } 
        else { await triggerMissionSummary(); }
    };
}

/**
 * 🛠️ Skill 6: 任務最終摘要 (JSON 確認)
 */
async function triggerMissionSummary() {
    updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "卷宗狀態更新完畢。請確認發布清單，點擊右側 ✎ 可回溯修改：", true);

    const universeLabel = MISSION.universe === 'REALISTIC' ? '真實攝影' : '2D動漫';
    const styleObj = MOCK_STYLES[MISSION.universe].find(s => s.id === MISSION.style);
    const styleName = styleObj ? styleObj.name : '未選擇';

    const summaryUI = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
                <span class="text-xs font-black text-blue-400">MISSION BRIEF</span>
                <span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">${APP_VERSION}</span>
            </div>
            
            <div class="space-y-3">
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('PLATFORM')">
                    <span class="text-xs text-slate-500">🚀 平台</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.platforms.join(', ')} ✎</span>
                </div>
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('TOPIC')">
                    <span class="text-xs text-slate-500">📝 主題</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400 truncate max-w-[150px]">${MISSION.topic} ✎</span>
                </div>
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('UNIVERSE')">
                    <span class="text-xs text-slate-500">🌌 視覺</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${universeLabel} / ${styleName} ✎</span>
                </div>
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('VISUAL')">
                    <span class="text-xs text-slate-500">📐 參數</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.ratio} / ${MISSION.resolution} ✎</span>
                </div>
                <div class="flex justify-between items-center p-2">
                    <span class="text-xs text-slate-500">👥 角色</span>
                    <span class="text-xs font-bold text-white">${MISSION.characters.length > 0 ? MISSION.characters.join(', ') : '未召喚'}</span>
                </div>
            </div>

            <button id="btnLaunch" class="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-black text-sm shadow-lg shadow-green-900/30 transition-all flex items-center justify-center gap-2 mt-2">
                <span>🚀 扣除點數並啟動發射</span>
            </button>
        </div>
    `);

    // 🌟 全域回溯功能
    window.retryStep = (step) => {
        IS_EDIT_MODE = true; 
        lockUI(summaryUI); 
        addLog("系統", "🔄", `進入編輯模式：展開「${step}」配置介面...`);
        
        if(step === 'PLATFORM') triggerPlatformSkill();
        if(step === 'TOPIC') unlockTopicInput();
        if(step === 'UNIVERSE') triggerUniverseSkill();
        if(step === 'VISUAL') triggerVisualSkill();
    };

    summaryUI.querySelector('#btnLaunch').onclick = async () => {
        lockUI(summaryUI);
        await executeMissionSim(); // 🌟 啟動假讀取條
    };
}

/**
 * 🛠️ Skill 7: 假執行進度條 (Execution Simulation)
 */
async function executeMissionSim() {
    updateStepHeader("EXECUTING DRAFT & RENDER");
    
    // 渲染進度條 UI
    const execUI = createSkillUI(`
        <div class="p-4 bg-slate-900 border border-white/10 rounded-2xl space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-blue-400 animate-pulse">系統算力運轉中...</span>
                <span id="simPercent" class="text-xs font-black text-white">0%</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div id="simBar" class="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" style="width: 0%"></div>
            </div>
            <div id="simStatus" class="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">Initiating API Request...</div>
        </div>
    `);

    const bar = execUI.querySelector('#simBar');
    const percent = execUI.querySelector('#simPercent');
    const status = execUI.querySelector('#simStatus');

    // 模擬異步 API 流程
    await new Promise(r => setTimeout(r, 1000));
    bar.style.width = '30%'; percent.innerText = '30%';
    status.innerText = '✍️ 首席文案正在編撰腳本...';
    await addLog("首席文案", "✍️", "腳本主架構已完成，正在置入社群 Hashtag...", true);

    await new Promise(r => setTimeout(r, 2000));
    bar.style.width = '70%'; percent.innerText = '70%';
    status.innerText = '🎨 美術總監正在進行算圖渲染...';
    await addLog("美術總監", "🎨", "參數對接成功，正在呼叫 Nano Banana 視覺引擎...", true);

    await new Promise(r => setTimeout(r, 2000));
    bar.style.width = '100%'; percent.innerText = '100%'; bar.classList.replace('bg-blue-500', 'bg-green-500');
    status.innerText = '✅ 任務大成功！';
    status.classList.replace('text-slate-400', 'text-green-400');

    await addLog("專案總監", "🎉", "總編，任務已圓滿達成！您可以檢視成果了。（此處將接上真實的發布畫面）");
}


// --- 素材與角色牆保持不變 ---
async function triggerCharacterPicker() {
    const charData = STATE.lastSystemData?.characters || [];
    const charDiv = document.createElement('div'); charDiv.className = 'skill-card flex gap-4 overflow-x-auto py-4 px-2 no-scrollbar mb-6';
    if (charData.length === 0) { charDiv.innerHTML = `<p class="text-xs text-slate-500 italic">基因庫尚無數據。</p>`; } 
    else {
        charData.forEach(char => {
            const card = document.createElement('div'); card.className = 'flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group';
            card.innerHTML = `<div class="w-14 h-14 rounded-full border-2 border-slate-700 group-hover:border-blue-500 transition-all overflow-hidden shadow-lg"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[10px] font-bold text-slate-400 group-hover:text-blue-400">${char.name}</span>`;
            card.onclick = async () => {
                if (!MISSION.characters.includes(char.name)) { MISSION.characters.push(char.name); await addLog("視覺工程師", "✅", `已召喚「${char.name}」基因。`); card.classList.add('opacity-40', 'pointer-events-none'); }
            };
            charDiv.appendChild(card);
        });
    }
    document.getElementById('funnelLog').appendChild(charDiv); scrollDown();
}

async function handleAssetUpload(files) {
    const previewDiv = document.createElement('div'); previewDiv.className = 'skill-card flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg mb-6';
    for (let file of files) {
        MISSION.sceneFiles.push(file); const reader = new FileReader();
        reader.onload = (e) => { previewDiv.innerHTML += `<div class="relative w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${e.target.result}" class="w-full h-full object-cover"></div>`; };
        reader.readAsDataURL(file);
    }
    document.getElementById('funnelLog').appendChild(previewDiv); await addLog("影像處理組", "📐", `成功載入 ${files.length} 張素材。`); scrollDown();
}

// --- 輔助工具 ---
function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function createSkillUI(html) {
    const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'skill-card ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6'; div.innerHTML = html; log.appendChild(div); scrollDown(); return div;
}
async function addLog(role, icon, msg, skipTyping = false) {
    const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'flex items-start gap-4 animate-fade-in mb-4';
    div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[85%]"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`;
    log.appendChild(div); scrollDown();
    if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; }
}
