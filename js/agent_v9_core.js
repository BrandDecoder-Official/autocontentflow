// js/agent_v9_core.js
import { STATE } from './config.js';

// 🌟 版本控制號
const APP_VERSION = "V0.5版";

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
    objectFiles: []
};

let IS_EDIT_MODE = false;

// 🎭 風格宇宙資料
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
    ]
};

// ==========================================
// 🚀 核心：初始化與流程控制
// ==========================================

export async function initAgentFunnel() {
    updateStepHeader("SYSTEM READY");
    const pointsEl = document.getElementById('userPoints');
    if (pointsEl) pointsEl.innerText = (STATE.userPoints || 0).toLocaleString();

    await addLog("專案總監", "👨‍💼", `${APP_VERSION} - 總編您好，終極防呆機制已啟動。未補齊卷宗將無法發包。`);
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
        // 🛡️ 防呆 1：必須選平台
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
        // 🛡️ 防呆 2：不能送出空字串
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
    await addLog("美術總監", "🌌", "請選擇本次內容的視覺宇宙：", true);

    const ui = createSkillUI(`
        <div class="grid grid-cols-2 gap-3">
            <button class="uni-btn p-5 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC">
                <span class="text-3xl">📷</span><span class="font-black text-sm text-white">真實攝影</span>
            </button>
            <button class="uni-btn p-5 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC">
                <span class="text-3xl">🎨</span><span class="font-black text-sm text-white">2D 動漫</span>
            </button>
        </div>
    `);

    ui.querySelectorAll('.uni-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.universe = btn.dataset.val; MISSION.style = ''; lockUI(ui);
            await addLog("美術總監", "✅", `已鎖定「${MISSION.universe === 'REALISTIC' ? '真實攝影' : '2D 動漫'}」。`);
            await triggerStyleSkill();
        };
    });
}

/** 🛠️ Skill 4: 動態風格 */
async function triggerStyleSkill() {
    updateStepHeader("STYLE SELECTION");
    const styles = MOCK_STYLES[MISSION.universe];
    let styleHtml = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">`;
    styles.forEach(s => {
        styleHtml += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.id ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.id}" data-name="${s.name}"><span class="text-xl">${s.icon}</span><span class="font-bold text-xs text-white">${s.name}</span><span class="text-[9px] text-slate-400">${s.desc}</span></button>`;
    });
    styleHtml += `</div>`;

    const ui = createSkillUI(styleHtml);
    ui.querySelectorAll('.style-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.style = btn.dataset.val; lockUI(ui);
            await addLog("美術總監", "✅", `風格鎖定為「${btn.dataset.name}」。`);
            if (IS_EDIT_MODE) { IS_EDIT_MODE = false; await triggerMissionSummary(); } else { await triggerVisualSkill(); }
        };
    });
}

/** 🛠️ Skill 5: 視覺參數與角色召喚 (防呆核心) */
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG");
    await addLog("美術總監", "👨‍🎨", "最後，請確認畫面比例，並【務必召喚至少一位角色】：", true);

    const ui = createSkillUI(`
        <div class="space-y-6">
            <div class="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/30">
                <div class="grid grid-cols-2 gap-3" id="summaryTags">
                    <button onclick="window.quickEdit('RATIO')" class="flex flex-col items-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all"><span class="text-[9px] text-slate-500">比例</span><span class="text-xs font-black text-white tag-ratio">${MISSION.ratio}</span></button>
                    <button onclick="window.quickEdit('RES')" class="flex flex-col items-center bg-slate-800 hover:bg-slate-700 p-3 rounded-xl border border-white/10 transition-all"><span class="text-[9px] text-slate-500">解析度</span><span class="text-xs font-black text-white tag-res">${MISSION.resolution}</span></button>
                </div>
            </div>
            <div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">
                <div class="grid grid-cols-3 gap-2">
                    <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='9:16'?'bg-blue-600':''}" data-val="9:16">9:16</button>
                    <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='16:9'?'bg-blue-600':''}" data-val="16:9">16:9</button>
                    <button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold ${MISSION.ratio==='1:1'?'bg-blue-600':''}" data-val="1:1">1:1</button>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <button id="btnSummonChar" class="bg-indigo-600/20 py-4 rounded-2xl text-xs font-black border border-indigo-500/50 hover:bg-indigo-600/40 transition-colors"><span class="text-lg">🧬</span> 召喚角色基因</button>
                <button id="btnUploadScene" class="bg-slate-800 py-4 rounded-2xl text-xs font-black border border-white/10 hover:bg-slate-700 transition-colors"><span class="text-lg">📸</span> 上傳場景圖</button>
            </div>
            <button id="btnAcceptVisual" class="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(59,130,246,0.4)]">✅ 鎖定參數</button>
        </div>
    `);

    window.quickEdit = (type) => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth' }); };
    ui.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.onclick = () => {
            MISSION.ratio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600'));
            btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = MISSION.ratio; 
        };
    });
    
    ui.querySelector('#btnSummonChar').onclick = async () => triggerCharacterPicker();
    
    ui.querySelector('#btnAcceptVisual').onclick = async () => {
        // 🛡️ 防呆 3：強制檢查是否已選角色
        if (MISSION.characters.length === 0) {
            alert('⚠️ 系統防呆：您尚未召喚任何角色！請點擊「🧬 召喚角色基因」。');
            return; // 終止流程，按鈕不會被鎖定
        }
        lockUI(ui); IS_EDIT_MODE = false; await triggerMissionSummary(); 
    };
}

/** 🛠️ Skill 6: 任務最終摘要 (修復顯示缺漏) */
async function triggerMissionSummary() {
    updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "請確認發布清單，無誤後我們將請「首席文案」開始編撰腳本：", true);

    const universeLabel = MISSION.universe === 'REALISTIC' ? '真實攝影' : '2D動漫';
    const styleObj = MOCK_STYLES[MISSION.universe].find(s => s.id === MISSION.style);
    const styleName = styleObj ? styleObj.name : '未選擇';

    // 🌟 修復點：將所有的參數完整渲染出來
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
                    <span class="text-xs text-slate-500">🌌 視覺</span><span class="text-xs font-bold text-white group-hover:text-blue-400">${universeLabel} / ${styleName} ✎</span>
                </div>
                <div class="flex justify-between cursor-pointer group hover:bg-white/5 p-2 rounded-lg" onclick="window.retryStep('VISUAL')">
                    <span class="text-xs text-slate-500">📐 參數</span><span class="text-xs font-bold text-white group-hover:text-blue-400">${MISSION.ratio} / ${MISSION.resolution} ✎</span>
                </div>
                <div class="flex justify-between items-center p-2">
                    <span class="text-xs text-slate-500">👥 角色</span><span class="text-xs font-bold text-white">${MISSION.characters.join(', ')}</span>
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
        // 🛡️ 防呆 4：最終發包前檢查 JSON 完整度
        if (!MISSION.topic || MISSION.platforms.length === 0 || MISSION.characters.length === 0 || !MISSION.style) {
            alert("⚠️ 系統防呆：卷宗資料異常或不完整，無法啟動發射程序！");
            return;
        }
        lockUI(summaryUI); await executeDraftSim(); 
    };
}

/** 🛠️ Skill 7: 模擬生成腳本 */
async function executeDraftSim() {
    updateStepHeader("DRAFTING SCRIPT");
    await addLog("首席文案", "✍️", "收到指令，正在為您編撰專屬貼文腳本與分鏡...");
    await new Promise(r => setTimeout(r, 1000));
    
    const mockDraft = {
        caption: `就在今天！準備好跟著主角一起進入「${MISSION.topic}」的世界了嗎？🔥 這絕對是今年最棒的體驗！大家快來朝聖！`,
        hashtags: ['#最新動態', '#熱門話題', '#必看', '#趨勢'],
        panels: MISSION.universe === 'COMIC' ? [
            { id: 1, dialogue: "哇！這裡的風景也太棒了吧！" },
            { id: 2, dialogue: "真的是絕景，快幫我拍一張！" }
        ] : null
    };

    await triggerDraftReviewSkill(mockDraft);
}

/** 🛠️ Skill 8: 腳本審閱 (含服裝造型建議) */
async function triggerDraftReviewSkill(draft) {
    updateStepHeader("DRAFT REVIEW");
    await addLog("專案總監", "👨‍💼", "總編，腳本已出爐！您可以檢視貼文與修改裝扮設定：", true);

    let panelsHtml = '';
    if (draft.panels) {
        panelsHtml = `<div class="mt-4 pt-4 border-t border-white/10"><p class="text-[10px] text-pink-400 font-black mb-2 uppercase">💬 漫畫對白分鏡</p><div class="space-y-2">`;
        draft.panels.forEach(p => { panelsHtml += `<div class="flex gap-2 items-start bg-slate-800 p-2 rounded-lg"><span class="text-xs font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded">框 ${p.id}</span><textarea class="flex-grow bg-transparent border-none text-xs text-white resize-none focus:ring-0" rows="1">${p.dialogue}</textarea></div>`; });
        panelsHtml += `</div></div>`;
    }

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
            
            <div class="bg-indigo-900/30 p-3 rounded-xl border border-indigo-500/40">
                <p class="text-[10px] text-indigo-300 font-black mb-2 uppercase">👗 依主題推薦之外觀裝扮 (外掛)</p>
                <textarea class="w-full bg-slate-800/50 border border-white/5 rounded-lg p-2 text-xs text-white focus:border-indigo-500 focus:ring-1 transition-all resize-none" rows="2" placeholder="例如：穿著黑色西裝、戴著墨鏡...">依照「${MISSION.topic}」為角色搭配適合的潮流服飾</textarea>
            </div>

            <div>
                <p class="text-[10px] text-indigo-400 font-black mb-2 uppercase">📝 貼文內文 (可編輯)</p>
                <textarea class="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none" rows="4">${draft.caption}</textarea>
            </div>
            <div>
                <p class="text-[10px] text-indigo-400 font-black mb-2 uppercase">🏷️ 社群 Hashtag</p>
                <div class="flex flex-wrap gap-2">
                    ${draft.hashtags.map(t => `<span class="bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:bg-indigo-600/40">${t} ✕</span>`).join('')}
                    <button class="bg-slate-800 text-slate-400 border border-white/10 px-2 py-1 rounded-md text-[10px] font-bold hover:bg-slate-700">＋ 新增</button>
                </div>
            </div>
            ${panelsHtml}
            <button id="btnRender" class="w-full bg-green-600 hover:bg-green-500 py-4 rounded-xl font-black text-sm shadow-lg shadow-green-900/30 transition-all flex justify-center gap-2 mt-4">
                <span>🎨 腳本確認無誤，扣點算圖</span>
            </button>
        </div>
    `);

    ui.querySelector('#btnRender').onclick = async () => {
        lockUI(ui);
        await addLog("美術總監", "🎨", "腳本與裝扮設定已定案！正式啟動視覺引擎渲染...", true);
    };
}

// --- 角色與素材牆 (提供 MOCK 資料避免空白) ---
async function triggerCharacterPicker() {
    // 放入假資料讓您可以直接選
    const charData = STATE.lastSystemData?.characters || [
        { name: '老K', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=K' },
        { name: '米亞', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia' }
    ];
    const charDiv = document.createElement('div'); charDiv.className = 'skill-card flex gap-4 overflow-x-auto py-4 px-2 no-scrollbar mb-6';
    charData.forEach(char => {
        const card = document.createElement('div'); card.className = 'flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group';
        card.innerHTML = `<div class="w-14 h-14 rounded-full border-2 border-slate-700 group-hover:border-blue-500 transition-all overflow-hidden shadow-lg bg-slate-800"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[10px] font-bold text-slate-400 group-hover:text-blue-400">${char.name}</span>`;
        card.onclick = async () => {
            if (!MISSION.characters.includes(char.name)) { MISSION.characters.push(char.name); await addLog("視覺工程師", "✅", `已召喚「${char.name}」。`); card.classList.add('opacity-40', 'pointer-events-none'); }
        };
        charDiv.appendChild(card);
    });
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

// 輔助工具
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
