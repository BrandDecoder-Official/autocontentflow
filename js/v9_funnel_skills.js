// js/v9_funnel_skills.js
import { MISSION, SYSTEM_DB, IS_EDIT_MODE, isMissionComplete, compressImage, markImageRegenerationRequired, getMissionCharacterNames, bootSystemData, ensureSyntheticPublishMask, PUBLISH_MEDIA_MAX_TOTAL, recordGeneratedImageBatch } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError, initSplitPaneLayout } from './v9_ui.js';
import { decodeHTMLEntities } from './v9_funnel_utils.js';
import { triggerMissionSummary } from './v9_funnel_dashboard.js';
import { CONFIG, STATE } from './config.js'; 
import * as API from './api.js';
import { applyPointDeduction, validatePoints, getImageGenBillingMultiplier } from './v9_finance.js';

export async function startNewFunnel() { await triggerTopicSkill(); }

/**
 * ==========================================
 * 📌 核心漏斗 STEP 1：確立任務主題 (triggerTopicSkill)
 * 💡 功能說明：收集並鎖定本次行銷任務的核心目標與推廣內容。
 * 🚀 V1 終極版升級：實裝「RSS 熱門新聞進料模組」，一鍵抓取靈感。
 * ==========================================
 */
export async function triggerTopicSkill() { 
    MISSION.funnelNextStep = 'topic';
    updateStepHeader("STEP 1: STRATEGY (TOPIC)"); 
    await addLog("專案總監", "📝", "第一步，請告訴我，我們這次要推廣什麼內容或達成什麼目標？", true);
    
    const ui = createSkillUI(`
        <div class="flex flex-col gap-4 relative">
            <p class="text-[11px] text-slate-400 leading-relaxed px-0.5">請擇一或並用：左欄<strong class="text-slate-300">自填</strong>、右欄<strong class="text-slate-300">從 Google News 熱門帶入</strong>（帶入後請在左欄改寫）。</p>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                <div class="flex flex-col rounded-2xl border border-blue-500/35 bg-slate-900/60 p-4 shadow-inner min-h-[280px]">
                    <label class="text-xs font-black text-blue-300 tracking-wide mb-1">✍️ 自行輸入主題</label>
                    <p class="text-[10px] text-slate-500 mb-3 leading-relaxed">直接寫推廣內容、產品、活動或 KPI；可貼長文，最終以左欄文字為準。</p>
                    <div class="relative flex-1 flex flex-col min-h-[200px]">
                        <textarea id="inlineTopicInput" maxlength="1000" class="w-full flex-1 min-h-[200px] bg-slate-950/80 border border-blue-500/25 rounded-xl p-4 pb-8 text-sm text-white focus:outline-none focus:border-blue-500 resize-y" placeholder="例：本週主打 OO 課程早鳥、限時優惠…">${decodeHTMLEntities(MISSION.topic || '')}</textarea>
                        <div id="topicCharCount" class="absolute bottom-3 right-4 text-[10px] font-bold text-slate-500 bg-slate-950/90 px-1 rounded">0 / 1000 字</div>
                    </div>
                </div>

                <div id="rssPanel" class="flex flex-col rounded-2xl border border-indigo-500/40 bg-slate-900/60 p-4 shadow-inner min-h-[280px]">
                    <label class="text-xs font-black text-indigo-300 tracking-wide mb-1">📰 熱門新聞靈感（Google News RSS）</label>
                    <p class="text-[10px] text-slate-500 mb-3 leading-relaxed">來源為<strong class="text-slate-400">Google News、央廣 RTI、自由時報</strong>等 RSS 合併；<strong class="text-slate-400">房市／投資</strong>為 Google 關鍵字 RSS 細分（仍非全文摘要）。已優先挑<strong class="text-slate-400">內文較長</strong>的項目。點一則填入左欄後請再改寫。</p>
                    <div class="flex overflow-x-auto gap-2 pb-2 scrollbar-hide shrink-0" id="rssCategoryTabs">
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-indigo-600 text-white border border-indigo-500 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all min-h-[40px]" data-cat="BUSINESS">財金</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="REAL_ESTATE">房市</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="INVESTMENT">投資</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="POLITICS">政治</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="WORLD">國際</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="ENTERTAINMENT">娛樂</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="SPORTS">運動</button>
                        <button type="button" class="rss-cat-btn px-3 py-2 bg-slate-800 text-slate-300 border border-white/10 rounded-xl text-[10px] font-bold whitespace-nowrap hover:bg-slate-700 transition-all min-h-[40px]" data-cat="LIFE">生活</button>
                    </div>
                    <div id="rssLoading" class="hidden text-center text-[10px] text-indigo-400 py-8 animate-pulse font-bold shrink-0">📡 正在接收 Google News RSS…</div>
                    <div id="rssList" class="flex flex-col gap-2 flex-1 min-h-[200px] max-h-[260px] overflow-y-auto pr-1 custom-scrollbar border border-white/5 rounded-xl bg-slate-950/40 p-2"></div>
                </div>
            </div>

            <div class="flex justify-end mt-1">
                <button type="button" id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認戰略方向</button>
            </div>
        </div>
    `);
    
    const inputEl = ui.querySelector('#inlineTopicInput'); 
    const countEl = ui.querySelector('#topicCharCount');
    
    // 🧮 字數計算器
    const updateCount = () => {
        const len = inputEl.value.length;
        countEl.innerText = `${len} / 1000 字`;
        if (len >= 1000) countEl.classList.replace('text-slate-500', 'text-red-400');
        else countEl.classList.replace('text-red-400', 'text-slate-500');
    };
    inputEl.addEventListener('input', updateCount);
    updateCount(); 

    // 📡 RSS 模組（與自填並列，預設載入財金）
    const rssCategoryTabs = ui.querySelectorAll('.rss-cat-btn');
    const rssList = ui.querySelector('#rssList');
    const rssLoading = ui.querySelector('#rssLoading');

    rssCategoryTabs.forEach(btn => {
        btn.onclick = () => {
            rssCategoryTabs.forEach(b => {
                b.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500');
                b.classList.add('bg-slate-800', 'text-slate-300', 'border-white/10');
            });
            btn.classList.remove('bg-slate-800', 'text-slate-300', 'border-white/10');
            btn.classList.add('bg-indigo-600', 'text-white', 'border-indigo-500');
            loadRSSNews(btn.dataset.cat);
        };
    });

    async function loadRSSNews(category) {
        rssList.innerHTML = '';
        rssLoading.classList.remove('hidden');
        try {
            // 💡 修正：換成系統標準的 CLOUD_RUN_URL，並確保沒有多餘的斜線
            const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.CLOUD_RUN_URL) ? CONFIG.CLOUD_RUN_URL.replace(/\/$/, '') : '';
            const res = await fetch(`${baseUrl}/api/rss/news?category=${encodeURIComponent(category)}`);
            const json = await res.json();
            
            if (json.success && json.data) {
                if (json.data.length === 0) {
                    rssList.innerHTML = `<div class="text-[10px] text-slate-400 text-center py-4">此分類目前無新聞</div>`;
                    return;
                }
                json.data.forEach(news => {
                    const div = document.createElement('div');
                    div.className = "p-3 bg-slate-900 border border-white/5 rounded-lg hover:bg-indigo-900/40 hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col gap-1";
                    const srcEl = document.createElement('span');
                    srcEl.className = 'text-[9px] font-bold text-indigo-400/90 tracking-wide';
                    srcEl.textContent = news.source || 'RSS';
                    const titleEl = document.createElement('span');
                    titleEl.className = 'text-xs font-bold text-white line-clamp-2 leading-tight';
                    titleEl.textContent = news.title || '';
                    const bodyEl = document.createElement('span');
                    bodyEl.className = 'text-[10px] text-slate-400 line-clamp-4 leading-snug';
                    bodyEl.textContent = news.content || '';
                    div.appendChild(srcEl);
                    div.appendChild(titleEl);
                    div.appendChild(bodyEl);
                    div.onclick = async () => {
                        const summary = (news.content || '').trim() || '（此則 RSS 未附摘要，僅標題）';
                        const linkLine = (news.link || '').trim() ? `${news.link}` : '（無連結）';
                        const srcLine = (news.source || '').trim() || 'RSS';
                        inputEl.value = `【今日熱門話題】\n${news.title}\n\n【來源】\n${srcLine}\n\n【RSS 摘要（非全文）】\n${summary}\n\n【原文／追蹤連結】\n${linkLine}`;
                        updateCount();
                        inputEl.focus();
                        await addLog("情報官", "📡", `已帶入左欄：<b>${news.title.substring(0, 18)}...</b>（可再編輯）`);
                    };
                    rssList.appendChild(div);
                });
            } else {
                rssList.innerHTML = `<div class="text-[10px] text-red-400 text-center py-4">抓取失敗，請重試</div>`;
            }
        } catch(e) {
            console.error("RSS Error:", e);
            rssList.innerHTML = `<div class="text-[10px] text-red-400 text-center py-4">連線錯誤，無法取得新聞</div>`;
        } finally {
            rssLoading.classList.add('hidden');
        }
    }

    loadRSSNews('BUSINESS');
    setTimeout(() => { inputEl.focus(); }, 100);
    
    ui.querySelector('#btnConfirmTopic').onclick = async () => { 
        const val = inputEl.value.trim(); 
        if(!val) return showError('主題不能為空！'); 
        MISSION.topic = val; 
        releaseUI(ui); 
        await addLog("總編指令", "🎯", `戰略鎖定：${val.substring(0, 20)}...`); 

        // 🧠 企劃大腦：設定好主題後，即刻在對話中呈現生圖風格企劃建議
        const tempSuggestion = getEarlyImagePlanSuggestion(val);
        await addLog("大腦企劃", "💡", `<b>大腦生圖風格建議</b>：<br>根據您的主題，建議採用 <b>${tempSuggestion.universeText}</b> 進行視覺創作。<br><i>原因：${tempSuggestion.reason}</i>`);

        if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } 
        else { MISSION.funnelNextStep = 'platforms'; await triggerPlatformSkill(); } 
    };
}

/**
 * ==========================================
 * 📌 核心漏斗 STEP 2：選擇發布平台 (triggerPlatformSkill)
 * 💡 功能說明：定義本次內容即將空投的社群戰場。
 * ==========================================
 */
export async function triggerPlatformSkill() { 
    updateStepHeader("STEP 2: BATTLEFIELD (PLATFORMS)"); 
    await addLog("社群總監", "🚀", "這波戰役，我們打算空投到哪些平台？", true);
    
    const ui = createSkillUI(`
        <div class="flex flex-col">
            <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 lg:gap-3 mb-6" id="platformMatrix">
                <div class="plat-card flex flex-col items-center gap-2 group cursor-pointer transition-all" data-val="FB" data-active="border-blue-500 bg-blue-600/20" data-inactive="border-white/10 bg-slate-800">
                    <div class="w-12 h-12 lg:w-16 lg:h-16 border rounded-2xl flex justify-center items-center transition-all icon-box border-white/10 bg-slate-800"><i class="fa-brands fa-facebook-f text-xl lg:text-3xl icon-color text-slate-500"></i></div>
                    <span class="text-[9px] lg:text-[10px] font-bold text-slate-400 title-text">Facebook</span>
                </div>
                <div class="plat-card flex flex-col items-center gap-2 group cursor-pointer transition-all" data-val="IG" data-active="border-pink-500 bg-pink-600/20" data-inactive="border-white/10 bg-slate-800">
                    <div class="w-12 h-12 lg:w-16 lg:h-16 border rounded-2xl flex justify-center items-center transition-all icon-box border-white/10 bg-slate-800"><i class="fa-brands fa-instagram text-xl lg:text-3xl icon-color text-slate-500"></i></div>
                    <span class="text-[9px] lg:text-[10px] font-bold text-slate-400 title-text">Instagram</span>
                </div>
                <div class="plat-card flex flex-col items-center gap-2 group cursor-pointer transition-all" data-val="THREADS" data-active="border-white bg-white/10" data-inactive="border-white/10 bg-slate-800">
                    <div class="w-12 h-12 lg:w-16 lg:h-16 border rounded-2xl flex justify-center items-center transition-all icon-box border-white/10 bg-slate-800"><i class="fa-brands fa-threads text-xl lg:text-3xl icon-color text-slate-500"></i></div>
                    <span class="text-[9px] lg:text-[10px] font-bold text-slate-400 title-text">Threads</span>
                </div>
                <div class="flex flex-col items-center gap-2 grayscale opacity-40 cursor-not-allowed relative group">
                    <div class="absolute -top-3 bg-slate-700 text-[9px] px-2 py-0.5 rounded border border-slate-500 text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">籌備中</div>
                    <div class="w-12 h-12 lg:w-16 lg:h-16 bg-slate-800 border border-white/10 rounded-2xl flex justify-center items-center"><i class="fa-brands fa-line text-xl lg:text-3xl text-slate-400"></i></div>
                    <span class="text-[9px] lg:text-[10px] font-bold text-slate-500">LINE</span>
                </div>
                <div class="flex flex-col items-center gap-2 grayscale opacity-40 cursor-not-allowed relative group">
                    <div class="absolute -top-3 bg-slate-700 text-[9px] px-2 py-0.5 rounded border border-slate-500 text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">籌備中</div>
                    <div class="w-12 h-12 lg:w-16 lg:h-16 bg-slate-800 border border-white/10 rounded-2xl flex justify-center items-center"><i class="fa-brands fa-google text-xl lg:text-3xl text-slate-400"></i></div>
                    <span class="text-[9px] lg:text-[10px] font-bold text-slate-500">G.商家</span>
                </div>
                <div class="flex flex-col items-center gap-2 grayscale opacity-40 cursor-not-allowed relative group">
                    <div class="absolute -top-3 bg-slate-700 text-[9px] px-2 py-0.5 rounded border border-slate-500 text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">籌備中</div>
                    <div class="w-12 h-12 lg:w-16 lg:h-16 bg-slate-800 border border-white/10 rounded-2xl flex justify-center items-center"><i class="fa-brands fa-wordpress text-xl lg:text-3xl text-slate-400"></i></div>
                    <span class="text-[9px] lg:text-[10px] font-bold text-slate-500">Blog</span>
                </div>
            </div>
            <div class="flex justify-end border-t border-white/10 pt-4 mt-auto">
                <button id="btnConfirmPlat" class="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">鎖定戰場，準備發起任務</button>
            </div>
        </div>
    `);

    let tempPlats = [...(MISSION.platforms || [])];
    ui.querySelectorAll('.plat-card').forEach(card => { 
        card.onclick = () => { 
            const val = card.dataset.val; 
            const activeClasses = card.dataset.active.split(' '); 
            const inactiveClasses = card.dataset.inactive.split(' ');
            const box = card.querySelector('.icon-box');
            const icon = card.querySelector('.icon-color');
            const text = card.querySelector('.title-text');
            if (tempPlats.includes(val)) { 
                tempPlats = tempPlats.filter(p => p !== val); 
                box.classList.remove(...activeClasses); box.classList.add(...inactiveClasses); 
                icon.classList.replace(`text-${activeClasses[0].split('-')[1]}-500`, 'text-slate-500'); 
                text.classList.replace('text-white', 'text-slate-400');
            } else { 
                tempPlats.push(val); 
                box.classList.remove(...inactiveClasses); box.classList.add(...activeClasses); 
                icon.classList.replace('text-slate-500', `text-${activeClasses[0].split('-')[1]}-500`); 
                if(val === 'THREADS') icon.classList.replace('text-slate-500', 'text-white');
                text.classList.replace('text-slate-400', 'text-white');
            } 
        }; 
    });

    ui.querySelector('#btnConfirmPlat').onclick = async () => { 
        if (tempPlats.length === 0) return showError('請至少選擇一個平台！'); 
        MISSION.platforms = tempPlats; 
        releaseUI(ui); 
        await addLog("社群總監", "✅", `已鎖定平台：${MISSION.platforms.join(' / ')}。`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } 
        else { MISSION.funnelNextStep = 'persona'; await triggerPersonaSkill(); } 
    };
}

/**
 * ==========================================
 * 📌 核心漏斗 STEP 3：選擇品牌人設 (triggerPersonaSkill)
 * ==========================================
 */
export async function triggerPersonaSkill() { 
    updateStepHeader("STEP 3: SOUL (PERSONA)"); 
    await addLog("專案總監", "🎭", "請指派本次任務的靈魂（品牌人設）：", true);
    let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3">`; 
    SYSTEM_DB.personas.forEach(p => { 
        html += `<button class="persona-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.persona === p.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${p.name}"><span class="text-xl lg:text-2xl mb-1">${p.icon}</span><span class="font-bold text-xs lg:text-sm text-white truncate w-full">${p.name}</span><span class="text-[9px] lg:text-[10px] text-slate-400 leading-tight truncate w-full">${p.desc}</span></button>`; 
    }); 
    html += `</div>`;
    const ui = createSkillUI(html); 
    ui.querySelectorAll('.persona-btn').forEach(btn => { 
        btn.onclick = async () => { 
            MISSION.persona = btn.dataset.val; releaseUI(ui); 
            await addLog("專案總監", "✅", `已掛載人設模組：<b>${MISSION.persona}</b>。`); 
            if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } 
            else { MISSION.funnelNextStep = 'hook'; await triggerHookSkill(); } 
        }; 
    });
}

/**
 * ==========================================
 * 📌 核心漏斗 STEP 4：選擇戰術 (triggerHookSkill)
 * ==========================================
 */
export async function triggerHookSkill() { 
    updateStepHeader("STEP 4: TACTICS (HOOK & LENGTH)"); 
    await addLog("社群總監", "🎣", "人設鎖定！那麼開頭的第一句，我們打算怎麼抓住眼球？", true);
    const strategyPanelHTML = `
        <div class="flex flex-col gap-4">
            <p class="text-[10px] text-slate-500 leading-relaxed">文案篇幅請在儀表板的「發文戰術」依平台設定；此步僅鎖定開場勾子類型。</p>
            <div class="flex flex-col gap-2">
                <label class="text-[10px] font-bold text-slate-400">🎣 開場勾子 (Hook)</label>
                <select id="selHookType" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer">
                    <option value="痛點提問" ${MISSION.hookType === '痛點提問' ? 'selected' : ''}>❓ 痛點提問</option>
                    <option value="反直覺爆點" ${MISSION.hookType === '反直覺爆點' ? 'selected' : ''}>💥 反直覺爆點</option>
                    <option value="利益誘惑" ${MISSION.hookType === '利益誘惑' ? 'selected' : ''}>🎁 利益誘惑</option>
                    <option value="溫情故事" ${MISSION.hookType === '溫情故事' ? 'selected' : ''}>📖 溫情故事</option>
                </select>
            </div>
            <div class="flex justify-end border-t border-white/10 pt-4">
                <button id="btnConfirmHook" class="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">🧠 鎖定戰術</button>
            </div>
        </div>
    `;
    const ui = createSkillUI(strategyPanelHTML);
    ui.querySelector('#btnConfirmHook').onclick = async () => { 
        MISSION.hookType = ui.querySelector('#selHookType').value; 
        releaseUI(ui); 
        await addLog("社群總監", "✅", `開場勾子已鎖定：<b>${MISSION.hookType}</b>（字數節奏請依儀表板各平台設定）`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } 
        else { MISSION.funnelNextStep = 'universe'; await triggerUniverseSkill(); }
    };
}

/**
 * ==========================================
 * 📌 核心漏斗 STEP 6：宇宙智能分流 (triggerUniverseSkill)
 * ==========================================
 */
export async function triggerUniverseSkill() { 
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const hasImg = MISSION.generatedImageBatches && MISSION.generatedImageBatches.length > 0;
    const disabledAttr = hasImg ? 'disabled title="已有生成圖片，風格與規格已被鎖定。"' : '';
    const disabledClass = hasImg ? 'opacity-50 cursor-not-allowed' : '';

    const ui = createSkillUI(`
        <div class="space-y-4">
            ${hasImg ? `<div class="bg-amber-600/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-bold mb-2">⚠️ 已有生成圖片，規格與宇宙參數已鎖定。</div>` : ''}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                <button class="uni-btn p-3 lg:p-4 rounded-2xl border border-white/10 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'} ${disabledClass}" data-val="REALISTIC" ${disabledAttr}><span class="text-2xl lg:text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button>
                <button class="uni-btn p-3 lg:p-4 rounded-2xl border border-white/10 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'} ${disabledClass}" data-val="COMIC" ${disabledAttr}><span class="text-2xl lg:text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button>
            </div>
            <div class="bg-slate-900/60 border border-white/10 rounded-xl p-3 space-y-2">
                <label class="text-[10px] text-slate-400 font-bold">子項模式</label>
                <p class="text-[9px] text-slate-500 leading-relaxed">
                    <strong class="text-slate-400">新生成</strong>：從風格／濾鏡／角色／視覺素材全流程產出。<br>
                    <strong class="text-slate-400">無損美化</strong>：<strong>同樣會走風格／濾鏡／角色</strong>；差異在「視覺與附件」步驟須以上傳<strong>來源圖</strong>（主參考欄）為主做精修／改畫。
                </p>
                <div class="grid grid-cols-2 gap-2">
                    <button class="mode-btn py-2 rounded-lg border text-xs font-bold transition-all ${MISSION.taskMode === 'GENERATE' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/10 bg-slate-800 text-slate-400'} ${disabledClass}" data-val="GENERATE" ${disabledAttr}>新生成</button>
                    <button class="mode-btn py-2 rounded-lg border text-xs font-bold transition-all ${MISSION.taskMode === 'ENHANCE' ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-white/10 bg-slate-800 text-slate-400'} ${disabledClass}" data-val="ENHANCE" ${disabledAttr}>無損美化</button>
                </div>
            </div>
        </div>
    `);
    ui.querySelectorAll('.mode-btn').forEach(btn => {
        btn.onclick = () => {
            if (hasImg) return;
            MISSION.taskMode = btn.dataset.val;
            ui.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('border-indigo-500', 'bg-indigo-600', 'text-white');
                b.classList.add('border-white/10', 'bg-slate-800', 'text-slate-400');
            });
            btn.classList.remove('border-white/10', 'bg-slate-800', 'text-slate-400');
            btn.classList.add('border-indigo-500', 'bg-indigo-600', 'text-white');
        };
    });
    ui.querySelectorAll('.uni-btn').forEach(btn => { 
        btn.onclick = async () => { 
            const oldUni = MISSION.universe; 
            MISSION.universe = btn.dataset.val; 
            
            // 💡 變更宇宙時，徹底重置相關參數與素材 (包含 1+9 圖)
            if (oldUni !== MISSION.universe) { 
                MISSION.style = ''; 
                MISSION.colorMode = ''; 
                MISSION.characters = []; 
                MISSION.sceneFiles = []; 
                MISSION.attachmentFiles = []; 
                MISSION.ratio = MISSION.taskMode === 'ENHANCE' ? '原圖比例' : '9:16'; 
            } 
            
            releaseUI(ui); 
            await addLog("美術總監", "✅", `宇宙鎖定：${MISSION.universe} / ${MISSION.taskMode === 'ENHANCE' ? '無損美化' : '新生成'}。`); 

            // 第 1 輪：GENERATE / ENHANCE 皆先走風格鏈（寫實：模式→濾鏡；漫畫：風格→色系），再進角色與視覺；無損不再跳過風格。
            // 第 2 輪：儀表板畫面比例納入「原圖比例」、場景預覽與 v9_funnel_skills 無損文案對齊。
            if (IS_EDIT_MODE.value && isMissionComplete()) {
                MISSION.funnelNextStep = 'dashboard';
                await triggerMissionSummary();
            } else {
                MISSION.funnelNextStep = 'style';
                await triggerStyleSkill();
            }
        }; 
    });
}

/**
 * ==========================================
 * 🚀 智能分流：triggerStyleSkill
 * ==========================================
 */
export async function triggerStyleSkill() { 
    const hasImg = MISSION.generatedImageBatches && MISSION.generatedImageBatches.length > 0;
    const disabledAttr = hasImg ? 'disabled title="已有生成圖片，風格已被鎖定。"' : '';
    const disabledClass = hasImg ? 'opacity-50 cursor-not-allowed' : '';

    if (MISSION.universe === 'REALISTIC') {
        updateStepHeader("SYNTHESIS MODE"); 
        await addLog("攝影總監", "📸", "進入寫實攝影棚！請選擇這張圖的「核心對焦與合成模式」：", true);
        
        let modes = SYSTEM_DB.styles.filter(s => s.category === 'REALISTIC_MODE');
        if (modes.length === 0) {
            await addLog('攝影總監', '⚠️', '寫實合成模式尚未從後台載入，已暫停選項（避免錯誤扣點）。', true);
            const ui = createSkillUI(`
                <div class="flex flex-col gap-4 p-2">
                    <p class="text-sm font-bold text-amber-200 leading-relaxed">風格整理中或尚未開放，請稍待…</p>
                    <p class="text-xs text-slate-400 leading-relaxed">目前沒有可用的「寫實合成模式」（<code class="text-slate-500">REALISTIC_MODE</code>）。請確認管理後台已啟用對應風格，或稍後再試。不會套用任何預設選項。</p>
                    <button type="button" id="btnRetryRealisticModes" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-black active:scale-[0.99]">重新載入選項</button>
                </div>`);
            ui.querySelector('#btnRetryRealisticModes').onclick = async () => {
                await addLog('系統', '⏳', '正在重新同步雲端風格資料…', true);
                await bootSystemData();
                releaseUI(ui);
                await triggerStyleSkill();
            };
            return;
        }

        let html = `
            <div class="space-y-4">
                ${hasImg ? `<div class="bg-amber-600/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-bold mb-2">⚠️ 已有生成圖片，風格已鎖定。</div>` : ''}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-3">
        `;
        modes.forEach(m => { 
            html += `<button class="style-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === m.name ? 'border-blue-500 bg-slate-700' : ''} ${disabledClass}" data-val="${m.name}" ${disabledAttr}><span class="text-xl lg:text-2xl mb-1">${m.icon || '✨'}</span><span class="font-bold text-[11px] lg:text-xs text-white">${m.name}</span><span class="text-[9px] text-slate-400 line-clamp-2">${m.desc || m.promptPrefix || ''}</span></button>`; 
        }); 
        html += `</div></div>`;
        const ui = createSkillUI(html); 
        ui.querySelectorAll('.style-btn').forEach(btn => { 
            btn.onclick = async () => { 
                MISSION.style = btn.dataset.val; 
                releaseUI(ui); 
                await addLog("攝影總監", "✅", `合成模式鎖定：<b>${MISSION.style}</b>。`); 
                if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } 
                else { MISSION.funnelNextStep = 'style'; await triggerRealisticFilterSkill(); } 
            }; 
        });

    } else {
        updateStepHeader("STYLE SELECTION"); 
        
        let availableStyles = SYSTEM_DB.styles.filter(s => {
            const sCat = String(s.category || '').trim().toUpperCase();
            return sCat === 'ANIME' || sCat === 'ANIME_STYLE';
        });
        if (availableStyles.length === 0) {
            await addLog('美術總監', '⚠️', '動漫風格尚未從後台載入，已暫停選項（避免錯誤扣點）。', true);
            const ui = createSkillUI(`
                <div class="flex flex-col gap-4 p-2">
                    <p class="text-sm font-bold text-amber-200 leading-relaxed">風格整理中或尚未開放，請稍待…</p>
                    <p class="text-xs text-slate-400 leading-relaxed">目前沒有可用的動漫風格（<code class="text-slate-500">ANIME</code> / <code class="text-slate-500">ANIME_STYLE</code>）。請確認管理後台已啟用對應風格，或稍後再試。不會套用任何預設選項。</p>
                    <button type="button" id="btnRetryAnimeStyles" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-black active:scale-[0.99]">重新載入選項</button>
                </div>`);
            ui.querySelector('#btnRetryAnimeStyles').onclick = async () => {
                await addLog('系統', '⏳', '正在重新同步雲端風格資料…', true);
                await bootSystemData();
                releaseUI(ui);
                await triggerStyleSkill();
            };
            return;
        }
        
        let html = `
            <div class="space-y-4">
                ${hasImg ? `<div class="bg-amber-600/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-bold mb-2">⚠️ 已有生成圖片，風格已鎖定。</div>` : ''}
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3">
        `;
        availableStyles.forEach(s => { 
            html += `<button class="style-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.name ? 'border-blue-500 bg-slate-700' : ''} ${disabledClass}" data-val="${s.name}" ${disabledAttr}><span class="text-lg lg:text-xl">${s.icon || '🎨'}</span><span class="font-bold text-[11px] lg:text-xs text-white">${s.name}</span></button>`; 
        }); 
        html += `</div></div>`;
        const ui = createSkillUI(html); 
        ui.querySelectorAll('.style-btn').forEach(btn => { 
            btn.onclick = async () => { 
                MISSION.style = btn.dataset.val; releaseUI(ui); 
                await addLog("美術總監", "✅", `風格鎖定：${MISSION.style}。`); 
                if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } 
                else { MISSION.funnelNextStep = 'style'; await triggerColorSkill(); } 
            }; 
        });
    }
}

/**
 * ==========================================
 * 📌 函數名稱：triggerRealisticFilterSkill
 * ==========================================
 */
export async function triggerRealisticFilterSkill() {
    updateStepHeader("PHOTOGRAPHY FILTER");
    await addLog("攝影總監", "🎞️", "請選擇這組照片的「濾鏡氛圍」：", true);
    
    const hasImg = MISSION.generatedImageBatches && MISSION.generatedImageBatches.length > 0;
    const disabledAttr = hasImg ? 'disabled title="已有生成圖片，濾鏡已被鎖定。"' : '';
    const disabledClass = hasImg ? 'opacity-50 cursor-not-allowed' : '';

    let filters = SYSTEM_DB.styles.filter(s => s.category === 'REALISTIC_FILTER');
    if (filters.length === 0) {
        await addLog('攝影總監', '⚠️', '寫實濾鏡尚未從後台載入，已暫停選項（避免錯誤扣點）。', true);
        const ui = createSkillUI(`
            <div class="flex flex-col gap-4 p-2">
                <p class="text-sm font-bold text-amber-200 leading-relaxed">濾鏡資料整理中或尚未開放，請稍待…</p>
                <p class="text-xs text-slate-400 leading-relaxed">目前沒有可用的攝影濾鏡（<code class="text-slate-500">REALISTIC_FILTER</code>）。請確認管理後台已啟用對應項目，或稍後再試。不會套用任何預設濾鏡。</p>
                <button type="button" id="btnRetryRealisticFilters" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-xs font-black active:scale-[0.99]">重新載入選項</button>
                <button type="button" id="btnBackToRealisticMode" class="w-full border border-white/15 bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl text-xs font-bold active:scale-[0.99]">返回上一步（重選合成模式）</button>
            </div>`);
        ui.querySelector('#btnRetryRealisticFilters').onclick = async () => {
            await addLog('系統', '⏳', '正在重新同步雲端風格資料…', true);
            await bootSystemData();
            releaseUI(ui);
            await triggerRealisticFilterSkill();
        };
        ui.querySelector('#btnBackToRealisticMode').onclick = async () => {
            releaseUI(ui);
            await triggerStyleSkill();
        };
        return;
    }

    let html = `
        <div class="space-y-4">
            ${hasImg ? `<div class="bg-amber-600/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-bold mb-2">⚠️ 已有生成圖片，濾鏡已被鎖定。</div>` : ''}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
    `;
    filters.forEach(f => {
        html += `<button class="color-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === f.name ? 'border-blue-500 bg-slate-700' : ''} ${disabledClass}" data-val="${f.name}" ${disabledAttr}><span class="text-xl lg:text-2xl mb-1">${f.icon || '🎞️'}</span><span class="font-bold text-[11px] lg:text-xs text-white">${f.name}</span></button>`;
    });
    html += `</div></div>`;
    
    const ui = createSkillUI(html);
    ui.querySelectorAll('.color-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.colorMode = btn.dataset.val; 
            releaseUI(ui);
            await addLog("攝影總監", "✅", `濾鏡鎖定：<b>${MISSION.colorMode}</b>。`);
            if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); }
            else { MISSION.funnelNextStep = 'character'; await triggerCharacterSkill(); }
        };
    });
}

/**
 * ==========================================
 * 📌 函數名稱：triggerColorSkill
 * ==========================================
 */
export async function triggerColorSkill() { 
    updateStepHeader("COLOR MODE"); await addLog("美術總監", "🎨", "請決定漫畫色系：", true);
    const hasImg = MISSION.generatedImageBatches && MISSION.generatedImageBatches.length > 0;
    const disabledAttr = hasImg ? 'disabled title="已有生成圖片，色系已被鎖定。"' : '';
    const disabledClass = hasImg ? 'opacity-50 cursor-not-allowed' : '';

    const ui = createSkillUI(`
        <div class="space-y-4">
            ${hasImg ? `<div class="bg-amber-600/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-bold mb-2">⚠️ 已有生成圖片，色系已鎖定。</div>` : ''}
            <div class="grid grid-cols-2 gap-2 lg:gap-3">
                <button class="color-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-slate-400 hover:bg-white/5 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'BW' ? 'border-blue-500 bg-white/5' : ''} ${disabledClass}" data-val="BW" ${disabledAttr}><span class="text-2xl lg:text-3xl mb-1">🏁</span><span class="font-bold text-[11px] lg:text-xs text-white">經典黑白</span><span class="text-[9px] text-slate-400 hidden sm:block">懷舊網點質感</span></button>
                <button class="color-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-pink-400 hover:bg-pink-600/10 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'Color' ? 'border-pink-500 bg-pink-600/10' : ''} ${disabledClass}" data-val="Color" ${disabledAttr}><span class="text-2xl lg:text-3xl mb-1">🌈</span><span class="font-bold text-[11px] lg:text-xs text-white">現代全彩</span><span class="text-[9px] text-slate-400 hidden sm:block">飽滿現代動漫感</span></button>
            </div>
        </div>
    `);
    ui.querySelectorAll('.color-btn').forEach(btn => { 
        btn.onclick = async () => { 
            MISSION.colorMode = btn.dataset.val; 
            releaseUI(ui); 
            await addLog("美術總監", "✅", `色系已鎖定：<b>${MISSION.colorMode === 'BW' ? "黑白漫畫" : "全彩動漫"}</b>。`); 
            if (IS_EDIT_MODE.value && isMissionComplete()) { 
                MISSION.funnelNextStep = 'dashboard'; 
                await triggerMissionSummary(); 
            } else { 
                MISSION.funnelNextStep = 'character'; 
                await triggerCharacterSkill(); 
            } 
        }; 
    });
}

/**
 * ==========================================
 * 📌 函數名稱：triggerCharacterSkill
 * ==========================================
 */
export async function triggerCharacterSkill() { 
    updateStepHeader("CHARACTER SUMMON"); await addLog("視覺工程師", "🧬", `請勾選要在本次任務中登場的角色 (最多4位)：`, true);
    
    const available = SYSTEM_DB.characters.filter(c => {
        const rawType = c.type || '';
        if (!rawType) return true; 
        const cType = String(rawType).trim().toUpperCase();
        if (MISSION.universe === 'COMIC') return cType === 'COMIC';
        if (MISSION.universe === 'REALISTIC') return cType === 'REALISTIC';
        return false;
    });
    
    if(available.length === 0) { 
        const ui = createSkillUI(`<div class="text-center flex flex-col gap-4"><p class="text-slate-400 text-xs">您的基因庫目前沒有對應此宇宙的角色，將採用純場景模式。</p><button id="btnSkipChar" class="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-bold active:scale-95 shadow-lg">⏭️ 確認並繼續</button></div>`); 
        ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } else { MISSION.funnelNextStep = 'visual'; await triggerVisualSkill(); } }; 
        return; 
    }
    
    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-4">`; let tempSelected = [...getMissionCharacterNames(MISSION.characters)];
    available.forEach(char => { const isSelected = tempSelected.includes(char.name); html += `<div class="char-select-card flex flex-col items-center gap-2 cursor-pointer transition-all p-2 lg:p-3 rounded-xl bg-slate-800 relative ${isSelected ? 'border-2 border-blue-500 bg-blue-900/30' : 'border border-white/10 hover:border-slate-500'}" data-name="${char.name}"><div class="w-12 h-12 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-slate-700 pointer-events-none"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[10px] lg:text-xs font-bold text-slate-200 pointer-events-none truncate w-full text-center">${char.name}</span>${isSelected ? '<div class="absolute top-1 right-1 lg:top-2 lg:right-2 text-blue-400 font-black text-sm">✓</div>' : ''}</div>`; });
    html += `</div><div class="flex gap-2"><button id="btnSkipChar" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all border border-white/10 hover:bg-slate-700">⏭️ 不召喚</button><button id="btnConfirmChar" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認召喚</button></div>`;
    
    const ui = createSkillUI(html);
    ui.querySelectorAll('.char-select-card').forEach(card => { card.onclick = () => { const name = card.dataset.name; if (tempSelected.includes(name)) { tempSelected = tempSelected.filter(n => n !== name); card.classList.remove('border-2', 'border-blue-500', 'bg-blue-900/30'); card.classList.add('border', 'border-white/10'); const check = card.querySelector('.absolute'); if(check) check.remove(); } else { if (tempSelected.length >= 4) return showError('最多 4 位。'); tempSelected.push(name); card.classList.remove('border', 'border-white/10'); card.classList.add('border-2', 'border-blue-500', 'bg-blue-900/30'); card.innerHTML += '<div class="absolute top-1 right-1 lg:top-2 lg:right-2 text-blue-400 font-black text-sm">✓</div>'; } }; });
    ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; markImageRegenerationRequired('角色變更'); releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } else { MISSION.funnelNextStep = 'visual'; await triggerVisualSkill(); } };
    ui.querySelector('#btnConfirmChar').onclick = async () => { MISSION.characters = tempSelected; markImageRegenerationRequired('角色變更'); releaseUI(ui); await addLog("視覺工程師", "✅", MISSION.characters.length > 0 ? `已鎖定角色：<b>${MISSION.characters.join('、')}</b>。` : "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } else { MISSION.funnelNextStep = 'visual'; await triggerVisualSkill(); } };
}

/**
 * ==========================================
 * 📌 triggerVisualSkill — VISUAL & ATTACHMENTS
 *
 * ⚠️【無損美化 ENHANCE】與「原圖」文案的重要事實（維護者必讀）
 * ------------------------------------------------------------------
 * ENHANCE 已與 GENERATE **共用風格鏈**（宇宙鎖定後先 triggerStyleSkill，不再跳過）。
 * 流程上仍**沒有獨立的「原圖上傳」第二表單**：來源圖即 `#btnUploadScene` → `MISSION.sceneFiles`
 *（按鈕在無損模式下會強調「無損來源圖／主參考」語意）。
 * ==========================================
 */
export async function triggerVisualSkill() { 
    if (window.FunnelActions) window.FunnelActions.triggerVisualSkill = triggerVisualSkill;
    updateStepHeader("VISUAL & ATTACHMENTS"); 
    const isEnhance = MISSION.taskMode === 'ENHANCE'; 
    const isComic = MISSION.universe === 'COMIC'; 
    const isRealistic = MISSION.universe === 'REALISTIC';
    
    // ENHANCE：勿再只說「原圖」而不指明入口——入口即下方「AI 參考圖」按鈕（見函式頭部註解）
    await addLog(
        "影像總監",
        "📸",
        isEnhance
            ? "無損美化：請用下方「上傳無損來源圖」按鈕選檔（無獨立原圖欄；與新生成共用主參考圖流程）。"
            : "請確認畫面參數，並上傳參考圖與社群附加圖：",
        true
    );
    
    let currentRatio = MISSION.ratio || '9:16'; 
    let currentRes = MISSION.resolution || '1K'; 
    let currentPanelCount = MISSION.panelCount || 4;
    
    const panelHtml = isComic ? `<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">🖼️ 漫畫格數</label><div class="grid grid-cols-4 gap-2"><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1">1格</button><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2">2格</button><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="3">3格</button><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4">4格</button></div></div>` : '';
    
    const warningHtml = isRealistic ? `<div class="bg-orange-500/10 border border-orange-500/30 p-2 rounded-lg text-[10px] text-orange-400 mb-3 shadow-inner">⚠️ 提示：寫實模式下請盡量上傳真實照片。若上傳 2D 動漫圖片，AI 將啟動「次元轉換」強制進行寫實化合成，成功率可能較低。</div>` : '';

    const hasImg = MISSION.generatedImageBatches && MISSION.generatedImageBatches.length > 0;
    const disabledAttr = hasImg ? 'disabled title="已有生成圖片，此參數已被鎖定。"' : '';
    const disabledClass = hasImg ? 'opacity-50 cursor-not-allowed' : '';

    const ui = createSkillUI(`
        <div class="flex flex-col gap-4">
            ${hasImg ? `<div class="bg-amber-600/20 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-200 font-bold">⚠️ 已有生成圖片，畫面規格與參考圖已被鎖定。</div>` : ''}
            <div class="bg-blue-600/10 p-3 lg:p-4 rounded-xl border border-blue-500/30 shadow-md">
                <div class="grid grid-cols-2 gap-2 lg:gap-3">
                    <button ${isEnhance || hasImg ? 'disabled' : `id="btnEditRatio"`} class="flex flex-col items-center justify-center bg-slate-800 p-2 lg:p-3 rounded-xl border border-white/10 active:scale-95 ${isEnhance || hasImg ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}"><span class="text-[9px] lg:text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-sm lg:text-lg font-black text-white tag-ratio">${currentRatio}</span></button>
                    <button ${hasImg ? 'disabled' : `id="btnEditRes"`} class="flex flex-col items-center justify-center bg-slate-800 p-2 lg:p-3 rounded-xl border border-white/10 active:scale-95 ${hasImg ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}"><span class="text-[9px] lg:text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-sm lg:text-lg font-black text-white tag-res">${currentRes}</span></button>
                </div>
            </div>
            
            <div id="customPanel" class="hidden flex flex-col gap-4 bg-slate-900/80 p-4 rounded-xl border border-white/10 animate-fade-in shadow-inner">
                ${isEnhance ? '' : `<div class="space-y-3"><label class="text-[10px] text-slate-500 font-black">📐 比例</label><div class="grid grid-cols-3 gap-2"><button class="ratio-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="9:16">9:16</button><button class="ratio-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="16:9">16:9</button><button class="ratio-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1:1">1:1</button></div></div>`}
                <div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">✨ 解析度</label><div class="grid grid-cols-3 gap-2"><button class="res-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1K">1K</button><button class="res-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2K">2K</button><button class="res-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4K">4K</button></div></div>
                ${panelHtml}
            </div>
            
            <div class="border-t border-white/10 pt-4 space-y-4">
                ${warningHtml}
                ${isEnhance ? `<p class="text-[10px] text-amber-200/90 leading-relaxed mb-2 px-1">無損美化沒有獨立的「原圖」上傳區：請用下列按鈕上傳來源圖（與新生成共用同一張<strong class="text-amber-100">場景參考圖</strong>）。</p>` : ''}
                
                <!-- 1. 場景參考圖 (Max 1) -->
                <div class="space-y-2">
                    <label class="text-[11px] font-black text-indigo-300 tracking-wider flex justify-between items-center">
                        <span>🖼️ 場景參考圖 (唯一背景真理)</span>
                        <span id="sceneCountLabel" class="text-[10px] text-slate-500 font-mono">0 / 1</span>
                    </label>
                    <button type="button" ${hasImg ? 'disabled' : `id="btnUploadScene"`} class="w-full bg-slate-800/80 hover:bg-indigo-950/40 text-slate-300 hover:text-white py-3 rounded-xl text-xs font-bold border border-white/10 border-dashed active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${disabledClass}">
                        <span>📸 上傳場景圖</span>
                    </button>
                    <div id="sceneAssetsArea" class="grid grid-cols-3 gap-2 empty:hidden w-full mt-2"></div>
                </div>

                <!-- 2. 人物參考圖 (Max 3) -->
                <div class="space-y-2">
                    <label class="text-[11px] font-black text-indigo-300 tracking-wider flex justify-between items-center">
                        <span>🧑 人物參考圖 (單獨人物照)</span>
                        <span id="characterCountLabel" class="text-[10px] text-slate-500 font-mono">0 / 3</span>
                    </label>
                    <button type="button" ${hasImg ? 'disabled' : `id="btnUploadCharacter"`} class="w-full bg-slate-800/80 hover:bg-indigo-950/40 text-slate-300 hover:text-white py-3 rounded-xl text-xs font-bold border border-white/10 border-dashed active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${disabledClass}">
                        <span>👤 上傳人物照</span>
                    </button>
                    <div id="characterAssetsArea" class="grid grid-cols-3 gap-2 empty:hidden w-full mt-2"></div>
                </div>

                <!-- 3. 配件參考圖 (Max 3) -->
                <div class="space-y-2">
                    <label class="text-[11px] font-black text-indigo-300 tracking-wider flex justify-between items-center">
                        <span>⌚ 配件參考圖 (獨立配件如手錶/書本/杯子)</span>
                        <span id="accessoryCountLabel" class="text-[10px] text-slate-500 font-mono">0 / 3</span>
                    </label>
                    <button type="button" ${hasImg ? 'disabled' : `id="btnUploadAccessory"`} class="w-full bg-slate-800/80 hover:bg-indigo-950/40 text-slate-300 hover:text-white py-3 rounded-xl text-xs font-bold border border-white/10 border-dashed active:scale-[0.99] transition-all flex items-center justify-center gap-2 ${disabledClass}">
                        <span>☕ 上傳配件圖</span>
                    </button>
                    <div id="accessoryAssetsArea" class="grid grid-cols-3 gap-2 empty:hidden w-full mt-2"></div>
                </div>
            </div>

            <div class="border-t border-white/10 pt-4">
                <label class="text-[11px] font-black text-slate-300 tracking-wider block mb-2">📥 上傳社群附加輪播圖 (選填，最多 9 張)</label>
                <button ${hasImg ? 'disabled' : `id="btnUploadAttachments"`} class="w-full bg-slate-800 py-3 rounded-xl text-xs font-black border border-white/10 border-dashed hover:border-slate-400 active:scale-95 transition-all text-slate-300 shadow-md ${disabledClass}"><span>📤 上傳社群附加圖</span></button>
                <div id="attachmentAssetsArea" class="grid grid-cols-3 sm:grid-cols-4 gap-2 empty:hidden w-full mt-2"></div>
            </div>

            <div id="visualActionArea" class="border-t border-white/10 pt-4 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" id="btnAcceptVisualManual" class="w-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 py-3.5 rounded-xl text-xs font-bold active:scale-95 transition-all">
                        ✍️ 自行填寫腳本需求
                    </button>
                    <button type="button" ${hasImg ? 'disabled' : `id="btnAcceptVisualAi"`} class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md ${disabledClass}">
                        🔍 AI 推薦情境 (扣除 10 點)
                    </button>
                </div>
                <div id="aiRecommendationPanel" class="hidden p-4 bg-slate-950/80 border border-indigo-500/20 rounded-2xl animate-fade-in space-y-3 shadow-inner">
                    <div class="flex justify-between items-center pb-2 border-b border-white/5">
                        <span class="text-xs font-bold text-indigo-400 flex items-center gap-1">💡 AI 分析推薦情境</span>
                        <span class="text-[10px] text-slate-500">請選擇一個您最喜歡的創意：</span>
                    </div>
                    <div id="aiRecCards" class="space-y-3"></div>
                </div>
            </div>
        </div>
    `);

    const openPanel = () => { if (hasImg) return; ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    if(ui.querySelector('#btnEditRatio')) ui.querySelector('#btnEditRatio').onclick = openPanel;
    if(ui.querySelector('#btnEditRes')) ui.querySelector('#btnEditRes').onclick = openPanel;
    
    if (!isEnhance) { ui.querySelectorAll('.ratio-btn').forEach(btn => { if(btn.dataset.val === currentRatio) btn.classList.add('bg-blue-600'); btn.onclick = () => { if (hasImg) return; currentRatio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = currentRatio; }; }); }
    ui.querySelectorAll('.res-btn').forEach(btn => { if(btn.dataset.val === currentRes) btn.classList.add('bg-blue-600'); btn.onclick = () => { if (hasImg) return; currentRes = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = currentRes; }; });
    if (isComic) { ui.querySelectorAll('.panel-btn').forEach(btn => { if(parseInt(btn.dataset.val) === currentPanelCount) btn.classList.add('bg-blue-600'); btn.onclick = () => { if (hasImg) return; currentPanelCount = parseInt(btn.dataset.val); ui.querySelectorAll('.panel-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); }; }); }
    
    // Render Scene Ref
    const renderSceneRef = () => {
        const area = ui.querySelector('#sceneAssetsArea');
        const label = ui.querySelector('#sceneCountLabel');
        area.innerHTML = '';
        const count = MISSION.sceneFiles?.length || 0;
        label.textContent = `${count} / 1`;
        
        if (count > 0) {
            const sf = MISSION.sceneFiles[0];
            const div = document.createElement('div');
            div.className = 'relative w-full aspect-square rounded-md overflow-hidden border border-indigo-500/50 shadow-md animate-fade-in';
            div.innerHTML = `
                <img src="${sf.dataUrl || sf.imageUrl}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center shadow-lg" id="btnDelScene">✕</button>
                </div>
            `;
            div.querySelector('#btnDelScene').onclick = () => {
                MISSION.sceneFiles = [];
                renderSceneRef();
            };
            area.appendChild(div);
        }
    };

    // Render Character Refs
    const renderCharacterRefs = () => {
        const area = ui.querySelector('#characterAssetsArea');
        const label = ui.querySelector('#characterCountLabel');
        area.innerHTML = '';
        if (!MISSION.characterFiles) MISSION.characterFiles = [];
        const count = MISSION.characterFiles.length;
        label.textContent = `${count} / 3`;

        MISSION.characterFiles.forEach((cf, idx) => {
            const div = document.createElement('div');
            div.className = 'relative w-full aspect-square rounded-md overflow-hidden border border-indigo-500/50 shadow-md animate-fade-in';
            div.innerHTML = `
                <img src="${cf.dataUrl || cf.imageUrl}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center shadow-lg">✕</button>
                </div>
            `;
            div.querySelector('button').onclick = () => {
                MISSION.characterFiles.splice(idx, 1);
                renderCharacterRefs();
            };
            area.appendChild(div);
        });
    };

    // Render Accessory Refs
    const renderAccessoryRefs = () => {
        const area = ui.querySelector('#accessoryAssetsArea');
        const label = ui.querySelector('#accessoryCountLabel');
        area.innerHTML = '';
        if (!MISSION.accessoryFiles) MISSION.accessoryFiles = [];
        const count = MISSION.accessoryFiles.length;
        label.textContent = `${count} / 3`;

        MISSION.accessoryFiles.forEach((af, idx) => {
            const div = document.createElement('div');
            div.className = 'relative w-full aspect-square rounded-md overflow-hidden border border-indigo-500/50 shadow-md animate-fade-in';
            div.innerHTML = `
                <img src="${af.dataUrl || af.imageUrl}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button type="button" class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center shadow-lg">✕</button>
                </div>
            `;
            div.querySelector('button').onclick = () => {
                MISSION.accessoryFiles.splice(idx, 1);
                renderAccessoryRefs();
            };
            area.appendChild(div);
        });
    };

    // Bind Scene Upload
    ui.querySelector('#btnUploadScene').onclick = () => {
        if (hasImg) return;
        let i = document.createElement('input');
        i.type = 'file'; i.accept = 'image/*';
        i.onchange = async (e) => {
            if (e.target.files[0]) {
                const dataUrl = await compressImage(e.target.files[0], 800);
                MISSION.sceneFiles = [{ dataUrl, name: e.target.files[0].name }];
                markImageRegenerationRequired('場景圖變更');
                renderSceneRef();
                await addLog("影像處理組", "📐", `場景參考主圖已上傳鎖定。`);
            }
        };
        i.click();
    };

    // Bind Character Upload
    ui.querySelector('#btnUploadCharacter').onclick = () => {
        if (hasImg) return;
        if (!MISSION.characterFiles) MISSION.characterFiles = [];
        if (MISSION.characterFiles.length >= 3) return showError("最多只能上傳 3 張人物參考圖喔！");
        
        let i = document.createElement('input');
        i.type = 'file'; i.multiple = true; i.accept = 'image/*';
        i.onchange = async (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const remaining = 3 - MISSION.characterFiles.length;
                const toProcess = Array.from(e.target.files).slice(0, remaining);
                for (const file of toProcess) {
                    const dataUrl = await compressImage(file, 800);
                    MISSION.characterFiles.push({ dataUrl, name: file.name });
                }
                markImageRegenerationRequired('人物參考圖變更');
                renderCharacterRefs();
                await addLog("影像處理組", "👤", `人物參考圖上傳成功。`);
            }
        };
        i.click();
    };

    // Bind Accessory Upload
    ui.querySelector('#btnUploadAccessory').onclick = () => {
        if (hasImg) return;
        if (!MISSION.accessoryFiles) MISSION.accessoryFiles = [];
        if (MISSION.accessoryFiles.length >= 3) return showError("最多只能上傳 3 張配件參考圖喔！");
        
        let i = document.createElement('input');
        i.type = 'file'; i.multiple = true; i.accept = 'image/*';
        i.onchange = async (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const remaining = 3 - MISSION.accessoryFiles.length;
                const toProcess = Array.from(e.target.files).slice(0, remaining);
                for (const file of toProcess) {
                    const dataUrl = await compressImage(file, 800);
                    MISSION.accessoryFiles.push({ dataUrl, name: file.name });
                }
                markImageRegenerationRequired('配件參考圖變更');
                renderAccessoryRefs();
                await addLog("影像處理組", "⌚", `配件參考圖上傳成功。`);
            }
        };
        i.click();
    };

    // Initial renders
    renderSceneRef();
    renderCharacterRefs();
    renderAccessoryRefs();

    if(MISSION.attachmentFiles && MISSION.attachmentFiles.length > 0) {
         handleMultipleAttachments([], ui.querySelector('#attachmentAssetsArea'), false); 
    }
    ui.querySelector('#btnUploadAttachments').onclick = () => {
        if (hasImg) return;
        let i = document.createElement('input');
        i.type = 'file';
        i.multiple = true;
        i.accept = "image/*";
        i.onchange = async (e) => {
            if(e.target.files && e.target.files.length > 0) {
                await handleMultipleAttachments(e.target.files, ui.querySelector('#attachmentAssetsArea'), true);
            }
        };
        i.click();
    };

    ui.querySelector('#btnAcceptVisualManual').onclick = async () => { 
        MISSION.ratio = currentRatio; MISSION.resolution = currentRes; MISSION.panelCount = currentPanelCount; 
        if (!isMissionComplete()) return showError('請完成設定！'); 
        releaseUI(ui); 
        await addLog("影像總監", "✅", `參數鎖定：<b>${MISSION.ratio} / ${isComic ? currentPanelCount+'格' : ''}</b>。 附掛 ${MISSION.attachmentFiles?.length || 0} 張社群輔助圖。參考圖：場景*${MISSION.sceneFiles?.length || 0} / 人物*${MISSION.characterFiles?.length || 0} / 配件*${MISSION.accessoryFiles?.length || 0}`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { MISSION.funnelNextStep = 'dashboard'; await triggerMissionSummary(); } else { MISSION.funnelNextStep = 'schedule'; await triggerScheduleSkill(); }
    };

    ui.querySelector('#btnAcceptVisualAi').onclick = async () => {
        if (hasImg) return;
        const hasRefs = (MISSION.sceneFiles && MISSION.sceneFiles.length > 0) ||
                        (MISSION.characterFiles && MISSION.characterFiles.length > 0) ||
                        (MISSION.accessoryFiles && MISSION.accessoryFiles.length > 0);
                        
        if (!hasRefs) {
            return showError("請至少上傳 1 張場景、人物或配件參考圖，才能讓 AI 進行多模態情境分析喔！");
        }
        
        const btn = ui.querySelector('#btnAcceptVisualAi');
        const oriHtml = btn.innerHTML;
        btn.innerHTML = `<div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block align-middle mr-1.5"></div> 分析中...`;
        btn.disabled = true;
        
        try {
            // Build reference images payload
            const referenceImages = [];
            
            // 1. Scene
            (MISSION.sceneFiles || []).forEach((sf, idx) => {
                const item = { type: 'scene', name: sf.name || `scene_${idx + 1}` };
                if (sf.imageUrl) item.imageUrl = sf.imageUrl;
                if (sf.dataUrl) item.dataUrl = sf.dataUrl;
                if (item.imageUrl || item.dataUrl) referenceImages.push(item);
            });
            
            // 2. Character
            (MISSION.characterFiles || []).forEach((cf, idx) => {
                const item = { type: 'character', name: cf.name || `character_${idx + 1}` };
                if (cf.imageUrl) item.imageUrl = cf.imageUrl;
                if (cf.dataUrl) item.dataUrl = cf.dataUrl;
                if (item.imageUrl || item.dataUrl) referenceImages.push(item);
            });
            
            // 3. Accessory
            (MISSION.accessoryFiles || []).forEach((af, idx) => {
                const item = { type: 'accessory', name: af.name || `accessory_${idx + 1}` };
                if (af.imageUrl) item.imageUrl = af.imageUrl;
                if (af.dataUrl) item.dataUrl = af.dataUrl;
                if (item.imageUrl || item.dataUrl) referenceImages.push(item);
            });
            
            const payload = {
                tenantId: STATE.uid,
                referenceImages,
                universe: MISSION.universe,
                characters: getMissionCharacterNames().map((name) => {
                    const c = SYSTEM_DB.characters.find(x => x.name === name);
                    return { name, persona: c ? (c.persona || "") : "" };
                })
            };
            
            const response = await window.FunnelActions.analyzeReferences(payload);
            
            if (response && response.success) {
                ui.querySelector('#aiRecommendationPanel').classList.remove('hidden');
                
                const container = ui.querySelector('#aiRecCards');
                container.innerHTML = response.options.map((opt, idx) => `
                    <button type="button" class="rec-card-btn w-full text-left p-3.5 bg-slate-900 hover:bg-indigo-950/30 border border-white/10 hover:border-indigo-500/50 rounded-xl transition-all flex flex-col gap-1 active:scale-[0.99]" data-idx="${idx}">
                        <div class="flex justify-between items-center w-full">
                            <span class="text-xs font-bold text-slate-200">✨ ${opt.title}</span>
                            <span class="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">推薦 ${idx + 1}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 leading-relaxed">${opt.description}</p>
                        <div class="mt-2 text-[10px] text-indigo-300 font-mono italic p-2 bg-black/35 rounded-lg border border-white/5 whitespace-pre-wrap">${opt.prompt}</div>
                    </button>
                `).join('');
                
                ui.querySelectorAll('.rec-card-btn').forEach(cardBtn => {
                    cardBtn.onclick = async () => {
                        const idx = parseInt(cardBtn.dataset.idx);
                        const selected = response.options[idx];
                        
                        // Set selected creative prompt
                        MISSION.topic = selected.prompt;
                        markImageRegenerationRequired('主題變更');
                        
                        await addLog("影像總監", "💡", `已套用 AI 推薦情境【<b>${selected.title}</b>】：<br><span class="text-indigo-300 font-mono italic">${selected.prompt}</span>`);
                        
                        // Proceed
                        MISSION.ratio = currentRatio; 
                        MISSION.resolution = currentRes; 
                        MISSION.panelCount = currentPanelCount;
                        
                        // Deduct points UI sync
                        await applyPointDeduction(response.chargedPoints || 10, '分析參考圖與推薦情境');
                        
                        releaseUI(ui);
                        
                        if (IS_EDIT_MODE.value && isMissionComplete()) { 
                            MISSION.funnelNextStep = 'dashboard'; 
                            await triggerMissionSummary(); 
                        } else { 
                            MISSION.funnelNextStep = 'schedule'; 
                            await triggerScheduleSkill(); 
                        }
                    };
                });
                
                btn.innerHTML = `✅ 分析完成`;
                btn.classList.add('bg-green-600');
            } else {
                throw new Error(response.message || "分析失敗");
            }
        } catch (e) {
            btn.innerHTML = oriHtml;
            btn.disabled = false;
            showError(`AI 分析失敗：${e.message}`);
        }
    };
}

/**
 * ==========================================
 * 📌 函數名稱：handleAssetUpload
 * ==========================================
 */
export async function handleAssetUpload(file, container) { 
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); 
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-indigo-900/20 rounded-xl border border-indigo-500/30 animate-fade-in w-full shadow-inner'; 
    const dataUrl = await compressImage(file, 800); 
    
    MISSION.sceneFiles = [{ dataUrl: dataUrl }]; 
    markImageRegenerationRequired('參考圖變更');
    
    panel.innerHTML = `<div class="text-[10px] text-indigo-400 font-bold uppercase">📸 鎖定為 AI 參考主圖</div><div class="w-16 h-16 rounded-md overflow-hidden border border-indigo-500/50 relative"><img src="${dataUrl}" class="w-full h-full object-cover"><button class="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white text-[10px] w-5 h-5 rounded-bl-md flex items-center justify-center cursor-pointer" onclick="this.closest('.scene-picker-panel').remove(); MISSION.sceneFiles=[];">✕</button></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `主參考圖已優化定位。`); 
}

/**
 * ==========================================
 * 📌 函數名稱：handleMultipleAttachments
 * ==========================================
 */
export async function handleMultipleAttachments(files, container, isNew = true) {
    if (!MISSION.attachmentFiles) MISSION.attachmentFiles = [];
    
    if (isNew && files.length > 0) {
        const remainingSlots = 9 - MISSION.attachmentFiles.length;
        if (remainingSlots <= 0) return showError("最多只能上傳 9 張附加圖喔！");

        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'col-span-full text-xs text-indigo-400 animate-pulse text-center py-2 bg-indigo-900/20 rounded-lg border border-indigo-500/30';
        loadingMsg.innerText = '圖片極限壓縮處理中，請稍候...';
        container.appendChild(loadingMsg);

        for (const file of filesToProcess) {
            const dataUrl = await compressImage(file, 800); 
            MISSION.attachmentFiles.push({ dataUrl: dataUrl, name: file.name });
        }
        
        if (files.length > remainingSlots) {
            showError(`已達 9 張上限，自動忽略超出的 ${files.length - remainingSlots} 張圖片。`);
        } else {
            await addLog("影像處理組", "📦", `已極限壓縮並暫存附加輪播圖。目前共 ${MISSION.attachmentFiles.length} 張。`);
        }
    }

    container.innerHTML = '';
    MISSION.attachmentFiles.forEach((af, idx) => {
        const panel = document.createElement('div');
        panel.className = 'relative w-full aspect-square rounded-md overflow-hidden border border-white/20 group shadow-md animate-fade-in';
        panel.innerHTML = `
            <img src="${af.dataUrl || af.imageUrl}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center shadow-lg transform hover:scale-110 transition-all" data-idx="${idx}">✕</button>
            </div>
        `;
        panel.querySelector('button').onclick = () => {
            MISSION.attachmentFiles.splice(idx, 1);
            handleMultipleAttachments([], container, false); 
        };
        container.appendChild(panel);
    });
}

/**
 * ==========================================
 * 📌 函數名稱：triggerScheduleSkill
 * ==========================================
 */
export async function triggerScheduleSkill() { 
    updateStepHeader("PUBLISH SCHEDULE"); 
    await addLog("社群總監", "📅", "最後一步，請指派部署時間（排程需大於目前時間 1 小時）：", true);
    
    const defaultDateObj = new Date();
    if (MISSION.scheduledAt) {
        defaultDateObj.setTime(new Date(MISSION.scheduledAt).getTime());
    } else {
        defaultDateObj.setHours(defaultDateObj.getHours() + 1);
        const m = defaultDateObj.getMinutes();
        defaultDateObj.setMinutes(m + (15 - (m % 15)));
        defaultDateObj.setSeconds(0);
    }

    const year = defaultDateObj.getFullYear();
    const month = String(defaultDateObj.getMonth() + 1).padStart(2, '0');
    const day = String(defaultDateObj.getDate()).padStart(2, '0');
    const defDate = `${year}-${month}-${day}`;
    const defTime = defaultDateObj.toTimeString().slice(0,5); 

    const ui = createSkillUI(`
        <div class="flex flex-col gap-3">
            <div class="grid grid-cols-2 gap-2 relative">
                <input type="text" id="datePicker" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-3 lg:p-4 text-xs lg:text-sm text-white outline-none [color-scheme:dark]" placeholder="📅 日期" value="${defDate}">
                <div class="relative w-full" id="timePickerWrapper">
                    <input type="text" id="timePickerInput" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-3 lg:p-4 text-xs lg:text-sm text-white outline-none [color-scheme:dark]" placeholder="⏰ 時間" value="${defTime}">
                </div>
            </div>
            <div class="flex gap-2 mt-2">
                <button id="btnImmediate" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-[10px] lg:text-xs font-bold active:scale-95 transition-all border border-white/10 hover:bg-slate-700">⚡ 立即部署</button>
                <button id="btnConfirmSchedule" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] lg:text-xs shadow-lg active:scale-95 transition-all">📅 確認時間</button>
            </div>
        </div>
    `);
    
    const fpDate = typeof flatpickr !== 'undefined' ? flatpickr("#datePicker", { 
        dateFormat: "Y-m-d", 
        minDate: "today", 
        defaultDate: defDate,
        disableMobile: "true",
        locale: (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.zh) ? "zh" : "default"
    }) : null;

    const fpTime = typeof flatpickr !== 'undefined' ? flatpickr("#timePickerInput", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 15, 
        defaultDate: defTime,
        disableMobile: "true"
    }) : null;
    
    ui.querySelector('#btnImmediate').onclick = async () => {
        if (fpDate) fpDate.destroy();
        if (fpTime) fpTime.destroy();
        MISSION.scheduledAt = null; 
        releaseUI(ui); 
        await addLog("社群總監", "⚡", `已選擇「立即部署」。`);
        MISSION.funnelNextStep = 'dashboard';
        await triggerMissionSummary();
    };

    ui.querySelector('#btnConfirmSchedule').onclick = async () => {
        const dateStr = ui.querySelector('#datePicker').value; 
        const timeStr = ui.querySelector('#timePickerInput').value; 

        if (!dateStr || !timeStr) {
            return showError("日期與時間必須同時設定完整！");
        }

        const schDate = new Date(`${dateStr}T${timeStr}:00+08:00`);
        const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);

        if (schDate < oneHourLater) {
            return showError("排程需大於目前時間 1 個小時。");
        }

        MISSION.scheduledAt = schDate.toISOString(); 
        if (fpDate) fpDate.destroy();
        if (fpTime) fpTime.destroy();
        releaseUI(ui); 
        await addLog("社群總監", "✅", `已排程於 ${schDate.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`); 
        MISSION.funnelNextStep = 'dashboard';
        await triggerMissionSummary();
    };
}

/**
 * 🧠 企劃大腦：在主題設定之初即時提供合適的宇宙與風格建議
 */
function getEarlyImagePlanSuggestion(topicText) {
    const topic = (topicText || '').toLowerCase();
    const hasComicIntent = /動漫|卡通|漫畫|畫風|二次元|搞笑|迷因|漫畫|yonkoma|comic|anime/.test(topic);
    const hasRealisticIntent = /真實|寫實|攝影|照片|產品照|穿搭|街拍|實景|realistic|photo|photography/.test(topic);
    
    if (hasComicIntent) {
        return {
            universeText: "2D 動漫宇宙",
            reason: "由於主題中包含動漫、趣味或故事性質關鍵字，強烈建議採用 <b>2D 動漫多格漫畫</b> 進行創作，藉由精采的分鏡對白與討喜的畫風來引發社群互動率！"
        };
    }
    if (hasRealisticIntent) {
        return {
            universeText: "真實攝影宇宙",
            reason: "您的主題強調實體質感、真實生活場景或商品展示，建議採用 <b>真實攝影（寫實風格）</b>，讓您的受眾感受到最高的生活共鳴與視覺細節表現。"
        };
    }
    
    const hasStoryIntent = /劇情|連載|分鏡|故事|episode|story/.test(topic);
    if (hasStoryIntent) {
        return {
            universeText: "2D 動漫宇宙",
            reason: "此主題帶有強烈的故事敘事特徵，使用 2D 動漫的多格分鏡排版能以最生動的對話氣泡層層鋪陳劇情，完美傳遞故事張力！"
        };
    }
    return {
        universeText: "真實攝影宇宙 或 2D 動漫宇宙",
        reason: "此主題風格彈性大。若希望展現高端寫實質感，可選擇「真實攝影」；若偏好活潑、幽默的連續圖文，建議選擇「2D 動漫」分鏡漫畫。"
    };
}

/**
 * ==========================================
 * 📸 AI 智慧速發 (Smart Express)：行動端/極速發文管線與一頁式審查核心實作
 * ==========================================
 */

let quickSnapSelectedPlats = ['FB'];
let quickSnapUploadedDataUrl = '';

window.openSmartExpressModal = function() {
    const modal = document.getElementById('quickSnapModal');
    const panel = document.getElementById('quickSnapPanel');
    if (!modal || !panel) return;

    // 重設狀態與 UI
    quickSnapSelectedPlats = ['FB'];
    quickSnapUploadedDataUrl = '';
    
    const fileInput = document.getElementById('quickSnapFileInput');
    if (fileInput) fileInput.value = '';
    
    const topicArea = document.getElementById('quickSnapTopic');
    if (topicArea) topicArea.value = '';

    const uploadArea = document.getElementById('quickSnapUploadArea');
    const previewArea = document.getElementById('quickSnapPreviewArea');
    const previewImg = document.getElementById('quickSnapPreviewImg');
    
    if (uploadArea) uploadArea.classList.remove('hidden');
    if (previewArea) previewArea.classList.add('hidden');
    if (previewImg) previewImg.src = '';

    // 更新平台晶片選中樣式
    updateSnapPlatUI();

    // 重設為預設模式 AI_GEN
    const modeSelect = document.getElementById('quickSnapModeSelect');
    if (modeSelect) {
        modeSelect.value = 'AI_GEN';
        if (typeof modeSelect.onchange === 'function') {
            modeSelect.onchange();
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.add('opacity-100');
        modal.classList.add('show');
        panel.classList.add('translate-y-0');
    }, 20);
};

window.closeSmartExpressModal = function() {
    const modal = document.getElementById('quickSnapModal');
    const panel = document.getElementById('quickSnapPanel');
    if (!modal || !panel) return;

    modal.classList.remove('opacity-100');
    modal.classList.remove('show');
    panel.classList.remove('translate-y-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.closeQuickSnapModal = window.closeSmartExpressModal;

// 平台選中更新
function updateSnapPlatUI() {
    const fbBtn = document.getElementById('snapPlatFB');
    const igBtn = document.getElementById('snapPlatIG');
    const thrBtn = document.getElementById('snapPlatTHREADS');
    if (!fbBtn || !igBtn) return;

    if (quickSnapSelectedPlats.includes('FB')) {
        fbBtn.className = "snap-plat-btn flex-1 h-full rounded-lg border text-[10px] font-bold border-blue-500/50 bg-blue-600/20 text-blue-300";
    } else {
        fbBtn.className = "snap-plat-btn flex-1 h-full rounded-lg border text-[10px] font-bold border-white/10 bg-slate-900 text-slate-500";
    }

    if (quickSnapSelectedPlats.includes('IG')) {
        igBtn.className = "snap-plat-btn flex-1 h-full rounded-lg border text-[10px] font-bold border-pink-500/50 bg-pink-600/20 text-pink-300";
    } else {
        igBtn.className = "snap-plat-btn flex-1 h-full rounded-lg border text-[10px] font-bold border-white/10 bg-slate-900 text-slate-500";
    }

    if (thrBtn) {
        if (quickSnapSelectedPlats.includes('THREADS')) {
            thrBtn.className = "snap-plat-btn flex-1 h-full rounded-lg border text-[10px] font-bold border-purple-500/50 bg-purple-600/20 text-purple-300";
        } else {
            thrBtn.className = "snap-plat-btn flex-1 h-full rounded-lg border text-[10px] font-bold border-white/10 bg-slate-900 text-slate-500";
        }
    }
}

// 綁定檔案上傳拍照與相關按鈕事件
function initSmartExpressEvents() {
    const uploadArea = document.getElementById('quickSnapUploadArea');
    const fileInput = document.getElementById('quickSnapFileInput');
    const previewArea = document.getElementById('quickSnapPreviewArea');
    const previewImg = document.getElementById('quickSnapPreviewImg');
    const removeImgBtn = document.getElementById('btnRemoveQuickSnapImg');

    if (uploadArea && fileInput) {
        uploadArea.onclick = () => fileInput.click();
    }

    if (fileInput) {
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                // 自動無損壓縮，限制在 1024 寬度以內以節省頻寬
                const compressedDataUrl = await compressImage(file, 1024, false);
                quickSnapUploadedDataUrl = compressedDataUrl;
                
                if (previewImg && previewArea && uploadArea) {
                    previewImg.src = compressedDataUrl;
                    previewArea.classList.remove('hidden');
                    uploadArea.classList.add('hidden');
                }
            } catch (err) {
                console.error("圖片壓縮失敗：", err);
                showError("圖片讀取失敗，請重新上傳。");
            }
        };
    }

    if (removeImgBtn && uploadArea && previewArea && previewImg && fileInput) {
        removeImgBtn.onclick = (e) => {
            e.stopPropagation();
            quickSnapUploadedDataUrl = '';
            fileInput.value = '';
            previewImg.src = '';
            previewArea.classList.add('hidden');
            uploadArea.classList.remove('hidden');
        };
    }

    // 模式切換 (原圖直發 vs AI智慧生圖)
    const modeSelect = document.getElementById('quickSnapModeSelect');
    if (modeSelect) {
        modeSelect.onchange = () => {
            const isOriginal = modeSelect.value === 'ORIGINAL';
            const styleContainer = document.getElementById('quickSnapStyleSelectContainer');
            const platContainer = document.getElementById('quickSnapPlatformContainer');
            if (isOriginal) {
                if (styleContainer) styleContainer.classList.add('hidden');
                if (platContainer) {
                    platContainer.classList.remove('col-span-1');
                    platContainer.classList.add('col-span-2');
                }
            } else {
                if (styleContainer) styleContainer.classList.remove('hidden');
                if (platContainer) {
                    platContainer.classList.remove('col-span-2');
                    platContainer.classList.add('col-span-1');
                }
            }
        };
    }

    // 平台切換按鈕綁定
    const fbBtn = document.getElementById('snapPlatFB');
    const igBtn = document.getElementById('snapPlatIG');
    const thrBtn = document.getElementById('snapPlatTHREADS');
    if (fbBtn) {
        fbBtn.onclick = () => {
            if (quickSnapSelectedPlats.includes('FB')) {
                quickSnapSelectedPlats = quickSnapSelectedPlats.filter(p => p !== 'FB');
            } else {
                quickSnapSelectedPlats.push('FB');
            }
            if (quickSnapSelectedPlats.length === 0) quickSnapSelectedPlats = ['IG'];
            updateSnapPlatUI();
        };
    }
    if (igBtn) {
        igBtn.onclick = () => {
            if (quickSnapSelectedPlats.includes('IG')) {
                quickSnapSelectedPlats = quickSnapSelectedPlats.filter(p => p !== 'IG');
            } else {
                quickSnapSelectedPlats.push('IG');
            }
            if (quickSnapSelectedPlats.length === 0) quickSnapSelectedPlats = ['FB'];
            updateSnapPlatUI();
        };
    }
    if (thrBtn) {
        thrBtn.onclick = () => {
            if (quickSnapSelectedPlats.includes('THREADS')) {
                quickSnapSelectedPlats = quickSnapSelectedPlats.filter(p => p !== 'THREADS');
            } else {
                quickSnapSelectedPlats.push('THREADS');
            }
            if (quickSnapSelectedPlats.length === 0) quickSnapSelectedPlats = ['FB'];
            updateSnapPlatUI();
        };
    }

    // 提交閃電生成
    const submitBtn = document.getElementById('btnSubmitQuickSnap');
    if (submitBtn) {
        submitBtn.onclick = async () => {
            const topicInput = document.getElementById('quickSnapTopic');
            const topicText = topicInput ? topicInput.value.trim() : '';

            if (!quickSnapUploadedDataUrl) {
                showError("請先拍照或上傳一張當下的現場照片。");
                return;
            }

            if (!topicText) {
                showError("請填寫您當下的發文主旨。");
                return;
            }

            const quickSnapMode = modeSelect ? modeSelect.value : 'AI_GEN';

            // 算力餘額查核
            const actionsPricing = SYSTEM_DB.pricing?.actions || {};
            const draftPrice = actionsPricing['GENERATE_DRAFT']?.retailPoints || 10;
            const imgPrice = actionsPricing['GENERATE_IMAGE']?.retailPoints || 50;
            const resW = getImageGenBillingMultiplier('1K');
            const estImageCost = Math.ceil(imgPrice * resW);
            const totalCost = (quickSnapMode === 'ORIGINAL') ? draftPrice : (draftPrice + estImageCost);

            if (!validatePoints(totalCost, "AI 智慧速發")) return;

            const spinner = document.getElementById('quickSnapLoadingSpinner');
            const btnText = document.getElementById('btnSubmitQuickSnapText');
            if (spinner) spinner.classList.remove('hidden');
            if (btnText) btnText.innerText = "正在規劃速發專案...";
            submitBtn.disabled = true;

            try {
                // 決定預設生圖規格
                let universe = 'REALISTIC';
                let panelCount = 1;
                let colorMode = 'Color';
                let style = '現場原圖';

                if (quickSnapMode === 'AI_GEN') {
                    const configVal = document.getElementById('quickSnapConfigSelect')?.value || 'COMIC_1_Color';
                    universe = configVal.startsWith('COMIC') ? 'COMIC' : 'REALISTIC';
                    if (configVal.includes('4_Color')) panelCount = 4;
                    else if (configVal.includes('BW')) colorMode = 'BW';
                    style = '';
                }

                const payload = {
                    tenantId: STATE.uid,
                    currentStatus: 'DRAFTING',
                    missionContext: {
                        topic: topicText,
                        universe: universe,
                        colorMode: colorMode,
                        panelCount: panelCount,
                        style: style,
                        platforms: quickSnapSelectedPlats,
                        quickSnapMode: quickSnapMode,
                        sceneFiles: [{ name: 'snap_image.jpg', dataUrl: quickSnapUploadedDataUrl }]
                    }
                };

                const response = await API.createAgentTaskAPI(payload);
                if (response && response.success) {
                    // 同步前端全域 MISSION 狀態
                    MISSION.currentTaskId = response.task?.id || response.task?._id || response.taskId;
                    MISSION.topic = topicText;
                    MISSION.universe = universe;
                    MISSION.colorMode = colorMode;
                    MISSION.panelCount = panelCount;
                    MISSION.style = style;
                    MISSION.platforms = quickSnapSelectedPlats;
                    MISSION.sceneFiles = [{ name: 'snap_image.jpg', dataUrl: quickSnapUploadedDataUrl }];
                    MISSION.attachmentFiles = [{ name: 'snap_image.jpg', dataUrl: quickSnapUploadedDataUrl }];
                    MISSION.taskMode = 'GENERATE';
                    MISSION.ratio = '9:16';
                    MISSION.resolution = '1K';
                    MISSION.quickSnapMode = quickSnapMode;

                    // 關閉 Modal
                    window.closeSmartExpressModal();

                    // 切換至對話工作室雙欄佈局
                    initSplitPaneLayout();

                    // 手機端自動切換 Tab 至工作區
                    document.getElementById('tabBtnWorkspace')?.click();

                    // 顯示進程提示與掃描 Loading
                    await addLog("智慧助理", "⚡", "已啟動 AI 智慧速發任務！正在為您規劃貼文...", true);
                    renderExpressLoadingCard(quickSnapMode === 'ORIGINAL' ? "正在智慧生成貼文草稿文案..." : "正在分析現場照片並進行 AI 風格化算圖...");

                    // 執行非同步智慧發文背景管線
                    runSmartExpressPipeline(quickSnapMode, quickSnapUploadedDataUrl);
                } else {
                    throw new Error(response.message || "建檔失敗。");
                }
            } catch (err) {
                console.error("智慧速發初始化失敗：", err);
                showError(`速發失敗：${err.message}`);
            } finally {
                if (spinner) spinner.classList.add('hidden');
                if (btnText) btnText.innerText = "⚡ 閃電生成規劃";
                submitBtn.disabled = false;
            }
        };
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmartExpressEvents);
} else {
    initSmartExpressEvents();
}

// 執行非同步背景智慧發文管線
async function runSmartExpressPipeline(quickSnapMode, quickSnapUploadedDataUrl) {
    try {
        const rawPayload = {
            tenantId: STATE.uid,
            taskId: MISSION.currentTaskId || undefined,
            topic: MISSION.topic,
            isComicMode: MISSION.universe === 'COMIC',
            universe: MISSION.universe,
            taskMode: 'GENERATE',
            style: MISSION.style,
            platforms: MISSION.platforms,
            persona: '預設行銷風',
            hookType: '直白陳述',
            contentLength: '普通 (約150字)',
            colorMode: MISSION.colorMode,
            ratio: MISSION.ratio,
            resolution: MISSION.resolution,
            panelCount: MISSION.panelCount,
            scheduledAt: MISSION.scheduledAt || null,
            isIndependentPost: false,
            platformStrategies: {},
            tgConfig: MISSION.tgConfig || {},
            characters: [],
            image_options: {
                ratio: MISSION.ratio,
                resolution: MISSION.resolution,
                referenceImages: [
                    { type: 'scene', name: '現場照片.jpg', data: quickSnapUploadedDataUrl }
                ],
                attachmentFiles: []
            }
        };

        // 1. 產生草稿文案
        const draftRes = await API.generateDraftAPI(rawPayload);
        if (!draftRes || !draftRes.success) {
            throw new Error(draftRes.message || "文案生成失敗。");
        }

        MISSION.currentTaskId = draftRes.taskId || MISSION.currentTaskId;
        MISSION.currentDraft = draftRes.draftContent;

        let extractedCaption = '';
        if (draftRes.draftContent) {
            if (typeof draftRes.draftContent.captions === 'object') {
                extractedCaption = draftRes.draftContent.captions.UNIFIED || 
                                   draftRes.draftContent.captions.FB || 
                                   draftRes.draftContent.captions.IG || 
                                   draftRes.draftContent.captions.THREADS || '';
            } else if (draftRes.draftContent.post_caption) {
                extractedCaption = draftRes.draftContent.post_caption;
            }
        }
        
        MISSION.currentCaption = extractedCaption;
        MISSION.currentCaptions = { 
            UNIFIED: extractedCaption,
            FB: draftRes.draftContent?.captions?.FB || extractedCaption,
            IG: draftRes.draftContent?.captions?.IG || extractedCaption,
            THREADS: draftRes.draftContent?.captions?.THREADS || extractedCaption
        };

        MISSION.currentHashtags = { UNIFIED: [] };
        if (draftRes.draftContent?.hashtags) {
            if (Array.isArray(draftRes.draftContent.hashtags)) {
                MISSION.currentHashtags.UNIFIED = draftRes.draftContent.hashtags;
            } else if (typeof draftRes.draftContent.hashtags === 'object') {
                MISSION.currentHashtags = { ...draftRes.draftContent.hashtags };
            }
        }

        const actionsPricing = SYSTEM_DB.pricing?.actions || {};
        const draftPrice = actionsPricing['GENERATE_DRAFT']?.retailPoints || 10;
        const draftPersistNote = draftRes.persistence ? `任務ID: ${draftRes.taskId}` : '';
        await applyPointDeduction(
            draftRes.chargedPoints !== undefined ? Number(draftRes.chargedPoints) : draftPrice,
            "AI 智慧速發-產生草稿",
            draftPersistNote ? { persistNote: draftPersistNote } : {}
        );

        // 2. 判斷是否需要 AI 風格生圖
        if (quickSnapMode === 'ORIGINAL') {
            await renderSmartExpressReviewCard(MISSION.currentTaskId);
        } else {
            // 影像合成發包
            const imgPrice = actionsPricing['GENERATE_IMAGE']?.retailPoints || 50;
            const resW = getImageGenBillingMultiplier(MISSION.resolution);
            const estImageCost = Math.ceil(imgPrice * resW);

            const imgRes = await API.generateImageFromDraftAPI({
                taskId: MISSION.currentTaskId,
                tenantId: STATE.uid,
                editedCaption: MISSION.currentCaption,
                editedPanels: draftRes.draftContent.panels || [],
                universe: MISSION.universe,
                taskMode: 'GENERATE',
                style: MISSION.style,
                colorMode: MISSION.colorMode,
                ratio: MISSION.ratio,
                resolution: MISSION.resolution,
                panelCount: MISSION.panelCount,
                plannedImageCount: 1,
                isStoryMode: false,
                characters: [],
                image_options: {
                    ratio: MISSION.ratio,
                    resolution: MISSION.resolution,
                    referenceImages: [
                        { type: 'scene', name: '現場照片.jpg', data: quickSnapUploadedDataUrl }
                    ],
                    attachmentFiles: []
                },
                tgConfig: MISSION.tgConfig
            });

            if (imgRes && imgRes.success) {
                const imagePersistNote = imgRes.persistence ? `任務ID: ${MISSION.currentTaskId}` : '';
                await applyPointDeduction(
                    imgRes.chargedPoints !== undefined ? Number(imgRes.chargedPoints) : estImageCost,
                    "AI 智慧速發-影像合成",
                    imagePersistNote ? { persistNote: imagePersistNote } : {}
                );

                recordGeneratedImageBatch(imgRes.images, MISSION.currentCaption);
                await renderSmartExpressReviewCard(MISSION.currentTaskId);
            } else {
                throw new Error(imgRes.message || "未能取得 AI 風格化圖片。");
            }
        }
    } catch (e) {
        console.error("Express pipeline error:", e);
        await addLog("智慧助理", "❌", `極速規劃失敗：${e.message}`, true);
        showError(`極速規劃失敗：${e.message}`);
        setTimeout(() => {
            window.dispatchEvent(new Event('reloadLobby'));
        }, 3000);
    }
}

// 繪製雷射掃描 Loading 卡片
export function renderExpressLoadingCard(text) {
    updateStepHeader("SMART EXPRESS LOADING");
    createSkillUI(`
        <div class="space-y-6 text-center py-6 animate-fade-in w-full">
            <div class="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div class="absolute inset-0 rounded-full border-4 border-dashed border-emerald-500 animate-spin" style="animation-duration: 8s;"></div>
                <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse">
                    <span class="text-2xl">⚡</span>
                </div>
            </div>
            
            <div class="space-y-2">
                <h3 class="text-base font-black text-white tracking-wider">AI 智慧速發處理中...</h3>
                <p class="text-xs text-slate-400 max-w-sm mx-auto">${text}</p>
            </div>
            
            <div class="laser-container shimmer-bg rounded-2xl w-full aspect-[16/10] max-w-md mx-auto border border-white/10 shadow-2xl relative overflow-hidden">
                <div class="laser-line"></div>
                <div class="absolute inset-0 flex flex-col justify-between p-4 z-0 bg-slate-950/20">
                    <div class="flex justify-between items-start">
                        <div class="h-4 w-20 rounded bg-slate-800/80"></div>
                        <div class="h-4 w-12 rounded bg-slate-800/80"></div>
                    </div>
                    <div class="space-y-2 text-left">
                        <div class="h-3 w-3/4 rounded bg-slate-800/80"></div>
                        <div class="h-3 w-1/2 rounded bg-slate-800/80"></div>
                    </div>
                </div>
            </div>
        </div>
    `);
}

function getBatchesOldestFirst() {
    const rows = MISSION.generatedImageBatches || [];
    return rows.length ? [...rows].reverse() : [];
}

function buildExpressPublishSlots() {
    const slots = [];
    for (const batch of getBatchesOldestFirst()) {
        const imgs = batch?.images || [];
        imgs.forEach((img, imageIndex) => {
            slots.push({ batch, batchId: batch.id, imageIndex, img });
        });
    }
    return slots;
}

function countSelectedSynthExcludingBatch(excludeBatchId) {
    let sum = 0;
    for (const b of MISSION.generatedImageBatches || []) {
        if (b.id === excludeBatchId) continue;
        const imgs = b.images || [];
        const mask = ensureSyntheticPublishMask(b.id, imgs.length);
        sum += mask.filter(Boolean).length;
    }
    return sum;
}

function trySetPublishInclusion(batch, imageIndex, want) {
    if (!batch || !Array.isArray(batch.images)) return false;
    const n = batch.images.length;
    if (imageIndex < 0 || imageIndex >= n) return false;
    const mask = ensureSyntheticPublishMask(batch.id, n);
    const att = (MISSION.attachmentFiles || []).length;
    let nextSynth = countSelectedSynthExcludingBatch(batch.id);
    for (let j = 0; j < n; j++) {
        const on = (j === imageIndex) ? want : !!mask[j];
        if (on) nextSynth++;
    }
    if (nextSynth + att > PUBLISH_MEDIA_MAX_TOTAL) {
        return false;
    }
    mask[imageIndex] = want;
    return true;
}

function collectSelectedPublishImagesMerged() {
    const out = [];
    for (const batch of getBatchesOldestFirst()) {
        const imgs = batch.images || [];
        const mask = ensureSyntheticPublishMask(batch.id, imgs.length);
        imgs.forEach((img, i) => {
            if (mask[i]) out.push(img);
        });
    }
    return out;
}

// 核心：智慧速發一頁式審查卡片 UI
export async function renderSmartExpressReviewCard(taskId) {
    updateStepHeader("SMART EXPRESS REVIEW");
    await addLog("智慧助理", "🚀", "AI 智慧速發規劃完成！請在右側工作區做最後審查與修改：", true);

    // 還原機制：若是從大廳載入的歷史任務，且沒有記憶體生圖批次，則從快取重建批次
    if (MISSION.quickSnapMode === 'AI_GEN' && (!MISSION.generatedImageBatches || MISSION.generatedImageBatches.length === 0)) {
        const task = (window.tempTaskCache || []).find(t => (t.id || t._id || t.taskId) === taskId);
        const imgs = task ? (task.images || task.agentData?.generatedImages || []) : [];
        let caption = '';
        if (task) {
            caption = task.social_post_final || task.social_post_draft || '';
            if (!caption && task.draftContent) {
                if (typeof task.draftContent.captions === 'object') {
                    caption = task.draftContent.captions.UNIFIED || 
                              task.draftContent.captions.FB || 
                              task.draftContent.captions.IG || 
                              task.draftContent.captions.THREADS || '';
                } else if (task.draftContent.post_caption) {
                    caption = task.draftContent.post_caption;
                }
            }
        }
        if (imgs.length > 0) {
            recordGeneratedImageBatch(imgs, caption);
        }
    }

    const isOriginal = MISSION.quickSnapMode === 'ORIGINAL';
    
    // 取得要顯示的預覽圖
    let displayImgUrl = '';
    let slots = [];
    if (isOriginal) {
        displayImgUrl = MISSION.attachmentFiles[0]?.imageUrl || MISSION.attachmentFiles[0]?.dataUrl || '';
    } else {
        slots = buildExpressPublishSlots();
        const nFlat = slots.length;
        if (nFlat > 0) {
            MISSION.selectedImagePreviewIndex = Math.max(0, Math.min(MISSION.selectedImagePreviewIndex || 0, nFlat - 1));
            const cur = slots[MISSION.selectedImagePreviewIndex];
            if (cur) MISSION.selectedImageBatchId = cur.batchId;
            displayImgUrl = cur ? (cur.img.finalUrl || cur.img.imageUrl || '') : '';
        } else {
            MISSION.selectedImagePreviewIndex = 0;
        }
    }

    // 確定文案內容
    let selectedCaption = MISSION.currentCaptions?.UNIFIED || MISSION.currentCaption || '';

    const ui = createSkillUI(`
        <div class="space-y-6 animate-fade-in w-full">
            <!-- Header -->
            <div class="flex items-center justify-between pb-3 border-b border-white/10">
                <div class="flex items-center gap-2.5">
                    <span class="text-xl">⚡</span>
                    <div>
                        <h3 class="text-sm font-black text-white tracking-wide">AI 智慧速發審查</h3>
                        <p class="text-[9px] text-slate-500">審查生成內容，確認即可發佈</p>
                    </div>
                </div>
                <div class="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded text-[9px] font-bold">
                    ${isOriginal ? '現場原圖' : 'AI 風格生圖'}
                </div>
            </div>

            <!-- Main Preview Image Wrapper -->
            <div class="flex flex-col items-center">
                <div id="expressPreviewWrapper" class="relative group cursor-zoom-in rounded-2xl overflow-hidden border border-white/10 aspect-[16/10] w-full max-w-md bg-slate-950 flex items-center justify-center transition-all duration-300">
                    <div id="expressPreviewGlow" class="absolute inset-0 border border-emerald-500/30 rounded-2xl pointer-events-none transition-all duration-300"></div>
                    <img id="expressPreviewImg" src="${displayImgUrl}" class="w-full h-full object-contain max-h-[260px]" alt="預覽圖">
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <span class="bg-black/60 text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-white/20">🔍 點擊 3D 燈箱放大</span>
                    </div>
                    <div id="expressPreviewCheckBadge" class="absolute top-3 right-3 bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg font-black text-xs">✓</div>
                </div>
            </div>

            <!-- Thumbnails scroll (only for AI_GEN) -->
            ${!isOriginal && slots.length > 0 ? `
            <div class="space-y-1.5">
                <label class="text-[10px] text-slate-400 font-bold block">📸 合成相簿複選 (1~N 張發佈)</label>
                <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-thin max-w-md mx-auto" id="expressThumbStrip">
                    ${slots.map((slot, idx) => {
                        const isSelected = ensureSyntheticPublishMask(slot.batchId, slot.batch.images.length)[slot.imageIndex];
                        const activeClass = idx === MISSION.selectedImagePreviewIndex ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-slate-400';
                        return `
                        <div class="relative flex-shrink-0 cursor-pointer rounded-lg border-2 p-0.5 transition-all duration-200 express-thumb-card ${activeClass}" data-idx="${idx}">
                            <img src="${slot.img.finalUrl || slot.img.imageUrl || ''}" class="w-12 h-12 object-cover rounded">
                            <div class="absolute -top-1.5 -right-1.5 bg-slate-950 border border-white/20 rounded-md w-5 h-5 flex items-center justify-center shadow-md express-checkbox-wrap">
                                <input type="checkbox" class="express-thumb-chk cursor-pointer accent-emerald-500 w-3.5 h-3.5" data-batch="${slot.batchId}" data-imgidx="${slot.imageIndex}" ${isSelected ? 'checked' : ''}>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Caption Textarea -->
            <div class="bg-emerald-600/5 border border-emerald-500/20 rounded-xl p-3.5 space-y-2">
                <label class="text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                    <span>📝 貼文文案 (可直接在此修改)</span>
                    <span class="text-[9px] text-slate-500 font-normal">AI 智慧產出建議內容</span>
                </label>
                <textarea id="expressCaptionEdit" class="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-xs text-slate-200 min-h-[110px] focus:border-emerald-500 focus:outline-none resize-y" placeholder="請輸入要發佈的內容...">${selectedCaption}</textarea>
            </div>

            <!-- Collapsible Schedule Section -->
            <div class="bg-slate-900/60 border border-white/5 rounded-xl p-3.5 space-y-3">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="chkExpressSchedule" class="rounded accent-blue-500 w-4 h-4 cursor-pointer">
                    <span class="text-xs font-black text-slate-300">📅 設定排程發佈時間</span>
                </label>
                <div id="expressScheduleInputs" class="hidden grid grid-cols-2 gap-3 transition-all duration-300">
                    <div>
                        <label class="text-[9px] text-slate-500 font-bold block mb-1">選擇日期</label>
                        <input type="text" id="expressDatePicker" class="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none [color-scheme:dark]" placeholder="📅 日期">
                    </div>
                    <div>
                        <label class="text-[9px] text-slate-500 font-bold block mb-1">選擇時間</label>
                        <input type="text" id="expressTimePickerInput" class="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none [color-scheme:dark]" placeholder="⏰ 時間">
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col gap-2 pt-2">
                <button id="btnExpressPublish" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black shadow-lg hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                    <span id="btnExpressPublishText">🚀 立即部署發佈</span>
                    <div id="expressPublishSpinner" class="hidden w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </button>
                
                <div class="grid grid-cols-2 gap-2">
                    ${!isOriginal ? `
                    <button id="btnExpressRegen" class="py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-white/10 hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1">
                        <span>🔄 防跑偏重算</span>
                    </button>
                    ` : `
                    <div class="hidden"></div>
                    `}
                    <button id="btnExpressAbandon" class="py-3 bg-slate-800/50 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold hover:bg-red-950/20 active:scale-[0.98] transition-all">
                        🗑️ 放棄此任務
                    </button>
                </div>
            </div>
        </div>

        <!-- 3D Lightbox Backdrop -->
        <div id="expressPublishLightbox" class="fixed inset-0 z-[450] flex flex-col lightbox-backdrop hidden" aria-hidden="true">
            <div class="absolute inset-0 bg-slate-950/90 cursor-zoom-out" id="expressLbOverlay"></div>
            <div class="relative z-10 flex-1 flex items-center justify-center p-4">
                <button id="btnExpressLbPrev" class="absolute left-4 bg-slate-900/60 hover:bg-slate-900 border border-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all text-lg select-none">‹</button>
                <img id="expressLbImg" class="max-w-full max-h-[85vh] object-contain cursor-zoom-out select-none touch-manipulation lightbox-content" src="">
                <button id="btnExpressLbNext" class="absolute right-4 bg-slate-900/60 hover:bg-slate-900 border border-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all text-lg select-none">›</button>
            </div>
            <div class="relative z-10 p-4 bg-slate-900/90 text-center text-xs text-slate-400 flex flex-col gap-1">
                <div id="expressLbIdx" class="font-bold text-white text-sm"></div>
                <p>點擊圖片與遮罩可關閉燈箱</p>
            </div>
        </div>
    `);

    // 同步預覽渲染
    const syncExpressPreview = () => {
        const previewImg = ui.querySelector('#expressPreviewImg');
        const previewGlow = ui.querySelector('#expressPreviewGlow');
        const previewCheckBadge = ui.querySelector('#expressPreviewCheckBadge');
        
        if (isOriginal) {
            if (previewCheckBadge) previewCheckBadge.classList.remove('hidden');
            if (previewGlow) {
                previewGlow.className = "absolute inset-0 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] rounded-2xl pointer-events-none";
            }
            return;
        }
        
        const localSlots = buildExpressPublishSlots();
        const idx = MISSION.selectedImagePreviewIndex || 0;
        if (localSlots.length > 0 && localSlots[idx]) {
            const slot = localSlots[idx];
            const url = slot.img.finalUrl || slot.img.imageUrl || '';
            if (previewImg) previewImg.src = url;
            
            const isSelected = ensureSyntheticPublishMask(slot.batchId, slot.batch.images.length)[slot.imageIndex];
            
            if (previewCheckBadge) {
                previewCheckBadge.classList.toggle('hidden', !isSelected);
            }
            
            if (previewGlow) {
                if (isSelected) {
                    previewGlow.className = "absolute inset-0 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] rounded-2xl pointer-events-none animate-pulse";
                } else {
                    previewGlow.className = "absolute inset-0 border border-white/10 rounded-2xl pointer-events-none";
                }
            }
        }
    };

    // 初始化預覽
    syncExpressPreview();

    // 縮圖與勾選框點擊綁定
    if (!isOriginal) {
        ui.querySelectorAll('.express-thumb-card').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('.express-checkbox-wrap') || e.target.classList.contains('express-thumb-chk')) {
                    return;
                }
                const idx = parseInt(card.dataset.idx);
                MISSION.selectedImagePreviewIndex = idx;
                
                ui.querySelectorAll('.express-thumb-card').forEach(c => {
                    c.classList.remove('border-emerald-500', 'bg-emerald-500/10');
                    c.classList.add('border-white/10');
                });
                card.classList.remove('border-white/10');
                card.classList.add('border-emerald-500', 'bg-emerald-500/10');
                
                syncExpressPreview();
            };
        });

        ui.querySelectorAll('.express-thumb-chk').forEach(chk => {
            chk.onchange = () => {
                const batchId = chk.dataset.batch;
                const imgIdx = parseInt(chk.dataset.imgidx);
                const batch = MISSION.generatedImageBatches.find(b => b.id === batchId);
                const want = chk.checked;
                
                const success = trySetPublishInclusion(batch, imgIdx, want);
                if (!success) {
                    chk.checked = false;
                    showError("發佈圖片數量（合成圖+附加圖）已達 10 張上限！");
                }
                syncExpressPreview();
            };
        });
    }

    // 3D 燈箱 Zoom 邏輯
    let lightboxOpen = false;

    const syncLightboxContent = () => {
        if (!lightboxOpen) return;
        const lbImg = ui.querySelector('#expressLbImg');
        const lbIdx = ui.querySelector('#expressLbIdx');
        
        if (isOriginal) {
            if (lbImg) {
                lbImg.src = MISSION.attachmentFiles[0]?.imageUrl || MISSION.attachmentFiles[0]?.dataUrl || '';
            }
            if (lbIdx) lbIdx.textContent = '1 / 1';
            return;
        }
        
        const localSlots = buildExpressPublishSlots();
        const n = localSlots.length;
        let idx = MISSION.selectedImagePreviewIndex || 0;
        if (n > 0) idx = Math.max(0, Math.min(idx, n - 1));
        
        if (lbImg) {
            const url = n > 0 ? (localSlots[idx].img.finalUrl || localSlots[idx].img.imageUrl || '') : '';
            lbImg.src = url || '';
        }
        if (lbIdx) lbIdx.textContent = n === 0 ? '' : `${idx + 1} / ${n}`;
    };

    const openPublishLightbox = () => {
        const localSlots = buildExpressPublishSlots();
        if (!isOriginal && !localSlots.length) return;
        
        lightboxOpen = true;
        const lb = ui.querySelector('#expressPublishLightbox');
        if (lb) {
            lb.classList.remove('hidden');
            lb.className = "fixed inset-0 z-[450] flex flex-col lightbox-backdrop";
            setTimeout(() => {
                lb.classList.add('active');
            }, 20);
            
            const lbImg = ui.querySelector('#expressLbImg');
            if (lbImg) {
                lbImg.className = "max-w-full max-h-[85vh] object-contain cursor-zoom-out select-none touch-manipulation lightbox-content";
            }
            document.body.style.overflow = 'hidden';
        }
        syncLightboxContent();
    };

    const closePublishLightbox = () => {
        lightboxOpen = false;
        const lb = ui.querySelector('#expressPublishLightbox');
        if (lb) {
            lb.classList.remove('active');
            setTimeout(() => {
                if (!lightboxOpen) lb.classList.add('hidden');
            }, 300);
        }
        document.body.style.overflow = '';
    };

    const previewWrapper = ui.querySelector('#expressPreviewWrapper');
    if (previewWrapper) {
        previewWrapper.onclick = openPublishLightbox;
    }

    const lbOverlay = ui.querySelector('#expressLbOverlay');
    const lbImg = ui.querySelector('#expressLbImg');
    if (lbOverlay) lbOverlay.onclick = closePublishLightbox;
    if (lbImg) lbImg.onclick = closePublishLightbox;

    const btnPrev = ui.querySelector('#btnExpressLbPrev');
    const btnNext = ui.querySelector('#btnExpressLbNext');

    if (btnPrev) {
        btnPrev.onclick = (e) => {
            e.stopPropagation();
            if (isOriginal) return;
            const localSlots = buildExpressPublishSlots();
            const n = localSlots.length;
            if (n <= 0) return;
            let idx = MISSION.selectedImagePreviewIndex || 0;
            idx = (idx - 1 + n) % n;
            MISSION.selectedImagePreviewIndex = idx;
            syncLightboxContent();
            syncExpressPreview();
        };
    }

    if (btnNext) {
        btnNext.onclick = (e) => {
            e.stopPropagation();
            if (isOriginal) return;
            const localSlots = buildExpressPublishSlots();
            const n = localSlots.length;
            if (n <= 0) return;
            let idx = MISSION.selectedImagePreviewIndex || 0;
            idx = (idx + 1) % n;
            MISSION.selectedImagePreviewIndex = idx;
            syncLightboxContent();
            syncExpressPreview();
        };
    }

    // 排程面板 Toggle 邏輯
    const chkSchedule = ui.querySelector('#chkExpressSchedule');
    const scheduleInputs = ui.querySelector('#expressScheduleInputs');
    const publishBtnText = ui.querySelector('#btnExpressPublishText');
    
    let fpDate = null;
    let fpTime = null;

    if (chkSchedule) {
        chkSchedule.onchange = () => {
            const wantSchedule = chkSchedule.checked;
            if (wantSchedule) {
                scheduleInputs.classList.remove('hidden');
                publishBtnText.innerText = "📅 確認排程部署";
                
                // 初始化 flatpickr
                const defaultDateObj = new Date();
                defaultDateObj.setHours(defaultDateObj.getHours() + 1);
                const m = defaultDateObj.getMinutes();
                defaultDateObj.setMinutes(m + (15 - (m % 15)));
                defaultDateObj.setSeconds(0);

                const year = defaultDateObj.getFullYear();
                const month = String(defaultDateObj.getMonth() + 1).padStart(2, '0');
                const day = String(defaultDateObj.getDate()).padStart(2, '0');
                const defDate = `${year}-${month}-${day}`;
                const defTime = defaultDateObj.toTimeString().slice(0,5);

                ui.querySelector('#expressDatePicker').value = defDate;
                ui.querySelector('#expressTimePickerInput').value = defTime;

                if (typeof flatpickr !== 'undefined') {
                    fpDate = flatpickr("#expressDatePicker", {
                        dateFormat: "Y-m-d",
                        minDate: "today",
                        defaultDate: defDate,
                        disableMobile: "true"
                    });
                    fpTime = flatpickr("#expressTimePickerInput", {
                        enableTime: true,
                        noCalendar: true,
                        dateFormat: "H:i",
                        time_24hr: true,
                        minuteIncrement: 15,
                        defaultDate: defTime,
                        disableMobile: "true"
                    });
                }
            } else {
                scheduleInputs.classList.add('hidden');
                publishBtnText.innerText = "🚀 立即部署發佈";
                if (fpDate) { fpDate.destroy(); fpDate = null; }
                if (fpTime) { fpTime.destroy(); fpTime = null; }
            }
        };
    }

    // 立即部署與排程按鈕
    const publishBtn = ui.querySelector('#btnExpressPublish');
    if (publishBtn) {
        publishBtn.onclick = async () => {
            const isScheduled = chkSchedule ? chkSchedule.checked : false;
            let scheduleIso = null;

            if (isScheduled) {
                const dateStr = ui.querySelector('#expressDatePicker').value;
                const timeStr = ui.querySelector('#expressTimePickerInput').value;
                if (!dateStr || !timeStr) {
                    return showError("排程日期與時間必須完整設定！");
                }
                const schDate = new Date(`${dateStr}T${timeStr}:00+08:00`);
                const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
                if (schDate < oneHourLater) {
                    return showError("排程部署時間需大於目前時間至少 1 個小時。");
                }
                scheduleIso = schDate.toISOString();
            }

            const editedCaption = ui.querySelector('#expressCaptionEdit').value.trim();
            if (!editedCaption) {
                return showError("貼文文案內容不可為空！");
            }

            // 更新至全域 MISSION
            MISSION.scheduledAt = scheduleIso;
            MISSION.currentCaption = editedCaption;
            MISSION.currentCaptions = { UNIFIED: editedCaption };

            // 執行載入動畫與按鈕禁用
            const spinEl = ui.querySelector('#expressPublishSpinner');
            if (spinEl) spinEl.classList.remove('hidden');
            if (publishBtnText) {
                publishBtnText.innerText = isScheduled ? "⏳ 正在排程部署中..." : "⏳ 正在發佈部署中...";
            }
            publishBtn.disabled = true;

            const regenBtn = ui.querySelector('#btnExpressRegen');
            if (regenBtn) {
                regenBtn.disabled = true;
                regenBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            const abandonBtn = ui.querySelector('#btnExpressAbandon');
            if (abandonBtn) {
                abandonBtn.disabled = true;
                abandonBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            const spinId = 'spin_pub_' + Date.now();
            await addLog("系統", "⏳", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">Agent 正在與社群伺服器連線...</span></div>`, true);

            try {
                const publishImages = isOriginal ? [] : collectSelectedPublishImagesMerged();
                
                const response = await API.publishTaskAPI({
                    taskId: taskId,
                    tenantId: STATE.uid,
                    scheduledAt: MISSION.scheduledAt,
                    finalCaption: editedCaption,
                    multiCaptions: { UNIFIED: editedCaption },
                    isIndependentPost: false,
                    attachmentFiles: isOriginal ? [{ name: 'snap_image.jpg', dataUrl: MISSION.sceneFiles[0]?.dataUrl || MISSION.sceneFiles[0]?.imageUrl || '' }] : [],
                    selectedImageBatchId: null,
                    selectedImages: publishImages.map(img => ({
                        finalUrl: img.finalUrl || img.imageUrl || '',
                        prompt: img.prompt || ''
                    }))
                });

                if (response && response.success) {
                    // 成功時才關閉並銷毀 Datepickers
                    if (fpDate) { fpDate.destroy(); fpDate = null; }
                    if (fpTime) { fpTime.destroy(); fpTime = null; }

                    releaseUI(ui);

                    const spEl = document.getElementById(spinId);
                    if (spEl) {
                        spEl.classList.remove('animate-spin', 'border-t-transparent');
                        spEl.classList.add('bg-emerald-500');
                        document.getElementById(`text_${spinId}`).innerText = "連線成功";
                    }

                    const charged = Number(response.chargedPoints);
                    if (Number.isFinite(charged) && charged > 0) {
                        await applyPointDeduction(charged, "社群發佈");
                    } else {
                        await triggerWalletSync();
                    }

                    const chatBar = document.getElementById('agentChatBar');
                    if (chatBar) chatBar.classList.add('translate-y-full');
                    
                    await addLog("系統", "🎉", `<span class="text-green-400 font-bold">發佈流程完畢</span> 任務圓滿達成！您已跨出商業化第一步！🥂`, true);
                    
                    // 自動切回對話分頁 (行動端)
                    document.getElementById('tabBtnChat')?.click();

                    const endUi = createSkillUI(`<button id="btnRestart" class="w-full bg-slate-800 border border-white/10 text-white py-3 rounded-xl font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all shadow-lg">🔄 回到任務大廳</button>`);
                    endUi.querySelector('#btnRestart').onclick = () => {
                        releaseUI(endUi);
                        window.dispatchEvent(new Event('reloadLobby'));
                    };
                } else {
                    throw new Error(response.message || "發佈失敗。");
                }
            } catch (e) {
                const spEl = document.getElementById(spinId);
                if (spEl) {
                    spEl.classList.remove('animate-spin', 'border-emerald-500');
                    spEl.classList.add('border-red-500');
                    document.getElementById(`text_${spinId}`).innerText = "連線失敗";
                }

                // 失敗時恢復按鈕狀態與載入動畫，提供重試機會
                if (spinEl) spinEl.classList.add('hidden');
                if (publishBtnText) {
                    publishBtnText.innerText = isScheduled ? "📅 確認排程部署" : "🚀 立即部署發佈";
                }
                publishBtn.disabled = false;

                if (regenBtn) {
                    regenBtn.disabled = false;
                    regenBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (abandonBtn) {
                    abandonBtn.disabled = false;
                    abandonBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }

                showError(`操作失敗：${e.message}`);
            }
        };
    }

    // 重新生成圖片 (防跑偏重算)
    const regenBtn = ui.querySelector('#btnExpressRegen');
    if (regenBtn) {
        regenBtn.onclick = async () => {
            const editedCaption = ui.querySelector('#expressCaptionEdit').value.trim();
            if (!editedCaption) {
                return showError("重算生圖前，請先填寫貼文文案！");
            }
            MISSION.currentCaption = editedCaption;
            MISSION.currentCaptions = { UNIFIED: editedCaption };

            // 點數查核
            const actionsPricing = SYSTEM_DB.pricing?.actions || {};
            const imgPrice = actionsPricing['GENERATE_IMAGE']?.retailPoints || 50;
            const resW = getImageGenBillingMultiplier(MISSION.resolution);
            const estImageCost = Math.ceil(imgPrice * resW);

            if (!validatePoints(estImageCost, "影像合成")) return;

            // 關閉 Datepickers
            if (fpDate) fpDate.destroy();
            if (fpTime) fpTime.destroy();

            // 顯示 Loading 卡
            releaseUI(ui);
            renderExpressLoadingCard("正在為您重新合成 AI 影像 (風格規格已鎖定)...");

            const spinId = 'spin_img_' + Date.now();
            await addLog("美術總監", "🎨", `<div class="flex items-center gap-2"><div id="${spinId}" class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div><span id="text_${spinId}">收到！正在為您重新發包生圖...</span></div>`, true);

            try {
                const responseImg = await API.generateImageFromDraftAPI({
                    taskId: taskId,
                    tenantId: STATE.uid,
                    editedCaption: editedCaption,
                    editedPanels: MISSION.currentPanels || [],
                    universe: MISSION.universe,
                    taskMode: 'GENERATE',
                    style: MISSION.style,
                    colorMode: MISSION.colorMode,
                    ratio: MISSION.ratio,
                    resolution: MISSION.resolution,
                    panelCount: MISSION.panelCount,
                    plannedImageCount: 1,
                    isStoryMode: false,
                    characters: [],
                    image_options: {
                        ratio: MISSION.ratio,
                        resolution: MISSION.resolution,
                        referenceImages: [
                            { type: 'scene', name: '現場照片.jpg', data: MISSION.sceneFiles[0]?.dataUrl || MISSION.sceneFiles[0]?.imageUrl || '' }
                        ],
                        attachmentFiles: []
                    },
                    tgConfig: MISSION.tgConfig
                });

                if (responseImg && responseImg.success) {
                    const spEl = document.getElementById(spinId);
                    if (spEl) {
                        spEl.classList.remove('animate-spin', 'border-t-transparent');
                        spEl.classList.add('bg-blue-500');
                        document.getElementById(`text_${spinId}`).innerText = "影像合成完畢";
                    }

                    const imagePersistNote = responseImg.persistence ? `任務ID: ${taskId}` : '';
                    await applyPointDeduction(
                        responseImg.chargedPoints !== undefined ? Number(responseImg.chargedPoints) : estImageCost,
                        "AI 智慧速發-重新生圖",
                        imagePersistNote ? { persistNote: imagePersistNote } : {}
                    );

                    recordGeneratedImageBatch(responseImg.images, editedCaption);
                    await renderSmartExpressReviewCard(taskId);
                } else {
                    throw new Error(responseImg.message || "重算失敗。");
                }
            } catch (e) {
                const spEl = document.getElementById(spinId);
                if (spEl) {
                    spEl.classList.remove('animate-spin', 'border-blue-500');
                    spEl.classList.add('border-red-500');
                    document.getElementById(`text_${spinId}`).innerText = "合成失敗";
                }
                showError(`重算失敗：${e.message}`);
                await renderSmartExpressReviewCard(taskId);
            }
        };
    }

    // 放棄與刪除此任務
    const abandonBtn = ui.querySelector('#btnExpressAbandon');
    if (abandonBtn) {
        abandonBtn.onclick = async () => {
            if (!confirm("確定要放棄此任務並刪除嗎？此動作無法復原。")) return;
            
            if (fpDate) fpDate.destroy();
            if (fpTime) fpTime.destroy();

            releaseUI(ui);
            try {
                await API.deleteAgentTaskAPI(taskId);
                window.renderTaskDashboard();
                window.dispatchEvent(new Event('reloadLobby'));
                if (window.showToast) window.showToast('任務已成功放棄並刪除。', 'success');
            } catch (error) {
                console.error("刪除失敗:", error);
                showError("放棄失敗，請手動在大廳刪除：" + error.message);
                window.dispatchEvent(new Event('reloadLobby'));
            }
        };
    }
}


