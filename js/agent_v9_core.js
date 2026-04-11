// js/agent_v9_core.js
import { STATE } from './config.js';

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

// ==========================================
// 🚀 核心：初始化與流程控制
// ==========================================

export async function initAgentFunnel() {
    updateStepHeader("SYSTEM READY");
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = (STATE.userPoints || 0).toLocaleString();

    await addLog("專案總監", "👨‍💼", "總編您好，任務引擎已就緒。我們將依序鎖定平台、主題與視覺配置。");
    await triggerPlatformSkill();
}

/**
 * 🛠️ Skill: 平台鎖定
 */
async function triggerPlatformSkill() {
    updateStepHeader("PLATFORM SELECTION");
    await addLog("社群總監", "🚀", "首先，請決定本次任務的投遞平台：", true);
    
    const ui = createSkillUI(`
        <div class="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
            <button class="plat-btn border border-white/10 px-4 py-3 rounded-xl hover:bg-blue-600 transition-all text-xs font-bold" data-val="FB">Facebook</button>
            <button class="plat-btn border border-white/10 px-4 py-3 rounded-xl hover:bg-pink-600 transition-all text-xs font-bold" data-val="IG">Instagram</button>
            <button class="plat-btn border border-white/10 px-4 py-3 rounded-xl hover:bg-slate-700 transition-all text-xs font-bold" data-val="THREADS">Threads</button>
            <button id="btnConfirmPlat" class="bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg">確認鎖定</button>
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
        await unlockTopicInput();
    };
}

/**
 * 🛠️ Skill: 主題捕獲
 */
async function unlockTopicInput() {
    updateStepHeader("TOPIC CAPTURE");
    const input = document.getElementById('agentInput');
    const btn = document.getElementById('btnSend');

    await addLog("專案總監", "👨‍💼", "接下來，請在下方輸入框提供您的「貼文主題」。");
    
    input.disabled = false;
    input.classList.replace('input-locked', 'input-active');
    input.placeholder = "輸入主題...";
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
        await triggerVisualSkill(); 
    };
}

/**
 * 🛠️ Skill: 視覺決策中心
 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "我為您調度了視覺建議，您可以採納或進行微調：", true);

    const ui = createSkillUI(`
        <div class="space-y-4">
            <div id="visualSummary" class="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                <p class="text-[10px] text-blue-300 font-bold mb-2 tracking-widest uppercase">💡 配置預設</p>
                <div class="flex flex-wrap gap-2" id="summaryTags">
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">比例: ${MISSION.ratio}</span>
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">模式: ${MISSION.styleMode}</span>
                </div>
            </div>

            <div id="customPanel" class="hidden space-y-3 bg-slate-800/80 p-4 rounded-xl border border-white/5 animate-fade-in">
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] text-slate-500 font-bold">選擇比例</label>
                    <div class="flex gap-2">
                        <button class="ratio-btn flex-1 py-2 bg-slate-700 rounded-lg text-xs" data-val="9:16">9:16</button>
                        <button class="ratio-btn flex-1 py-2 bg-slate-700 rounded-lg text-xs" data-val="16:9">16:9</button>
                        <button class="ratio-btn flex-1 py-2 bg-slate-700 rounded-lg text-xs" data-val="1:1">1:1</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <button id="btnSummonChar" class="bg-indigo-600/30 hover:bg-indigo-600/50 py-3 rounded-xl text-[10px] font-bold transition-colors">🧬 召喚角色基因</button>
                <button id="btnUploadScene" class="bg-slate-700 hover:bg-slate-600 py-3 rounded-xl text-[10px] font-bold transition-colors">📸 上傳實境/場景</button>
            </div>

            <div class="flex gap-2">
                <button id="btnAcceptVisual" class="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-xs shadow-lg shadow-blue-900/40">✅ 鎖定配置</button>
                <button id="btnCustomVisual" class="px-4 border border-white/10 py-3 rounded-xl font-bold text-xs">⚙️ 手動微調</button>
            </div>
        </div>
    `);

    ui.querySelector('#btnCustomVisual').onclick = () => ui.querySelector('#customPanel').classList.toggle('hidden');
    
    ui.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val;
            ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600'));
            btn.classList.add('bg-blue-600');
            updateSummaryTags(ui);
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
        await triggerMissionSummary();
    };
}

/**
 * 🛠️ Skill: 任務最終摘要 (JSON 確認與回溯修改)
 */
async function triggerMissionSummary() {
    updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "卷宗已封裝完畢。請確認發布清單，點擊項目可回溯修改：", true);

    const summaryUI = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
                <span class="text-xs font-black text-blue-400">MISSION BRIEF</span>
                <span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">V9-AGENT-MODE</span>
            </div>
            
            <div class="space-y-3">
                <div class="flex justify-between cursor-pointer group" onclick="window.retryStep('PLATFORM')">
                    <span class="text-xs text-slate-500">🚀 發布平台</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.platforms.join(', ')} ✎</span>
                </div>
                <div class="flex justify-between cursor-pointer group" onclick="window.retryStep('TOPIC')">
                    <span class="text-xs text-slate-500">📝 任務主題</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400 truncate max-w-[150px]">${MISSION.topic} ✎</span>
                </div>
                <div class="flex justify-between cursor-pointer group" onclick="window.retryStep('VISUAL')">
                    <span class="text-xs text-slate-500">📸 視覺配置</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.ratio} / ${MISSION.styleMode} ✎</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-xs text-slate-500">👥 登場角色</span>
                    <span class="text-xs font-bold text-white">${MISSION.characters.length > 0 ? MISSION.characters.join(', ') : '未召喚'}</span>
                </div>
            </div>

            <button id="btnLaunch" class="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black text-sm shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2">
                <span>🚀 啟動發射任務</span>
            </button>
        </div>
    `);

    // 🌟 QR 式回溯全域綁定
    window.retryStep = (step) => {
        addLog("系統", "🔄", `收到回溯指令：重新配置「${step}」階段...`);
        if(step === 'PLATFORM') triggerPlatformSkill();
        if(step === 'TOPIC') unlockTopicInput();
        if(step === 'VISUAL') triggerVisualSkill();
    };

    summaryUI.querySelector('#btnLaunch').onclick = async () => {
        lockUI(summaryUI);
        await addLog("專案總監", "🔥", "任務啟動！正在調度核心算力進行生成，請勿離開對話框...");
        // 此處將連接 API.createDraftAPI(MISSION)...
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
function updateSummaryTags(ui) {
    const tags = ui.querySelector('#summaryTags');
    if (tags) tags.innerHTML = `<span class="bg-slate-700 px-2 py-1 rounded text-[10px]">比例: ${MISSION.ratio}</span><span class="bg-slate-700 px-2 py-1 rounded text-[10px]">模式: ${MISSION.styleMode}</span>`;
}
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
