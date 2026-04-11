// js/agent_v9_core.js
import { STATE } from './config.js';

// 🚀 任務卷宗
const MISSION = {
    platforms: [],
    topic: '',
    styleMode: 'INFLUENCER',
    ratio: '9:16',
    resolution: '1K',
    characters: [],
    sceneFiles: [],
    objectFiles: [],
    step: 1
};

/**
 * 🛠️ 輔助：更新頂部任務狀態文字
 */
function updateStepHeader(name) {
    const el = document.getElementById('missionStep');
    if (el) el.innerText = name;
}

/**
 * 🛠️ 輔助：鎖定組件防止重複點擊
 */
function lockUI(el) {
    el.classList.add('opacity-40', 'pointer-events-none');
}

/**
 * 🛠️ 輔助：自動捲動到底部
 */
function scrollDown() {
    const log = document.getElementById('funnelLog');
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
}

/**
 * 🖋️ 核心：新增 Agent 對話訊息
 */
async function addLog(role, icon, msg, skipTyping = false) {
    const log = document.getElementById('funnelLog');
    if (!log) return;

    const div = document.createElement('div');
    div.className = 'flex items-start gap-4 animate-fade-in mb-4';
    
    // 預設打字狀態
    div.innerHTML = `
        <div class="text-2xl">${icon}</div>
        <div class="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[85%]">
            <div class="text-[9px] font-black text-slate-500 mb-1 tracking-widest uppercase">${role}</div>
            <div class="msg-content text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div>
        </div>
    `;
    log.appendChild(div);
    scrollDown();

    if (!skipTyping) {
        await new Promise(r => setTimeout(r, 600)); // 模擬思考時間
        div.querySelector('.msg-content').innerHTML = msg;
    }
}

/**
 * 🧱 核心：建立 Skill UI 容器
 */
function createSkillUI(html) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'skill-card ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6';
    div.innerHTML = html;
    log.appendChild(div);
    scrollDown();
    return div;
}

/**
 * 🛠️ 輔助：更新配置建議標籤
 */
function updateSummaryTags(ui) {
    const tags = ui.querySelector('#summaryTags');
    if (tags) {
        tags.innerHTML = `
            <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">比例: ${MISSION.ratio}</span>
            <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">模式: ${MISSION.styleMode}</span>
            <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">解析度: ${MISSION.resolution}</span>
        `;
    }
}

// ==========================================
// 🚀 漏斗流程控制器
// ==========================================

export async function initAgentFunnel() {
    console.log("🚀 Agent V9 Funnel Start...");
    updateStepHeader("SYSTEM INITIALIZING");
    
    // 初始化點數顯示 (假設 STATE 已載入)
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = STATE.userPoints || 0;

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
        await unlockTopicInput();
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
        // 重新鎖定輸入框
        input.value = "";
        input.disabled = true;
        input.classList.replace('input-active', 'input-locked');
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        await addLog("總編指令", "🗣️", val);
        await triggerVisualSkill(); 
    };
}

/**
 * 🛠️ Skill 3: 視覺決策中心
 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "主題已收到。我為您調度了視覺建議配置，您可以在此微調或添加素材：", true);

    const ui = createSkillUI(`
        <div class="space-y-4">
            <div id="visualSummary" class="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                <p class="text-[10px] text-blue-300 font-bold mb-2 tracking-widest uppercase">💡 目前配置建議</p>
                <div class="flex flex-wrap gap-2" id="summaryTags">
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">比例: ${MISSION.ratio}</span>
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">模式: ${MISSION.styleMode}</span>
                    <span class="bg-slate-700 px-2 py-1 rounded text-[10px]">解析度: ${MISSION.resolution}</span>
                </div>
            </div>

            <div id="customPanel" class="hidden space-y-3 bg-slate-800/80 p-4 rounded-xl border border-white/5 animate-fade-in">
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] text-slate-500 font-bold uppercase">選擇比例</label>
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
                <button id="btnAcceptVisual" class="flex-1 bg-blue-600 py-3 rounded-xl font-bold text-xs">✅ 採納建議並發包</button>
                <button id="btnCustomVisual" class="px-4 border border-white/10 py-3 rounded-xl font-bold text-xs">⚙️ 手動微調</button>
            </div>
        </div>
    `);

    ui.querySelector('#btnCustomVisual').onclick = () => {
        ui.querySelector('#customPanel').classList.toggle('hidden');
    };

    ui.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val;
            ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600'));
            btn.classList.add('bg-blue-600');
            updateSummaryTags(ui);
        };
    });

    ui.querySelector('#btnSummonChar').onclick = async () => {
        await addLog("視覺工程師", "🧬", "正在檢索您的專屬基因庫...");
        await triggerCharacterPicker();
    };

    ui.querySelector('#btnUploadScene').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = (e) => handleAssetUpload(e.target.files);
        input.click();
    };

    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        lockUI(ui);
        await addLog("專案總監", "👨‍💼", "配置鎖定完畢！正在啟動「首席文案」進行腳本編撰...", true);
    };
}

/**
 * 🧬 Skill: 角色基因選擇牆
 */
async function triggerCharacterPicker() {
    const funnelLog = document.getElementById('funnelLog');
    const charData = STATE.lastSystemData?.characters || [];

    const charDiv = document.createElement('div');
    charDiv.className = 'skill-card flex gap-4 overflow-x-auto py-4 px-2 no-scrollbar mb-6';
    
    if (charData.length === 0) {
        charDiv.innerHTML = `<p class="text-xs text-slate-500 italic">基因庫尚無數據，請至側欄管理。</p>`;
    } else {
        charData.forEach(char => {
            const card = document.createElement('div');
            card.className = 'flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group';
            card.innerHTML = `
                <div class="w-14 h-14 rounded-full border-2 border-slate-700 group-hover:border-blue-500 transition-all overflow-hidden shadow-lg">
                    <img src="${char.imageUrl}" class="w-full h-full object-cover">
                </div>
                <span class="text-[10px] font-bold text-slate-400 group-hover:text-blue-400">${char.name}</span>
            `;
            card.onclick = async () => {
                if (!MISSION.characters.includes(char.name)) {
                    MISSION.characters.push(char.name);
                    await addLog("視覺工程師", "✅", `已召喚「${char.name}」進入候場區。`);
                    card.classList.add('opacity-40', 'pointer-events-none');
                }
            };
            charDiv.appendChild(card);
        });
    }
    funnelLog.appendChild(charDiv);
    scrollDown();
}

/**
 * 📸 處理素材上傳預覽
 */
async function handleAssetUpload(files) {
    const funnelLog = document.getElementById('funnelLog');
    const previewDiv = document.createElement('div');
    previewDiv.className = 'skill-card flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg mb-6';
    
    for (let file of files) {
        MISSION.sceneFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            previewDiv.innerHTML += `
                <div class="relative w-16 h-16 rounded-md overflow-hidden border border-white/20">
                    <img src="${e.target.result}" class="w-full h-full object-cover">
                    <div class="absolute bottom-0 right-0 p-0.5 bg-blue-600">
                        <svg class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                    </div>
                </div>
            `;
        };
        reader.readAsDataURL(file);
    }
    
    funnelLog.appendChild(previewDiv);
    await addLog("影像處理組", "📐", `成功載入素材，特徵點已提取。`);
    scrollDown();
}
