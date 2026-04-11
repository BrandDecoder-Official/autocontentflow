// js/agent_v9_core.js
import { STATE } from './config.js';

// 🌟 版本控制號
const APP_VERSION = "V0.8版";

// 🚀 任務卷宗
const MISSION = {
    platforms: [],
    topic: '',
    universe: 'REALISTIC', 
    style: '',             
    ratio: '9:16',
    resolution: '1K',
    characters: [],
    sceneFiles: [],
    objectFiles: [],
    scheduleMode: 'NOW', // NOW 或 LATER
    scheduleDate: '',
    scheduleTime: ''
};

let IS_EDIT_MODE = false;

const MOCK_STYLES = {
    REALISTIC: [
        { id: 'INFLUENCER', name: '網紅生活 (全彩)', icon: '📸', desc: '高顏值、自然光影' },
        { id: 'PRODUCT', name: '商業質感 (全彩)', icon: '🛍️', desc: '凸顯細節、色彩飽滿' },
        { id: 'NOIR', name: '經典底片 (黑白)', icon: '🎞️', desc: '高反差黑白、情緒張力' }
    ],
    COMIC: [
        { id: 'MANGA_BW', name: '日系漫畫 (黑白)', icon: '✒️', desc: '經典網點、俐落墨線' },
        { id: 'MANGA_COLOR', name: '日系插畫 (全彩)', icon: '🎨', desc: '賽璐璐上色、細緻光影' },
        { id: 'WEBTOON', name: '韓系條漫 (全彩)', icon: '📱', desc: '精緻唯美、高飽和色彩' }
    ],
    ENHANCE: [
        { id: 'NATURAL', name: '自然清晰 (Upscale)', icon: '🍃', desc: '去雜訊、提升畫質與銳利度' },
        { id: 'STUDIO', name: '棚拍光影 (Relight)', icon: '✨', desc: '增強立體感、補充商業光影' },
        { id: 'FILM_LOOK', name: '電影調色 (Colorize)', icon: '🎬', desc: '套用好萊塢級別氛圍濾鏡' }
    ]
};

// ==========================================
// 🚀 核心：初始化與流程控制
// ==========================================

export async function initAgentFunnel() {
    updateStepHeader("SYSTEM READY");
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = (STATE.userPoints || 0).toLocaleString();

    await addLog("專案總監", "👨‍💼", `${APP_VERSION} - 總編您好，發布排程系統已實裝。我們開始吧！`);
    await triggerPlatformSkill();
}

/** 🛠️ Skill 1: 平台鎖定 */
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
        if (selected.length === 0) return alert('⚠️ 系統防呆：請至少選擇一個平台！');
        MISSION.platforms = selected; lockUI(ui);
        await addLog("社群總監", "✅", `已鎖定平台：${selected.join(' / ')}。`);
        if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } else { await unlockTopicInput(); }
    };
}

/** 🛠️ Skill 2: 主題捕獲 */
async function unlockTopicInput() {
    updateStepHeader("TOPIC CAPTURE");
    const input = document.getElementById('agentInput'); const btn = document.getElementById('btnSend');
    await addLog("專案總監", "👨‍💼", "請在下方輸入框提供您的「貼文主題」。");
    
    input.disabled = false; input.classList.replace('input-locked', 'input-active');
    input.placeholder = "輸入主題..."; if (MISSION.topic) input.value = MISSION.topic; 
    input.focus(); btn.disabled = false; btn.classList.remove('opacity-50', 'cursor-not-allowed');

    btn.onclick = async () => {
        const val = input.value.trim(); 
        if(!val) return alert('⚠️ 系統防呆：主題不能為空！');
        MISSION.topic = val;
        input.value = ""; input.disabled = true; input.classList.replace('input-active', 'input-locked'); btn.disabled = true;
        await addLog("總編指令", "🗣️", val);
        if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } else { await triggerUniverseSkill(); }
    };
}

/** 🛠️ Skill 3: 宇宙選擇 */
async function triggerUniverseSkill() {
    updateStepHeader("UNIVERSE SELECTION");
    await addLog("美術總監", "🌌", "請選擇本次內容的視覺宇宙，或選擇原圖美化模式：", true);

    const ui = createSkillUI(`
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC">
                <span class="text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span>
            </button>
            <button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC">
                <span class="text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span>
            </button>
            <button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-yellow-500 hover:bg-yellow-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'ENHANCE' ? 'border-yellow-500 bg-yellow-600/20' : 'bg-slate-800'}" data-val="ENHANCE">
                <span class="text-3xl">✨</span><span class="font-black text-xs text-white">無損美化原圖</span>
            </button>
        </div>
    `);

    ui.querySelectorAll('.uni-btn').forEach(btn => {
        btn.onclick = async () => {
            const oldUniverse = MISSION.universe; MISSION.universe = btn.dataset.val; MISSION.style = ''; 
            if (MISSION.universe === 'ENHANCE') { MISSION.characters = []; MISSION.ratio = '原圖比例'; } 
            else if (oldUniverse === 'ENHANCE') { MISSION.ratio = '9:16'; }
            lockUI(ui);
            const uniName = MISSION.universe === 'REALISTIC' ? '真實攝影' : (MISSION.universe === 'COMIC' ? '2D 動漫' : '原圖美化模式');
            await addLog("美術總監", "✅", `已切換至「${uniName}」。`);
            await triggerStyleSkill();
        };
    });
}

/** 🛠️ Skill 4: 動態風格 */
async function triggerStyleSkill() {
    updateStepHeader("STYLE SELECTION");
    const styles = MOCK_STYLES[MISSION.universe];
    const prefixStr = MISSION.universe === 'ENHANCE' ? '美化方向' : '視覺風格';
    
    let styleHtml = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`;
    styles.forEach(s => { styleHtml += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.id ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.id}" data-name="${s.name}"><span class="text-xl">${s.icon}</span><span class="font-bold text-xs text-white">${s.name}</span><span class="text-[9px] text-slate-400">${s.desc}</span></button>`; });
    styleHtml += `</div>`;

    const ui = createSkillUI(styleHtml);
    ui.querySelectorAll('.style-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.style = btn.dataset.val; lockUI(ui);
            await addLog("美術總監", "✅", `${prefixStr}已鎖定為「${btn.dataset.name}」。`);
            if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } else { await triggerVisualSkill(); }
        };
    });
}

/** 🛠️ Skill 5: 視覺參數 */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    const isEnhance = MISSION.universe === 'ENHANCE';
    let promptMsg = isEnhance ? "偵測為美化模式。請【務必上傳原圖】，角色與比例已鎖定：" : "最後，請確認畫面參數，並【務必召喚至少一位角色】：";
    await addLog("美術總監", "👨‍🎨", promptMsg, true);

    const ui = createSkillUI(`
        <div class="space-y-6">
            <div class="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/30">
                <p class="text-[10px] text-blue-400 font-black mb-3 tracking-[0.2em] uppercase text-center">👇 點擊下方區塊可展開修改選項</p>
                <div class="grid grid-cols-2 gap-3" id="summaryTags">
                    <button ${isEnhance ? 'disabled' : `onclick="window.quickEdit('RATIO')"`} class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95 group ${isEnhance ? 'opacity-50 cursor-not-allowed' : ''}">
                        <span class="text-[10px] text-slate-400 mb-1 font-bold ${isEnhance?'':'group-hover:text-blue-300'}">⛭ 選擇比例 (目前)</span>
                        <span class="text-lg font-black text-white tag-ratio">${MISSION.ratio}</span>
                    </button>
                    <button onclick="window.quickEdit('RES')" class="flex flex-col items-center justify-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all active:scale-95 group">
                        <span class="text-[10px] text-slate-400 mb-1 font-bold group-hover:text-blue-300">⛭ 選擇解析度 (目前)</span>
                        <span class="text-lg font-black text-white tag-res">${MISSION.resolution}</span>
                    </button>
                </div>
            </div>

            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">
                ${isEnhance ? '' : `
                <div class="space-y-3">
                    <label class="text-[10px] text-slate-500 font-black tracking-widest uppercase">📐 畫面比例</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='9:16'?'bg-blue-600':''}" data-val="9:16">9:16</button>
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='16:9'?'bg-blue-600':''}" data-val="16:9">16:9</button>
                        <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='1:1'?'bg-blue-600':''}" data-val="1:1">1:1</button>
                    </div>
                </div>`}
                <div class="space-y-3 ${isEnhance ? '' : 'pt-4 border-t border-white/10'}">
                    <label class="text-[10px] text-slate-500 font-black tracking-widest uppercase">✨ 影像品質 (解析度)</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold flex flex-col items-center gap-1 ${MISSION.resolution==='1K'?'bg-blue-600':''}" data-val="1K"><span class="text-sm">1K</span></button>
                        <button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold flex flex-col items-center gap-1 ${MISSION.resolution==='2K'?'bg-blue-600':''}" data-val="2K"><span class="text-sm">2K</span></button>
                        <button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold flex flex-col items-center gap-1 ${MISSION.resolution==='4K'?'bg-blue-600':''}" data-val="4K"><span class="text-sm">4K</span></button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <button id="btnSummonChar" ${isEnhance ? 'disabled' : ''} class="bg-indigo-600/20 py-4 rounded-2xl text-xs font-black border border-indigo-500/50 hover:bg-indigo-600/40 transition-colors ${isEnhance ? 'opacity-30 cursor-not-allowed' : ''}"><span class="text-lg">🧬</span> 召喚角色基因</button>
                <button id="btnUploadScene" class="bg-slate-800 py-4 rounded-2xl text-xs font-black border ${isEnhance ? 'border-yellow-500 bg-yellow-600/20' : 'border-white/10 hover:bg-slate-700'} transition-all"><span class="text-lg">📸</span> 上傳場景圖(原圖)</button>
            </div>
            <button id="btnAcceptVisual" class="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(59,130,246,0.4)]">✅ 鎖定參數</button>
        </div>
    `);

    window.quickEdit = (type) => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth' }); };
    
    if (!isEnhance) {
        ui.querySelectorAll('.ratio-btn').forEach(btn => {
            btn.onclick = () => { MISSION.ratio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = MISSION.ratio; };
        });
        ui.querySelector('#btnSummonChar').onclick = async () => triggerCharacterPicker();
    }
    ui.querySelectorAll('.res-btn').forEach(btn => {
        btn.onclick = () => { MISSION.resolution = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = MISSION.resolution; };
    });
    
    ui.querySelector('#btnUploadScene').onclick = () => {
        const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
        input.onchange = (e) => handleAssetUpload(e.target.files); input.click();
    };

    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        if (isEnhance && MISSION.sceneFiles.length === 0) return alert('⚠️ 系統防呆：請上傳需要美化的原圖！');
        if (!isEnhance && MISSION.characters.length === 0) return alert('⚠️ 系統防呆：您尚未召喚任何角色！');
        lockUI(ui); IS_EDIT_MODE = false; await triggerMissionSummary(); 
    };
}

/** 🛠️ Skill 6: 任務最終摘要 (🌟 V0.8 修復：角色/素材 加入 ✎ 連動) */
async function triggerMissionSummary() {
    updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "請確認發布清單，無誤後我們將請「首席文案」開始編撰腳本：", true);

    const universeMap = { 'REALISTIC': '真實攝影', 'COMIC': '2D動漫', 'ENHANCE': '無損美化' };
    const styleObj = MOCK_STYLES[MISSION.universe].find(s => s.id === MISSION.style);

    const summaryUI = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3">
                <span class="text-xs font-black text-blue-400">MISSION BRIEF</span><span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">${APP_VERSION}</span>
            </div>
            <div class="space-y-3">
                <div class="flex justify-between cursor-pointer group hover:bg-white/5 p-2 rounded-lg" onclick="window.retryStep('PLATFORM')">
                    <span class="text-xs text-slate-500">🚀 平台</span><span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.platforms.join(', ')} ✎</span>
                </div>
                <div class="flex justify-between cursor-pointer group hover:bg-white/5 p-2 rounded-lg" onclick="window.retryStep('TOPIC')">
                    <span class="text-xs text-slate-500">📝 主題</span><span class="text-xs font-bold text-white group-hover:text-blue-400 truncate max-w-[150px]">${MISSION.topic} ✎</span>
                </div>
                <div class="flex justify-between cursor-pointer group hover:bg-white/5 p-2 rounded-lg" onclick="window.retryStep('UNIVERSE')">
                    <span class="text-xs text-slate-500">🌌 視覺</span><span class="text-xs font-bold text-white group-hover:text-blue-400">${universeMap[MISSION.universe]} / ${styleObj ? styleObj.name : ''} ✎</span>
                </div>
                <div class="flex justify-between cursor-pointer group hover:bg-white/5 p-2 rounded-lg" onclick="window.retryStep('VISUAL')">
                    <span class="text-xs text-slate-500">📐 參數</span><span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.ratio} / ${MISSION.resolution} ✎</span>
                </div>
                <div class="flex justify-between items-center cursor-pointer group hover:bg-white/5 p-2 rounded-lg" onclick="window.retryStep('VISUAL')">
                    <span class="text-xs text-slate-500">👥 角色 / 素材</span>
                    <span class="text-xs font-bold text-white group-hover:text-blue-400">
                        ${MISSION.universe === 'ENHANCE' ? `已上傳 ${MISSION.sceneFiles.length} 張原圖 ✎` : (MISSION.characters.length > 0 ? MISSION.characters.join(', ') + ' ✎' : '未召喚 ✎')}
                    </span>
                </div>
            </div>
            <button id="btnDraft" class="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl font-black text-sm shadow-lg transition-all flex justify-center gap-2 mt-2">
                <span>✍️ 扣除 15 點，生成腳本</span>
            </button>
        </div>
    `);

    window.retryStep = (step) => {
        IS_EDIT_MODE = true; lockUI(summaryUI); addLog("系統", "🔄", `進入編輯模式...`);
        if(step === 'PLATFORM') triggerPlatformSkill(); if(step === 'TOPIC') unlockTopicInput(); 
        if(step === 'UNIVERSE') triggerUniverseSkill(); if(step === 'VISUAL') triggerVisualSkill();
    };

    summaryUI.querySelector('#btnDraft').onclick = async () => { 
        lockUI(summaryUI); await executeDraftSim(); 
    };
}

async function executeDraftSim() {
    updateStepHeader("DRAFTING SCRIPT");
    await addLog("首席文案", "✍️", "收到指令，正在為您編撰專屬貼文腳本...");
    await new Promise(r => setTimeout(r, 1000));
    const mockDraft = {
        caption: `就在今天！進入「${MISSION.topic}」的世界！🔥 大家快來朝聖！`,
        hashtags: ['#最新動態', '#必看'],
        panels: MISSION.universe === 'COMIC' ? [{ id: 1, dialogue: "太棒了吧！" }] : null
    };
    await triggerDraftReviewSkill(mockDraft);
}

/** 🛠️ Skill 8: 腳本審閱 (🌟 V0.8: 加入強大的排程模組) */
async function triggerDraftReviewSkill(draft) {
    updateStepHeader("DRAFT REVIEW");
    await addLog("專案總監", "👨‍💼", "總編，腳本已出爐！您可以檢視並決定「發布排程」：", true);

    // 產生 15 分鐘區間的時間選項
    let timeOptions = '';
    for(let h=0; h<24; h++) {
        const hh = h.toString().padStart(2, '0');
        ['00', '15', '30', '45'].forEach(mm => {
            timeOptions += `<option value="${hh}:${mm}">${hh}:${mm}</option>`;
        });
    }

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            ${MISSION.universe !== 'ENHANCE' ? `
            <div class="bg-indigo-900/30 p-3 rounded-xl border border-indigo-500/40">
                <p class="text-[10px] text-indigo-300 font-black mb-2 uppercase">👗 外觀裝扮建議</p>
                <textarea class="w-full bg-slate-800/50 border border-white/5 rounded-lg p-2 text-xs text-white resize-none" rows="1">依照「${MISSION.topic}」搭配</textarea>
            </div>` : ''}
            <div>
                <p class="text-[10px] text-indigo-400 font-black mb-2 uppercase">📝 貼文內文 (可編輯)</p>
                <textarea class="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-white resize-none" rows="3">${draft.caption}</textarea>
            </div>
            
            <div class="mt-4 pt-4 border-t border-white/10">
                <p class="text-[10px] text-indigo-400 font-black mb-2 uppercase">📅 發布排程 (Schedule)</p>
                <div class="flex gap-2 mb-3">
                    <button id="btnSchNow" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold border border-indigo-500 transition-all shadow-lg">🚀 立即發布</button>
                    <button id="btnSchLater" class="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl text-xs font-bold border border-white/10 hover:bg-slate-700 hover:text-white transition-all">🕒 預約排程</button>
                </div>
                <div id="schPanel" class="hidden flex gap-2 animate-fade-in bg-slate-800/50 p-3 rounded-xl border border-white/5">
                    <input type="date" id="schDate" class="w-1/2 bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                    <select id="schTime" class="w-1/2 bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 custom-select">
                        ${timeOptions}
                    </select>
                </div>
            </div>

            <button id="btnRender" class="w-full bg-green-600 hover:bg-green-500 py-5 rounded-xl font-black text-sm shadow-[0_0_20px_rgba(22,163,74,0.4)] mt-2 transition-all">
                <span>🎨 確認無誤，扣點算圖並發布</span>
            </button>
        </div>
    `);

    // 🌟 排程切換邏輯
    ui.querySelector('#btnSchNow').onclick = () => {
        MISSION.scheduleMode = 'NOW';
        ui.querySelector('#btnSchNow').className = "flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold border border-indigo-500 transition-all shadow-lg";
        ui.querySelector('#btnSchLater').className = "flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl text-xs font-bold border border-white/10 hover:bg-slate-700 hover:text-white transition-all";
        ui.querySelector('#schPanel').classList.add('hidden');
        ui.querySelector('#btnRender span').innerText = "🎨 確認無誤，扣點算圖並發布";
    };

    ui.querySelector('#btnSchLater').onclick = () => {
        MISSION.scheduleMode = 'LATER';
        ui.querySelector('#btnSchLater').className = "flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold border border-indigo-500 transition-all shadow-lg";
        ui.querySelector('#btnSchNow').className = "flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl text-xs font-bold border border-white/10 hover:bg-slate-700 hover:text-white transition-all";
        ui.querySelector('#schPanel').classList.remove('hidden');
        ui.querySelector('#btnRender span').innerText = "📅 扣點算圖，並加入排程佇列";
        
        // 預設填入今天的日期
        const today = new Date().toISOString().split('T')[0];
        ui.querySelector('#schDate').value = today;
    };

    ui.querySelector('#btnRender').onclick = async () => {
        if(MISSION.scheduleMode === 'LATER' && !ui.querySelector('#schDate').value) {
            return alert("⚠️ 請選擇預約排程的日期！");
        }
        lockUI(ui); 
        const statusMsg = MISSION.scheduleMode === 'LATER' ? "任務已加入排程佇列！正在啟動背景算圖..." : "腳本定案！正式啟動視覺引擎渲染...";
        await addLog("美術總監", "🎨", statusMsg, true);
    };
}

// --- 角色與素材牆 (包含側欄連動) ---
async function triggerCharacterPicker() {
    const charData = STATE.lastSystemData?.characters || [
        { name: '老K', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=K' },
        { name: '米亞', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia' }
    ];
    const charDiv = document.createElement('div'); charDiv.className = 'skill-card flex gap-4 overflow-x-auto py-4 px-2 no-scrollbar mb-6 items-center';
    
    const manageBtn = document.createElement('div');
    manageBtn.className = 'flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-full border border-dashed border-indigo-400 text-indigo-400 hover:bg-indigo-500/20 cursor-pointer transition-all';
    manageBtn.innerHTML = '<span class="text-xl">⚙️</span>'; manageBtn.onclick = () => { if(window.openCharacterLib) window.openCharacterLib(); }; charDiv.appendChild(manageBtn);

    charData.forEach(char => {
        const card = document.createElement('div'); card.className = 'flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group';
        card.innerHTML = `<div class="w-14 h-14 rounded-full border-2 border-slate-700 group-hover:border-blue-500 transition-all overflow-hidden shadow-lg bg-slate-800"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[10px] font-bold text-slate-400 group-hover:text-blue-400">${char.name}</span>`;
        card.onclick = async () => { if (!MISSION.characters.includes(char.name)) { MISSION.characters.push(char.name); await addLog("視覺工程師", "✅", `已召喚「${char.name}」。`); card.classList.add('opacity-40', 'pointer-events-none'); } }; charDiv.appendChild(card);
    });
    document.getElementById('funnelLog').appendChild(charDiv); scrollDown();
}

async function handleAssetUpload(files) {
    const previewDiv = document.createElement('div'); previewDiv.className = 'skill-card flex flex-wrap gap-2 p-2 bg-slate-900/30 rounded-lg mb-6';
    for (let file of files) {
        MISSION.sceneFiles.push(file); const reader = new FileReader(); reader.onload = (e) => { previewDiv.innerHTML += `<div class="relative w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${e.target.result}" class="w-full h-full object-cover"></div>`; }; reader.readAsDataURL(file);
    }
    document.getElementById('funnelLog').appendChild(previewDiv); await addLog("影像處理組", "📐", `成功載入 ${files.length} 張素材。`); scrollDown();
}

// 輔助工具
function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function createSkillUI(html) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'skill-card ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6'; div.innerHTML = html; log.appendChild(div); scrollDown(); return div; }
async function addLog(role, icon, msg, skipTyping = false) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'flex items-start gap-4 animate-fade-in mb-4'; div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[85%]"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`; log.appendChild(div); scrollDown(); if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; } }
