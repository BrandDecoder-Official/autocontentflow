// js/agent_v9_core.js
import { STATE } from './config.js';
import * as API from './api.js'; // 🌟 引入 API 層

const MISSION = {
    platforms: [],
    topic: '',
    styleMode: 'REALISTIC',
    ratio: '9:16',
    resolution: '1K',
    characters: [],
    sceneFiles: [],
    step: 1
};

// ==========================================
// 🚀 核心：初始化與流程控制
// ==========================================

export async function initAgentFunnel() {
    updateStepHeader("SYSTEM READY");
    await addLog("專案總監", "👨‍💼", "總編您好，BrandDecoder V9 代理人已就緒。我們將依序鎖定平台、主題與視覺配置。");
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
 * 🛠️ Skill: 視覺決策中心 (UI 重大升級：大面板、標籤連動)
 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "我為您調度了視覺建議。點擊「配置標籤」可快速修改，或直接「確認鎖定」：", true);

    const ui = createSkillUI(`
        <div class="space-y-6">
            <div class="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/30">
                <p class="text-[10px] text-blue-400 font-black mb-4 tracking-[0.2em] uppercase text-center">🤖 建議配置 (點擊即刻修改)</p>
                <div class="grid grid-cols-3 gap-3" id="summaryTags">
                    <button id="tagRatio" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">比例</span>
                        <span class="text-xs font-black text-white tag-val">${MISSION.ratio}</span>
                    </button>
                    <button id="tagMode" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">模式</span>
                        <span class="text-xs font-black text-white tag-val">${MISSION.styleMode === 'REALISTIC' ? '寫實' : '動漫'}</span>
                    </button>
                    <button id="tagRes" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95">
                        <span class="text-[9px] text-slate-500 mb-1">解析</span>
                        <span class="text-xs font-black text-white tag-val">${MISSION.resolution}</span>
                    </button>
                </div>
            </div>

            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">
                <div class="space-y-3">
                    <label class="text-[10px] text-slate-500 font-black tracking-widest uppercase">切換比例</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold" data-val="9:16">9:16</button>
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold" data-val="16:9">16:9</button>
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold" data-val="1:1">1:1</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <button id="btnSummonChar" class="bg-indigo-600/20 py-4 rounded-2xl text-[10px] font-black uppercase flex flex-col items-center gap-1">
                    <span class="text-lg">🧬</span> 召喚基因庫
                </button>
                <button id="btnUploadScene" class="bg-slate-800 py-4 rounded-2xl text-[10px] font-black uppercase flex flex-col items-center gap-1">
                    <span class="text-lg">📸</span> 上傳場景圖
                </button>
            </div>

            <div class="flex flex-col gap-3">
                <button id="btnAcceptVisual" class="w-full bg-blue-600 py-5 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                    ✅ 採納建議並發包
                </button>
                <button id="btnToggleCustom" class="w-full bg-slate-900 border border-white/20 py-3 rounded-xl font-bold text-xs text-slate-500">
                    ⚙️ 手動微調所有參數
                </button>
            </div>
        </div>
    `);

    // 🌟 連動邏輯
    ui.querySelector('#tagRatio').onclick = () => {
        ui.querySelector('#customPanel').classList.remove('hidden');
        ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth' });
    };
    
    ui.querySelectorAll('.ratio-btn').forEach(btn => {
        if(btn.dataset.val === MISSION.ratio) btn.classList.add('bg-blue-600');
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val;
            ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600'));
            btn.classList.add('bg-blue-600');
            ui.querySelector('#tagRatio .tag-val').innerText = MISSION.ratio;
        };
    });

    ui.querySelector('#btnToggleCustom').onclick = () => ui.querySelector('#customPanel').classList.toggle('hidden');
    ui.querySelector('#btnSummonChar').onclick = async () => triggerCharacterPicker();
    ui.querySelector('#btnUploadScene').onclick = () => {
        const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
        input.onchange = (e) => handleAssetUpload(e.target.files);
        input.click();
    };

    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        lockUI(ui);
        await launchMission(); // 🚀 正式執行連動
    };
}

/**
 * 🚀 Final: 任務發射 (與 API 連動)
 */
async function launchMission() {
    updateStepHeader("EXECUTING DRAFT");
    await addLog("專案總監", "🔥", "任務卷宗已封裝！正在啟動算力進行腳本編撰，請稍候...");
    
    // 這裡實作 API 呼叫 (模擬 workflow.js 的邏輯)
    try {
        const payload = {
            platforms: MISSION.platforms,
            topic: MISSION.topic,
            aspectRatio: MISSION.ratio,
            isComicMode: false, // 暫定
            // ... 其他 API 所需欄位
        };
        // await API.createDraftAPI(payload);
        await addLog("首席文案", "✍️", "腳本初稿已生成！正在轉送「美術總監」進行視覺渲染...", true);
        // ...後續渲染邏輯
    } catch (e) {
        await addLog("系統", "🚨", "連線異常，請檢查網路或點數。");
    }
}

// ... 輔助函數 (addLog, updateStepHeader, lockUI 等維持原樣) ...
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
