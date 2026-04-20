// js/v9_funnel_skills.js
import { MISSION, SYSTEM_DB, IS_EDIT_MODE, isMissionComplete, compressImage } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';
import { decodeHTMLEntities } from './v9_funnel_utils.js';
import { triggerMissionSummary } from './v9_funnel_dashboard.js';
import { CONFIG, STATE } from './config.js'; 
import * as API from './api.js';

export async function startNewFunnel() { await triggerTopicSkill(); }

/**
 * ==========================================
 * 📌 核心漏斗 STEP 1：確立任務主題 (triggerTopicSkill)
 * 💡 功能說明：收集並鎖定本次行銷任務的核心目標與推廣內容。
 * 🚀 V1 終極版升級：實裝「RSS 熱門新聞進料模組」，一鍵抓取靈感。
 * ==========================================
 */
export async function triggerTopicSkill() { 
    updateStepHeader("STEP 1: STRATEGY (TOPIC)"); 
    await addLog("專案總監", "📝", "第一步，請告訴我，我們這次要推廣什麼內容或達成什麼目標？", true);
    
    const ui = createSkillUI(`
        <div class="flex flex-col gap-3 relative">
            <div class="flex justify-between items-end mb-1">
                <label class="text-[10px] text-slate-400 font-bold">戰略主題與內容</label>
                <button id="btnOpenRSS" class="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1 shadow-lg active:scale-95">
                    📰 抓取熱門新聞
                </button>
            </div>

            <div id="rssPanel" class="hidden flex-col gap-3 bg-slate-800 border border-indigo-500/50 rounded-xl p-3 animate-fade-in shadow-2xl relative">
                <div class="absolute -top-2 right-4 w-4 h-4 bg-slate-800 border-t border-l border-indigo-500/50 transform rotate-45"></div>
                <div class="flex overflow-x-auto gap-2 pb-1 scrollbar-hide" id="rssCategoryTabs">
                    <button class="rss-cat-btn px-3 py-1 bg-indigo-600 text-white border border-indigo-500 rounded-full text-[10px] font-bold whitespace-nowrap transition-all" data-cat="BUSINESS">財金</button>
                    <button class="rss-cat-btn px-3 py-1 bg-slate-700 text-slate-300 border border-white/10 rounded-full text-[10px] font-bold whitespace-nowrap hover:bg-slate-600 transition-all" data-cat="POLITICS">政治</button>
                    <button class="rss-cat-btn px-3 py-1 bg-slate-700 text-slate-300 border border-white/10 rounded-full text-[10px] font-bold whitespace-nowrap hover:bg-slate-600 transition-all" data-cat="WORLD">國際</button>
                    <button class="rss-cat-btn px-3 py-1 bg-slate-700 text-slate-300 border border-white/10 rounded-full text-[10px] font-bold whitespace-nowrap hover:bg-slate-600 transition-all" data-cat="ENTERTAINMENT">娛樂</button>
                    <button class="rss-cat-btn px-3 py-1 bg-slate-700 text-slate-300 border border-white/10 rounded-full text-[10px] font-bold whitespace-nowrap hover:bg-slate-600 transition-all" data-cat="SPORTS">運動</button>
                    <button class="rss-cat-btn px-3 py-1 bg-slate-700 text-slate-300 border border-white/10 rounded-full text-[10px] font-bold whitespace-nowrap hover:bg-slate-600 transition-all" data-cat="LIFE">生活</button>
                </div>
                <div id="rssLoading" class="hidden text-center text-[10px] text-indigo-400 py-6 animate-pulse font-bold">📡 正在接收 Google News 衛星訊號...</div>
                <div id="rssList" class="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar"></div>
            </div>

            <div class="relative">
                <textarea id="inlineTopicInput" maxlength="1000" class="w-full bg-slate-900 border border-blue-500/30 rounded-xl p-4 pb-8 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[140px] resize-y" placeholder="您可以自己輸入，或是點擊上方按鈕抓取新聞來生成..."> ${decodeHTMLEntities(MISSION.topic || '')}</textarea>
                <div id="topicCharCount" class="absolute bottom-3 right-4 text-[10px] font-bold text-slate-500 bg-slate-900 px-1">0 / 1000 字</div>
            </div>
            <div class="flex justify-end mt-2">
                <button id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認戰略方向</button>
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

    // 📡 RSS 模組互動邏輯
    const btnOpenRSS = ui.querySelector('#btnOpenRSS');
    const rssPanel = ui.querySelector('#rssPanel');
    const rssCategoryTabs = ui.querySelectorAll('.rss-cat-btn');
    const rssList = ui.querySelector('#rssList');
    const rssLoading = ui.querySelector('#rssLoading');

    btnOpenRSS.onclick = () => {
        rssPanel.classList.toggle('hidden');
        if (!rssPanel.classList.contains('hidden') && rssList.innerHTML === '') {
            loadRSSNews('BUSINESS'); // 預設載入財金
        }
    };

    rssCategoryTabs.forEach(btn => {
        btn.onclick = () => {
            // 切換樣式
            rssCategoryTabs.forEach(b => { 
                b.classList.remove('bg-indigo-600', 'text-white', 'border-indigo-500'); 
                b.classList.add('bg-slate-700', 'text-slate-300', 'border-white/10'); 
            });
            btn.classList.remove('bg-slate-700', 'text-slate-300', 'border-white/10');
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
            const res = await fetch(`${baseUrl}/api/rss/news?category=${category}`);
            const json = await res.json();
            
            if (json.success && json.data) {
                if (json.data.length === 0) {
                    rssList.innerHTML = `<div class="text-[10px] text-slate-400 text-center py-4">此分類目前無新聞</div>`;
                    return;
                }
                json.data.forEach(news => {
                    const div = document.createElement('div');
                    div.className = "p-3 bg-slate-900 border border-white/5 rounded-lg hover:bg-indigo-900/40 hover:border-indigo-500/50 cursor-pointer transition-all flex flex-col gap-1";
                    div.innerHTML = `
                        <span class="text-xs font-bold text-white line-clamp-1 leading-tight">${news.title}</span>
                        <span class="text-[10px] text-slate-400 line-clamp-2 leading-tight">${news.content}</span>
                    `;
                    div.onclick = async () => {
                        // 自動填入，並加上排版
                        inputEl.value = `【今日熱門話題】\n${news.title}\n\n【情報摘要】\n${news.content}`;
                        updateCount();
                        rssPanel.classList.add('hidden');
                        await addLog("情報官", "📡", `已載入情報：<b>${news.title.substring(0, 15)}...</b>`);
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

    setTimeout(() => { inputEl.focus(); }, 100);
    
    ui.querySelector('#btnConfirmTopic').onclick = async () => { 
        const val = inputEl.value.trim(); 
        if(!val) return showError('主題不能為空！'); 
        MISSION.topic = val; 
        releaseUI(ui); 
        await addLog("總編指令", "🎯", `戰略鎖定：${val.substring(0, 20)}...`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
        else { await triggerPlatformSkill(); } 
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
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
        else { await triggerPersonaSkill(); } 
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
            if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
            else { await triggerHookSkill(); } 
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
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] font-bold text-slate-400">🎣 開場勾子 (Hook)</label>
                    <select id="selHookType" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer">
                        <option value="痛點提問" ${MISSION.hookType === '痛點提問' ? 'selected' : ''}>❓ 痛點提問</option>
                        <option value="反直覺爆點" ${MISSION.hookType === '反直覺爆點' ? 'selected' : ''}>💥 反直覺爆點</option>
                        <option value="利益誘惑" ${MISSION.hookType === '利益誘惑' ? 'selected' : ''}>🎁 利益誘惑</option>
                        <option value="溫情故事" ${MISSION.hookType === '溫情故事' ? 'selected' : ''}>📖 溫情故事</option>
                    </select>
                </div>
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] font-bold text-slate-400">📏 文案長度節奏</label>
                    <select id="selLength" class="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer">
                        <option value="短平快 (約150字)" ${MISSION.contentLength === '短平快 (約150字)' ? 'selected' : ''}>⚡ 短平快 (150字)</option>
                        <option value="深度文 (約300字)" ${MISSION.contentLength === '深度文 (約300字)' ? 'selected' : ''}>📖 深度文 (300字)</option>
                    </select>
                </div>
            </div>
            <div class="flex justify-end border-t border-white/10 pt-4">
                <button id="btnConfirmHook" class="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">🧠 鎖定戰術</button>
            </div>
        </div>
    `;
    const ui = createSkillUI(strategyPanelHTML);
    ui.querySelector('#btnConfirmHook').onclick = async () => { 
        MISSION.hookType = ui.querySelector('#selHookType').value; 
        MISSION.contentLength = ui.querySelector('#selLength').value; 
        releaseUI(ui); 
        await addLog("社群總監", "✅", `戰術配置：${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]}`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
        else { await triggerUniverseSkill(); }
    };
}

/**
 * ==========================================
 * 📌 核心漏斗 STEP 6：宇宙智能分流 (triggerUniverseSkill)
 * ==========================================
 */
export async function triggerUniverseSkill() { 
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const ui = createSkillUI(`
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-3">
            <button class="uni-btn p-3 lg:p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC"><span class="text-2xl lg:text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button>
            <button class="uni-btn p-3 lg:p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC"><span class="text-2xl lg:text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button>
            <button class="uni-btn p-3 lg:p-4 rounded-2xl border border-white/10 hover:border-yellow-500 hover:bg-yellow-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'ENHANCE' ? 'border-yellow-500 bg-yellow-600/20' : 'bg-slate-800'}" data-val="ENHANCE"><span class="text-2xl lg:text-3xl">✨</span><span class="font-black text-xs text-white">無損美化</span></button>
        </div>
    `);
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
                MISSION.ratio = MISSION.universe === 'ENHANCE' ? '原圖比例' : '9:16'; 
            } 
            
            releaseUI(ui); 
            await addLog("美術總監", "✅", `宇宙鎖定：${MISSION.universe}。`); 
            
            if (MISSION.universe === 'ENHANCE') {
                if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); }
            } else {
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
    if (MISSION.universe === 'REALISTIC') {
        updateStepHeader("SYNTHESIS MODE"); 
        await addLog("攝影總監", "📸", "進入寫實攝影棚！請選擇這張圖的「核心對焦與合成模式」：", true);
        
        let modes = SYSTEM_DB.styles.filter(s => s.category === 'REALISTIC_MODE');
        if(modes.length === 0) modes = [
            {name: '人物優先', icon: '👤', desc: '聚焦模特表情與姿態'},
            {name: '商品優先', icon: '🛍️', desc: '強化產品光影與細節'},
            {name: '整體構圖優化', icon: '🖼️', desc: '平衡人景物完美氛圍'}
        ]; 

        let html = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:gap-3">`; 
        modes.forEach(m => { 
            html += `<button class="style-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === m.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${m.name}"><span class="text-xl lg:text-2xl mb-1">${m.icon || '✨'}</span><span class="font-bold text-[11px] lg:text-xs text-white">${m.name}</span><span class="text-[9px] text-slate-400 line-clamp-2">${m.desc || m.promptPrefix || ''}</span></button>`; 
        }); 
        html += `</div>`;
        const ui = createSkillUI(html); 
        ui.querySelectorAll('.style-btn').forEach(btn => { 
            btn.onclick = async () => { 
                MISSION.style = btn.dataset.val; 
                releaseUI(ui); 
                await addLog("攝影總監", "✅", `合成模式鎖定：<b>${MISSION.style}</b>。`); 
                if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
                else { await triggerRealisticFilterSkill(); } 
            }; 
        });

    } else {
        updateStepHeader("STYLE SELECTION"); 
        
        let availableStyles = SYSTEM_DB.styles.filter(s => {
            const sCat = String(s.category || '').trim().toUpperCase();
            return sCat === 'ANIME' || sCat === 'ANIME_STYLE';
        });
        if(availableStyles.length === 0) availableStyles = [{id: 'MANGA_BW', name: '預設風格', icon: '🎨'}];
        
        let html = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 lg:gap-3">`; 
        availableStyles.forEach(s => { 
            html += `<button class="style-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.name}"><span class="text-lg lg:text-xl">${s.icon || '🎨'}</span><span class="font-bold text-[11px] lg:text-xs text-white">${s.name}</span></button>`; 
        }); 
        html += `</div>`;
        const ui = createSkillUI(html); 
        ui.querySelectorAll('.style-btn').forEach(btn => { 
            btn.onclick = async () => { 
                MISSION.style = btn.dataset.val; releaseUI(ui); 
                await addLog("美術總監", "✅", `風格鎖定：${MISSION.style}。`); 
                if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
                else { await triggerColorSkill(); } 
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
    
    let filters = SYSTEM_DB.styles.filter(s => s.category === 'REALISTIC_FILTER');
    if(filters.length === 0) filters = [{name: '原色直出', icon: '📷'}, {name: '商業廣告', icon: '✨'}]; 

    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">`;
    filters.forEach(f => {
        html += `<button class="color-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === f.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${f.name}"><span class="text-xl lg:text-2xl mb-1">${f.icon || '🎞️'}</span><span class="font-bold text-[11px] lg:text-xs text-white">${f.name}</span></button>`;
    });
    html += `</div>`;
    
    const ui = createSkillUI(html);
    ui.querySelectorAll('.color-btn').forEach(btn => {
        btn.onclick = async () => {
            MISSION.colorMode = btn.dataset.val; 
            releaseUI(ui);
            await addLog("攝影總監", "✅", `濾鏡鎖定：<b>${MISSION.colorMode}</b>。`);
            if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); }
            else { await triggerCharacterSkill(); }
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
    const ui = createSkillUI(`<div class="grid grid-cols-2 gap-2 lg:gap-3"><button class="color-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-slate-400 hover:bg-white/5 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'BW' ? 'border-blue-500 bg-white/5' : ''}" data-val="BW"><span class="text-2xl lg:text-3xl mb-1">🏁</span><span class="font-bold text-[11px] lg:text-xs text-white">經典黑白</span><span class="text-[9px] text-slate-400 hidden sm:block">懷舊網點質感</span></button><button class="color-btn p-3 lg:p-4 rounded-xl border border-white/10 hover:border-pink-400 hover:bg-pink-600/10 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'Color' ? 'border-pink-500 bg-pink-600/10' : ''}" data-val="Color"><span class="text-2xl lg:text-3xl mb-1">🌈</span><span class="font-bold text-[11px] lg:text-xs text-white">現代全彩</span><span class="text-[9px] text-slate-400 hidden sm:block">飽滿現代動漫感</span></button></div>`);
    ui.querySelectorAll('.color-btn').forEach(btn => { btn.onclick = async () => { MISSION.colorMode = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `色系已鎖定：<b>${MISSION.colorMode === 'BW' ? "黑白漫畫" : "全彩動漫"}</b>。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerCharacterSkill(); } }; });
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
        ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } }; 
        return; 
    }
    
    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-4">`; let tempSelected = [...MISSION.characters];
    available.forEach(char => { const isSelected = tempSelected.includes(char.name); html += `<div class="char-select-card flex flex-col items-center gap-2 cursor-pointer transition-all p-2 lg:p-3 rounded-xl bg-slate-800 relative ${isSelected ? 'border-2 border-blue-500 bg-blue-900/30' : 'border border-white/10 hover:border-slate-500'}" data-name="${char.name}"><div class="w-12 h-12 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-slate-700 pointer-events-none"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[10px] lg:text-xs font-bold text-slate-200 pointer-events-none truncate w-full text-center">${char.name}</span>${isSelected ? '<div class="absolute top-1 right-1 lg:top-2 lg:right-2 text-blue-400 font-black text-sm">✓</div>' : ''}</div>`; });
    html += `</div><div class="flex gap-2"><button id="btnSkipChar" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all border border-white/10 hover:bg-slate-700">⏭️ 不召喚</button><button id="btnConfirmChar" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認召喚</button></div>`;
    
    const ui = createSkillUI(html);
    ui.querySelectorAll('.char-select-card').forEach(card => { card.onclick = () => { const name = card.dataset.name; if (tempSelected.includes(name)) { tempSelected = tempSelected.filter(n => n !== name); card.classList.remove('border-2', 'border-blue-500', 'bg-blue-900/30'); card.classList.add('border', 'border-white/10'); const check = card.querySelector('.absolute'); if(check) check.remove(); } else { if (tempSelected.length >= 4) return showError('最多 4 位。'); tempSelected.push(name); card.classList.remove('border', 'border-white/10'); card.classList.add('border-2', 'border-blue-500', 'bg-blue-900/30'); card.innerHTML += '<div class="absolute top-1 right-1 lg:top-2 lg:right-2 text-blue-400 font-black text-sm">✓</div>'; } }; });
    ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
    ui.querySelector('#btnConfirmChar').onclick = async () => { MISSION.characters = tempSelected; releaseUI(ui); await addLog("視覺工程師", "✅", MISSION.characters.length > 0 ? `已鎖定角色：<b>${MISSION.characters.join('、')}</b>。` : "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
}

/**
 * ==========================================
 * 📌 函數名稱：triggerVisualSkill
 * ==========================================
 */
export async function triggerVisualSkill() { 
    updateStepHeader("VISUAL & ATTACHMENTS"); 
    const isEnhance = MISSION.universe === 'ENHANCE'; 
    const isComic = MISSION.universe === 'COMIC'; 
    const isRealistic = MISSION.universe === 'REALISTIC';
    
    await addLog("影像總監", "📸", isEnhance ? "美化模式：請上傳原圖。" : "請確認畫面參數，並上傳參考圖與社群附加圖：", true);
    
    let currentRatio = MISSION.ratio || '9:16'; 
    let currentRes = MISSION.resolution || '1K'; 
    let currentPanelCount = MISSION.panelCount || 4;
    
    const panelHtml = isComic ? `<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">🖼️ 漫畫格數</label><div class="grid grid-cols-4 gap-2"><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1">1格</button><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2">2格</button><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="3">3格</button><button class="panel-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4">4格</button></div></div>` : '';
    
    const warningHtml = isRealistic ? `<div class="bg-orange-500/10 border border-orange-500/30 p-2 rounded-lg text-[10px] text-orange-400 mb-3 shadow-inner">⚠️ 提示：寫實模式下請盡量上傳真實照片。若上傳 2D 動漫圖片，AI 將啟動「次元轉換」強制進行寫實化合成，成功率可能較低。</div>` : '';

    const ui = createSkillUI(`
        <div class="flex flex-col gap-4">
            <div class="bg-blue-600/10 p-3 lg:p-4 rounded-xl border border-blue-500/30 shadow-md">
                <div class="grid grid-cols-2 gap-2 lg:gap-3">
                    <button ${isEnhance ? 'disabled' : `id="btnEditRatio"`} class="flex flex-col items-center justify-center bg-slate-800 p-2 lg:p-3 rounded-xl border border-white/10 active:scale-95 ${isEnhance ? 'opacity-50' : 'hover:bg-slate-700'}"><span class="text-[9px] lg:text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-sm lg:text-lg font-black text-white tag-ratio">${currentRatio}</span></button>
                    <button id="btnEditRes" class="flex flex-col items-center justify-center bg-slate-800 p-2 lg:p-3 rounded-xl border border-white/10 active:scale-95 hover:bg-slate-700"><span class="text-[9px] lg:text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-sm lg:text-lg font-black text-white tag-res">${currentRes}</span></button>
                </div>
            </div>
            
            <div id="customPanel" class="hidden flex flex-col gap-4 bg-slate-900/80 p-4 rounded-xl border border-white/10 animate-fade-in shadow-inner">
                ${isEnhance ? '' : `<div class="space-y-3"><label class="text-[10px] text-slate-500 font-black">📐 比例</label><div class="grid grid-cols-3 gap-2"><button class="ratio-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="9:16">9:16</button><button class="ratio-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="16:9">16:9</button><button class="ratio-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1:1">1:1</button></div></div>`}
                <div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">✨ 解析度</label><div class="grid grid-cols-3 gap-2"><button class="res-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1K">1K</button><button class="res-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2K">2K</button><button class="res-btn py-2 lg:py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4K">4K</button></div></div>
                ${panelHtml}
            </div>
            
            <div class="border-t border-white/10 pt-4">
                ${warningHtml}
                <button id="btnUploadScene" class="w-full bg-slate-800 py-4 rounded-xl text-xs font-black border border-indigo-500/50 hover:bg-indigo-900/40 active:scale-95 transition-all text-indigo-300 shadow-lg"><span class="text-lg">📸</span> 點此上傳 AI 參考圖 <span class="text-indigo-400/50 font-normal">(限 1 張)</span></button>
                <div id="dynamicAssetsArea" class="flex flex-col gap-2 empty:hidden w-full mt-2"></div>
            </div>

            <div class="border-t border-white/10 pt-4">
                <button id="btnUploadAttachments" class="w-full bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 border-dashed hover:border-slate-400 active:scale-95 transition-all text-slate-300 shadow-md"><span class="text-lg">📥</span> 上傳社群附加輪播圖 <span class="text-slate-500 font-normal">(選填，最多 9 張)</span></button>
                <div id="attachmentAssetsArea" class="grid grid-cols-3 sm:grid-cols-4 gap-2 empty:hidden w-full mt-2"></div>
            </div>

            <button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 rounded-xl font-black text-xs shadow-lg mt-2 active:scale-95">✅ 鎖定參數與素材</button>
        </div>
    `);

    const openPanel = () => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    if(ui.querySelector('#btnEditRatio')) ui.querySelector('#btnEditRatio').onclick = openPanel;
    if(ui.querySelector('#btnEditRes')) ui.querySelector('#btnEditRes').onclick = openPanel;
    
    if (!isEnhance) { ui.querySelectorAll('.ratio-btn').forEach(btn => { if(btn.dataset.val === currentRatio) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRatio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = currentRatio; }; }); }
    ui.querySelectorAll('.res-btn').forEach(btn => { if(btn.dataset.val === currentRes) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRes = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = currentRes; }; });
    if (isComic) { ui.querySelectorAll('.panel-btn').forEach(btn => { if(parseInt(btn.dataset.val) === currentPanelCount) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentPanelCount = parseInt(btn.dataset.val); ui.querySelectorAll('.panel-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); }; }); }
    
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange = async (e) => { if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea')); }; i.click(); };
    
    if (MISSION.sceneFiles && MISSION.sceneFiles.length > 0) {
        const panel = document.createElement('div');
        panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-indigo-900/20 rounded-xl border border-indigo-500/30 animate-fade-in w-full shadow-inner';
        panel.innerHTML = `<div class="text-[10px] text-indigo-400 font-bold uppercase">📸 已鎖定之 AI 參考主圖</div><div class="w-16 h-16 rounded-md overflow-hidden border border-indigo-500/50 relative"><img src="${MISSION.sceneFiles[0].dataUrl || MISSION.sceneFiles[0].imageUrl}" class="w-full h-full object-cover"><button class="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white text-[10px] w-5 h-5 rounded-bl-md flex items-center justify-center cursor-pointer" onclick="this.closest('.scene-picker-panel').remove(); MISSION.sceneFiles=[];">✕</button></div>`;
        ui.querySelector('#dynamicAssetsArea').appendChild(panel);
    }

    if(MISSION.attachmentFiles && MISSION.attachmentFiles.length > 0) {
         handleMultipleAttachments([], ui.querySelector('#attachmentAssetsArea'), false); 
    }
    ui.querySelector('#btnUploadAttachments').onclick = () => {
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

    ui.querySelector('#btnAcceptVisual').onclick = async () => { 
        MISSION.ratio = currentRatio; MISSION.resolution = currentRes; MISSION.panelCount = currentPanelCount; 
        if (!isMissionComplete()) return showError('請完成設定！'); 
        releaseUI(ui); 
        await addLog("影像總監", "✅", `參數鎖定：<b>${MISSION.ratio} / ${isComic ? currentPanelCount+'格' : ''}</b>。 附掛 ${MISSION.attachmentFiles?.length || 0} 張輔助圖。`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerScheduleSkill(); }
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
        await triggerMissionSummary();
    };
}
