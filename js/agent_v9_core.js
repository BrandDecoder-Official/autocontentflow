// js/agent_v9_core.js
import { STATE } from './config.js';

const MISSION = {
    platforms: [],
    topic: '',
    styleMode: 'INFLUENCER',
    ratio: '9:16',
    resolution: '1K',
    characters: [],
    sceneFiles: [],
    step: 1
};

export async function initAgentFunnel() {
    await addLog("專案總監", "👨‍💼", "總編您好，BrandDecoder V9 代理人已就緒。我們將啟動高效率發佈漏斗。");
    await triggerPlatformSkill();
}

/**
 * 🛠️ Skill 1: 平台鎖定
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
        await addLog("社群總監", "✅", `已對接平台：${selected.join(' / ')}。`);
        unlockTopicInput();
    };
}

/**
 * 🛠️ Skill 2: 主題捕獲 (解鎖輸入框)
 */
async function unlockTopicInput() {
    updateStepHeader("TOPIC CAPTURE");
    const input = document.getElementById('agentInput');
    const btn = document.getElementById('btnSend');

    await addLog("專案總監", "👨‍💼", "明白。請在下方輸入框告訴我今日的「創作主題」或「故事情節」。");
    
    input.disabled = false;
    input.classList.replace('input-locked', 'input-active');
    input.placeholder = "輸入主題，如：老K在墾丁潛水...";
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
        await triggerVisualSkill(); // 進入下一個技能包
    };
}

/**
 * 🛠️ Skill 3: 視覺決策中心 (不強迫，給建議)
 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "主題已收到。根據平台特性，我為您調度了以下視覺配置建議：", true);

    const ui = createSkillUI(`
        <div class="space-y-4">
            <div class="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                <p class="text-xs text-blue-300 font-bold mb-2">💡 專家建議配置</p>
                <div class="flex flex-wrap gap-2">
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">比例 9:16</span>
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">網紅模式</span>
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">解析度 2K</span>
                </div>
            </div>
            <div class="flex gap-2">
                <button id="btnAcceptVisual" class="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-xs">✅ 採納建議</button>
                <button id="btnCustomVisual" class="flex-1 border border-white/10 py-3 rounded-xl font-bold text-xs">⚙️ 手動微調</button>
            </div>
            <div id="assetZone" class="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <button class="bg-slate-800 py-3 rounded-xl text-[10px] font-bold">📸 上傳場景</button>
                <button class="bg-slate-800 py-3 rounded-xl text-[10px] font-bold">🧬 召喚角色</button>
            </div>
        </div>
    `);

    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        lockUI(ui);
        await addLog("美術總監", "🎨", "收到！將以最佳化參數進行卷宗封裝。正在準備最終確認卡...");
        // 進入最終確認階段...
    };

    ui.querySelector('#btnCustomVisual').onclick = () => {
        alert("開啟微調選單(比例/解析度/畫風)...");
    };
}

// --- 內部輔助函數 ---

function updateStepHeader(name) {
    document.getElementById('missionStep').innerText = name;
}

function createSkillUI(html) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'skill-card ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl';
    div.innerHTML = html;
    log.appendChild(div);
    scrollDown();
    return div;
}

async function addLog(role, icon, msg, skipTyping = false) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'flex items-start gap-4 animate-fade-in';
    div.innerHTML = `
        <div class="text-2xl">${icon}</div>
        <div class="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[85%]">
            <div class="text-[9px] font-black text-slate-500 mb-1 tracking-widest">${role}</div>
            <p class="text-sm leading-relaxed">${msg}</p>
        </div>
    `;
    log.appendChild(div);
    scrollDown();
}

function lockUI(el) {
    el.classList.add('opacity-40', 'pointer-events-none');
}

function scrollDown() {
    const log = document.getElementById('funnelLog');
    log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
}
