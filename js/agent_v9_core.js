// js/agent_v9_core.js
import { STATE } from './config.js';

// 🌟 版本控制號 (每次修改都會在此更新)
const APP_VERSION = "V0.1版";

// 🚀 任務卷宗 (漏斗數據中心)
const MISSION = {
    platforms: [],
    topic: '',
    styleMode: 'INFLUENCER',
    ratio: '9:16',
    resolution: '1K',
    characters: [],
    sceneFiles: [],
    objectFiles: []
};

// 🌟 判斷是否為「局部修改模式」
let IS_EDIT_MODE = false;

// ==========================================
// 🚀 核心：初始化與流程控制
// ==========================================

export async function initAgentFunnel() {
    updateStepHeader("SYSTEM READY");
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = (STATE.userPoints || 0).toLocaleString();

    // 🌟 歡迎文字加入版本號
    await addLog("專案總監", "👨‍💼", `${APP_VERSION} - 總編您好，任務引擎已就緒。我們將依序鎖定平台、主題與視覺配置。`);
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

    ui.querySelectorAll('.plat-btn').forEach(btn => {
        btn.onclick = () => btn.classList.toggle('bg-blue-600');
    });

    ui.querySelector('#btnConfirmPlat').onclick = async () => {
        const selected = Array.from(ui.querySelectorAll('.plat-btn.bg-blue-600')).map(b => b.dataset.val);
        if (selected.length === 0) return alert('請至少選擇一個平台');
        
        MISSION.platforms = selected;
        lockUI(ui);
        await addLog("社群總監", "✅", `已鎖定平台：${selected.join(' / ')}。`);
        
        if (IS_EDIT_MODE) {
            IS_EDIT_MODE = false;
            await triggerMissionSummary();
        } else {
            await unlockTopicInput();
        }
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
    
    input.disabled = false;
    input.classList.replace('input-locked', 'input-active');
    input.placeholder = "輸入主題...";
    if (MISSION.topic) input.value = MISSION.topic; 
    input.focus();
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');

    btn.onclick = async () => {
        const val = input.value.trim();
        if(!val) return;
        
        MISSION.topic = val;
        input.value = "";
        input.disabled = true;
        input.classList.replace('input-active', 'input-locked');
        btn.disabled = true;

        await addLog("總編指令", "🗣️", val);
        
        if (IS_EDIT_MODE) {
            IS_EDIT_MODE = false;
            await triggerMissionSummary();
        } else {
            await triggerVisualSkill(); 
        }
    };
}

/**
 * 🛠️ Skill 3: 視覺決策中心 
 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "我為您準備了視覺配置。您可以「一鍵採納」，或點擊標籤進行微調：", true);

    const ui = createSkillUI(`
        <div class="space-y-6">
            <div class="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/30">
                <p class="text-[10px] text-blue-400 font-black mb-4 tracking-[0.2em] uppercase text-center">🤖 代理人推薦配置 (點擊可快速修改)</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3" id="summaryTags">
                    <button onclick="window.quickEdit('RATIO')" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">比例</span>
                        <span class="text-xs font-black text-white tag-ratio">${MISSION.ratio}</span>
                    </button>
                    <button onclick="window.quickEdit('MODE')" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">風格模式</span>
                        <span class="text-xs font-black text-white tag-mode">${MISSION.styleMode}</span>
                    </button>
                    <button onclick="window.quickEdit('RES')" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">解析度</span>
                        <span class="text-xs font-black text-white tag-res">${MISSION.resolution}</span>
                    </button>
                </div>
            </div>

            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">
                <div class="space-y-3">
                    <label class="text-[10px] text-slate-500 font-black tracking-widest uppercase">選擇比例 (Ratio)</label>
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
                ✅ 鎖定配置
            </button>
        </div>
    `);

    window.quickEdit = (type) => {
        ui.querySelector('#customPanel').classList.remove('hidden');
        ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth' });
    };

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
        input.onchange = (e) => handleAssetUpload(e.target.files);
        input.click();
    };

    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        lockUI(ui);
        IS_EDIT_MODE = false; 
        await triggerMissionSummary();
    };
}

/**
 * 🛠️ Skill 4: 任務最終摘要
 */
async function triggerMissionSummary() {
    updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "卷宗狀態更新完畢。請確認清單，點擊右側 ✎ 可回溯修改：", true);

    const summaryUI = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
                <span class="text-xs font-black text-blue-400">MISSION BRIEF</span>
                <span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">${APP_VERSION}</span>
            </div>
            
            <div class="space-y-3">
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('PLATFORM')">
                    <span class="text-xs text-slate-500">🚀 發布平台</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.platforms.join(', ')} ✎</span>
                </div>
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('TOPIC')">
                    <span class="text-xs text-slate-500">📝 任務主題</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400 truncate max-w-[150px]">${MISSION.topic} ✎</span>
                </div>
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg transition-colors" onclick="window.retryStep('VISUAL')">
                    <span class="text-xs text-slate-500">📸 視覺配置</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.ratio} / ${MISSION.styleMode} ✎</span>
                </div>
                <div class="flex justify-between items-center p-2">
                    <span class="text-xs text-slate-500">👥 登場角色</span>
                    <span class="text-xs font-bold text-white">${MISSION.characters.length > 0 ? MISSION.characters.join(', ') : '未召喚'}</span>
                </div>
            </div>

            <button id="btnLaunch" class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 mt-2">
                <span>🚀 啟動發射任務</span>
            </button>
        </div>
    `);

    window.retryStep = (step) => {
        IS_EDIT_MODE = true; 
        lockUI(summaryUI); 
        addLog("系統", "🔄", `收到回溯指令：正在為您展開「${step}」配置介面...`);
        
        if(step === 'PLATFORM') triggerPlatformSkill();
        if(step === 'TOPIC') unlockTopicInput();
        if(step === 'VISUAL') triggerVisualSkill();
    };

    summaryUI.querySelector('#btnLaunch').onclick = async () => {
        lockUI(summaryUI);
        await addLog("專案總監", "🔥", "任務正式啟動！正在調度核心算力進行生成，請勿離開對話框...");
        // 🚀 此處串接 API
    };
}

/**
 * 🧬 Skill: 角色選擇牆
 */
async function triggerCharacterPicker() {
    const charData = STATE.lastSystemData?.characters || [];
    const charDiv = document.createElement('div');
    charDiv.className = 'skill-card flex gap-4 overflow-x-auto py-4 px-2 no-scrollbar mb-6';
    
    if (charData.length === 0) {
        charDiv.innerHTML = `<p class="text-xs text-slate-500 italic">基因庫尚無數據。</p>`;
    } else {
        charData.forEach(char => {
            const card = document.createElement('div');
            card.className = 'flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group';
            card.innerHTML = `
                <div class="w-14 h-14 rounded-full border-2 border-slate-700 group-hover:border-blue-500 transition-all overflow-hidden shadow-lg"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div>
                <span class="text-[10px] font-bold text-slate-400 group-hover:text-blue-400">${char.name}</span>`;
            card.onclick = async () => {
                if (!MISSION.characters.includes(char.name)) {
                    MISSION.characters.push(char.name);
                    await addLog("視覺工程師", "✅", `已召喚「${char.name}」基因。`);
                    card.classList.add('opacity-40', 'pointer-events-none');
                }
            };
            charDiv.appendChild(card);
        });
    }
    document.getElementById('funnelLog').appendChild(charDiv);
    scrollDown();
}

/**
 * 📸 處理素材預覽
 */
async function handleAssetUpload(files) {
    const previewDiv = document.createElement('div');
    previewDiv.className = 'skill-card flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg mb-6';
    for (let file of files) {
        MISSION.sceneFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            previewDiv.innerHTML += `<div class="relative w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${e.target.result}" class="w-full h-full object-cover"></div>`;
        };
        reader.readAsDataURL(file);
    }
    document.getElementById('funnelLog').appendChild(previewDiv);
    await addLog("影像處理組", "📐", `成功載入 ${files.length} 張素材。`);
    scrollDown();
}

// ==========================================
// 🛠️ 輔助工具
// ==========================================

function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function createSkillUI(html) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'skill-card ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6';
    div.innerHTML = html;
    log.appendChild(div);
    scrollDown();
    return div;
}
async function addLog(role, icon, msg, skipTyping = false) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'flex items-start gap-4 animate-fade-in mb-4';
    div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[85%]">
        <div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div>
        <div class="msg-content text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div>
    </div>`;
    log.appendChild(div);
    scrollDown();
    if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; }
}
