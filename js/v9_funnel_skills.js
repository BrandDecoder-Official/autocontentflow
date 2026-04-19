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
 * 📌 函數名稱：triggerTopicSkill
 * 💡 功能說明：漏斗第一步：確立任務主題。
 * 🚀 優化情境：加入 1000 字限制與動態字數計數器，防範 API Token 燃燒與幻覺。
 * ==========================================
 */
export async function triggerTopicSkill() { 
    updateStepHeader("STEP 1: STRATEGY (TOPIC)"); 
    await addLog("專案總監", "📝", "第一步，請告訴我，我們這次要推廣什麼內容或達成什麼目標？", true);
    
    const ui = createSkillUI(`
        <div class="flex flex-col gap-3">
            <div class="relative">
                <textarea id="inlineTopicInput" maxlength="1000" class="w-full bg-slate-900 border border-blue-500/30 rounded-xl p-4 pb-8 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[140px] resize-y" placeholder="例如：推廣定迎高山茶的中秋禮盒...">${decodeHTMLEntities(MISSION.topic || '')}</textarea>
                <div id="topicCharCount" class="absolute bottom-3 right-4 text-[10px] font-bold text-slate-500 bg-slate-900 px-1">0 / 1000 字</div>
            </div>
            <div class="flex justify-end mt-2">
                <button id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認戰略方向</button>
            </div>
        </div>
    `);
    
    const inputEl = ui.querySelector('#inlineTopicInput'); 
    const countEl = ui.querySelector('#topicCharCount');
    
    const updateCount = () => {
        const len = inputEl.value.length;
        countEl.innerText = `${len} / 1000 字`;
        if (len >= 1000) countEl.classList.replace('text-slate-500', 'text-red-400');
        else countEl.classList.replace('text-red-400', 'text-slate-500');
    };
    inputEl.addEventListener('input', updateCount);
    updateCount(); 

    setTimeout(() => { inputEl.focus(); }, 100);
    
    ui.querySelector('#btnConfirmTopic').onclick = async () => { 
        const val = inputEl.value.trim(); 
        if(!val) return showError('主題不能為空！'); 
        MISSION.topic = val; 
        releaseUI(ui); 
        await addLog("總編指令", "🎯", `戰略鎖定：${val}`); 
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
        else { await triggerPlatformSkill(); } 
    };
}


/**
 * ==========================================
 * 📌 函數名稱：triggerPlatformSkill
 * 💡 功能說明：漏斗第二步：選擇發布平台。
 * 🚀 優化情境：補回 Google 商家與 Blog 的鎖定狀態圖示。
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
 * 📌 函數名稱：triggerPersonaSkill
 * 💡 功能說明：漏斗第三步：選擇品牌人設。
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
 * 📌 函數名稱：triggerHookSkill
 * 💡 功能說明：漏斗第四步：選擇戰術 (開場勾子與文案長度節奏)。
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
 * 📌 函數名稱：triggerUniverseSkill
 * 💡 功能說明：漏斗第六步：宇宙智能分流。
 * 🚀 優化情境：依據宇宙進行分岔。真實攝影導向「合成模式 (REALISTIC_MODE)」；2D 動漫導向「視覺風格 (COMIC)」。
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
 * 💡 修正 1：依據總編指示，動漫的分類嚴格定義為 `COMIC`，移除舊有的 `ANIME_STYLE` 判定。
 * ==========================================
 */
export async function triggerStyleSkill() { 
    if (MISSION.universe === 'REALISTIC') {
        // 📷 真實攝影：選取合成模式 (REALISTIC_MODE)
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
        // 🎨 2D動漫：選取風格 (COMIC)
        updateStepHeader("STYLE SELECTION"); 
        
        // 💡 修正 1 落實：嚴格抓取分類或類型為 'COMIC' 的資料，不再使用 'ANIME_STYLE'
        let availableStyles = SYSTEM_DB.styles.filter(s => 
            s.category === 'COMIC' || 
            s.type === 'COMIC' || 
            s.universe === 'COMIC'
        );
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
 * 💡 功能說明：真實攝影專屬流程：選取濾鏡氛圍 (取代 ColorSkill)。
 * 🚀 優化情境：讀取 DB 的 REALISTIC_FILTER，並將結果巧妙存入 colorMode 共用欄位，節省資料庫空間。
 * ==========================================
 */
export async function triggerRealisticFilterSkill() {
    updateStepHeader("PHOTOGRAPHY FILTER");
    await addLog("攝影總監", "🎞️", "請選擇這組照片的「濾鏡氛圍」：", true);
    
    let filters = SYSTEM_DB.styles.filter(s => s.category === 'REALISTIC_FILTER');
    if(filters.length === 0) filters = [{name: '原色直出', icon: '📷'}, {name: '商業廣告', icon: '✨'}]; 

    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">`;
    filters.forEach(f => {
        // 💡 巧妙設計：將濾鏡直接存入 colorMode，省去後端額外開欄位
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
 * 💡 功能說明：2D動漫專屬流程：選取漫畫色系 (經典黑白 / 現代全彩)。
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
 * 💡 功能說明：漏斗第七步：登場角色召喚。
 * 🚀 優化情境：利用 DB 中的 type 欄位進行「物理隔離」，防止動漫宇宙選到真人角色，或真實攝影選到動漫角色。
 * 💡 修正 2：放寬角色隔離，確保沒設定 type 的舊資料也能選，向下相容動漫與寫實各有容錯空間。
 * ==========================================
 */
export async function triggerCharacterSkill() { 
    updateStepHeader("CHARACTER SUMMON"); await addLog("視覺工程師", "🧬", `請勾選要在本次任務中登場的角色 (最多4位)：`, true);
    
    // 💡 修正 2 落實：利用 type 來物理隔離動漫與真人角色，同時兼容舊資料庫未填寫 type 的情況
    const available = SYSTEM_DB.characters.filter(c => {
        if (!c.type) return true; // 如果舊資料庫沒填 type，通用顯示
        if (MISSION.universe === 'COMIC') return ['COMIC', 'ANIME', '2D'].includes(c.type.toUpperCase());
        if (MISSION.universe === 'REALISTIC') return ['REALISTIC', '3D', 'PHOTO'].includes(c.type.toUpperCase());
        return c.type === MISSION.universe;
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
 * 💡 功能說明：漏斗第八步：畫面規格與 1+9 圖片上傳引擎。
 * 🚀 優化情境：
 * 1. 寫實模式加入「防動漫惡搞次元轉換警告」。
 * 2. 實裝 1 張 AI 參考圖 + 最多 9 張社群附加輪播圖的雙軌上傳介面。
 * 💡 修正 3：補上「AI 參考主圖」返回此步驟時的預載渲染 UI，確保上傳的場景圖不會在視覺上消失。
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
    
    // 🛡️ 寫實模式防護警告
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
    
    // 📸 處理主圖 (AI 參考用)
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange = async (e) => { if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea')); }; i.click(); };
    
    // 💡 修正 3 落實：如果原本已經有上傳主圖，回到這一步時預先渲染出來，防止畫面消失！
    if (MISSION.sceneFiles && MISSION.sceneFiles.length > 0) {
        const panel = document.createElement('div');
        panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-indigo-900/20 rounded-xl border border-indigo-500/30 animate-fade-in w-full shadow-inner';
        panel.innerHTML = `<div class="text-[10px] text-indigo-400 font-bold uppercase">📸 已鎖定之 AI 參考主圖</div><div class="w-16 h-16 rounded-md overflow-hidden border border-indigo-500/50 relative"><img src="${MISSION.sceneFiles[0].dataUrl}" class="w-full h-full object-cover"><button class="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white text-[10px] w-5 h-5 rounded-bl-md flex items-center justify-center cursor-pointer" onclick="this.closest('.scene-picker-panel').remove(); MISSION.sceneFiles=[];">✕</button></div>`;
        ui.querySelector('#dynamicAssetsArea').appendChild(panel);
    }

    // 📥 處理多張附加圖 (社群輪播用)
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
 * 💡 功能說明：處理單張 AI 參考圖的極限壓縮與暫存，供後端視覺模型分析使用。
 * ==========================================
 */
export async function handleAssetUpload(file, container) { 
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); 
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-indigo-900/20 rounded-xl border border-indigo-500/30 animate-fade-in w-full shadow-inner'; 
    const dataUrl = await compressImage(file, 800); MISSION.sceneFiles = [{ dataUrl: dataUrl }]; 
    panel.innerHTML = `<div class="text-[10px] text-indigo-400 font-bold uppercase">📸 鎖定為 AI 參考主圖</div><div class="w-16 h-16 rounded-md overflow-hidden border border-indigo-500/50 relative"><img src="${dataUrl}" class="w-full h-full object-cover"><button class="absolute top-0 right-0 bg-red-500 hover:bg-red-600 text-white text-[10px] w-5 h-5 rounded-bl-md flex items-center justify-center cursor-pointer" onclick="this.closest('.scene-picker-panel').remove(); MISSION.sceneFiles=[];">✕</button></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `主參考圖已優化定位。`); 
}

/**
 * ==========================================
 * 📌 函數名稱：handleMultipleAttachments
 * 💡 功能說明：處理多張社群附加輪播圖。
 * 🚀 優化情境：在前端背景強制將圖片極限壓縮至 800px 以內，避免後端發生 504 Timeout，並嚴格限制總數最多 9 張。
 * ==========================================
 */
export async function handleMultipleAttachments(files, container, isNew = true) {
    if (!MISSION.attachmentFiles) MISSION.attachmentFiles = [];
    
    if (isNew && files.length > 0) {
        const remainingSlots = 9 - MISSION.attachmentFiles.length;
        if (remainingSlots <= 0) return showError("最多只能上傳 9 張附加圖喔！");

        const filesToProcess = Array.from(files).slice(0, remainingSlots);

        // 載入動畫提示
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'col-span-full text-xs text-indigo-400 animate-pulse text-center py-2 bg-indigo-900/20 rounded-lg border border-indigo-500/30';
        loadingMsg.innerText = '圖片極限壓縮處理中，請稍候...';
        container.appendChild(loadingMsg);

        // 背景壓縮：控制在 800px 以下，大幅降低伺服器負擔
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

    // 重新渲染圖片網格
    container.innerHTML = '';
    MISSION.attachmentFiles.forEach((af, idx) => {
        const panel = document.createElement('div');
        panel.className = 'relative w-full aspect-square rounded-md overflow-hidden border border-white/20 group shadow-md animate-fade-in';
        panel.innerHTML = `
            <img src="${af.dataUrl}" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button class="bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-[10px] flex items-center justify-center shadow-lg transform hover:scale-110 transition-all" data-idx="${idx}">✕</button>
            </div>
        `;
        panel.querySelector('button').onclick = () => {
            MISSION.attachmentFiles.splice(idx, 1);
            handleMultipleAttachments([], container, false); // 重新渲染
        };
        container.appendChild(panel);
    });
}

/**
 * ==========================================
 * 📌 函數名稱：triggerScheduleSkill
 * 💡 功能說明：漏斗最後一步：指定部署排程 (發布時間)。
 * 🚀 優化情境：將時間選單全面交給 Flatpickr 接管，強制以 15 分鐘為單位跳動，並自動進位預設時間。
 * ==========================================
 */
export async function triggerScheduleSkill() { 
    updateStepHeader("PUBLISH SCHEDULE"); 
    await addLog("社群總監", "📅", "最後一步，請指派部署時間（排程需大於目前時間 1 小時）：", true);
    
    const defaultDateObj = new Date();
    if (MISSION.scheduledAt) {
        defaultDateObj.setTime(new Date(MISSION.scheduledAt).getTime());
    } else {
        // 預設加 1 小時
        defaultDateObj.setHours(defaultDateObj.getHours() + 1);
        // 💡 智能進位：將分鐘無條件進位到下一個 15 的倍數 (00, 15, 30, 45)
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
    
    // 📅 綁定日期的 Flatpickr
    const fpDate = typeof flatpickr !== 'undefined' ? flatpickr("#datePicker", { 
        dateFormat: "Y-m-d", 
        minDate: "today", 
        defaultDate: defDate,
        disableMobile: "true",
        locale: (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.zh) ? "zh" : "default"
    }) : null;

    // ⏰ 綁定時間的 Flatpickr (強制 15 分鐘區間)
    const fpTime = typeof flatpickr !== 'undefined' ? flatpickr("#timePickerInput", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 15, // 🚀 這裡就是 15 分鐘跳轉刻度的核心指令！
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
