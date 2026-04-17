// js/v9_funnel_skills.js
import { MISSION, SYSTEM_DB, IS_EDIT_MODE, isMissionComplete, compressImage } from './v9_state.js';
import { updateStepHeader, createSkillUI, releaseUI, addLog, showError } from './v9_ui.js';
import { decodeHTMLEntities } from './v9_funnel_utils.js';
import { triggerMissionSummary } from './v9_funnel_dashboard.js';
import { CONFIG, STATE } from './config.js'; 
import * as API from './api.js'; // 🌟 引入統一的 API 模組

// 🌟 V10 全新入口：從「主題」開始
export async function startNewFunnel() { await triggerTopicSkill(); }

// ==========================================
// 📍 Step 1: 確立主題 (The Topic)
// ==========================================
export async function triggerTopicSkill() { 
    updateStepHeader("STEP 1: STRATEGY (TOPIC)"); 
    await addLog("專案總監", "📝", "第一步，請告訴我，我們這次要推廣什麼內容或達成什麼目標？", true);
    
    const ui = createSkillUI(`
        <div class="flex flex-col gap-3 mb-4">
            <textarea id="inlineTopicInput" class="w-full bg-slate-900 border border-blue-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-blue-500 min-h-[120px] resize-y" placeholder="例如：推廣定迎高山茶的中秋禮盒，強調米其林三星與國禮背書...">${decodeHTMLEntities(MISSION.topic)}</textarea>
            <div class="flex justify-end mt-2">
                <button id="btnConfirmTopic" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認戰略方向</button>
            </div>
        </div>
    `);
    
    const inputEl = ui.querySelector('#inlineTopicInput'); 
    setTimeout(() => { inputEl.focus(); }, 100);
    
    ui.querySelector('#btnConfirmTopic').onclick = async () => { 
        const val = inputEl.value.trim(); 
        if(!val) return showError('主題不能為空！大腦需要方向。'); 
        
        MISSION.topic = val; 
        releaseUI(ui); 
        await addLog("總編指令", "🎯", `戰略鎖定：${val}`); 
        
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
        else { await triggerPlatformSkill(); } 
    };
}

// ==========================================
// 📍 Step 2: 選擇戰場 (The Platforms) + 觸發後端建檔
// ==========================================
export async function triggerPlatformSkill() { 
    updateStepHeader("STEP 2: BATTLEFIELD (PLATFORMS)"); 
    await addLog("社群總監", "🚀", "這波戰役，我們打算空投到哪些平台？這會決定大腦輸出的格式。", true);
    
    // 🛠️ 修正：將 LINE 移入籌備中區域
    const ui = createSkillUI(`
        <div class="mb-4">
            <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6" id="platformMatrix">
                
                <div class="plat-card flex flex-col items-center gap-2 group cursor-pointer transition-all" data-val="FB" data-active="border-blue-500 bg-blue-600/20" data-inactive="border-white/10 bg-slate-800">
                    <div class="w-14 h-14 lg:w-16 lg:h-16 border rounded-2xl flex justify-center items-center transition-all icon-box border-white/10 bg-slate-800"><i class="fa-brands fa-facebook-f text-2xl lg:text-3xl icon-color text-slate-500"></i></div>
                    <span class="text-[10px] font-bold text-slate-400 title-text">Facebook</span>
                </div>
                
                <div class="plat-card flex flex-col items-center gap-2 group cursor-pointer transition-all" data-val="IG" data-active="border-pink-500 bg-pink-600/20" data-inactive="border-white/10 bg-slate-800">
                    <div class="w-14 h-14 lg:w-16 lg:h-16 border rounded-2xl flex justify-center items-center transition-all icon-box border-white/10 bg-slate-800"><i class="fa-brands fa-instagram text-2xl lg:text-3xl icon-color text-slate-500"></i></div>
                    <span class="text-[10px] font-bold text-slate-400 title-text">Instagram</span>
                </div>
                
                <div class="plat-card flex flex-col items-center gap-2 group cursor-pointer transition-all" data-val="THREADS" data-active="border-white bg-white/10" data-inactive="border-white/10 bg-slate-800">
                    <div class="w-14 h-14 lg:w-16 lg:h-16 border rounded-2xl flex justify-center items-center transition-all icon-box border-white/10 bg-slate-800"><i class="fa-brands fa-threads text-2xl lg:text-3xl icon-color text-slate-500"></i></div>
                    <span class="text-[10px] font-bold text-slate-400 title-text">Threads</span>
                </div>
                
                <div class="flex flex-col items-center gap-2 grayscale opacity-40 cursor-not-allowed relative group">
                    <div class="absolute -top-3 bg-slate-700 text-[9px] px-2 py-0.5 rounded border border-slate-500 text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">籌備中</div>
                    <div class="w-14 h-14 lg:w-16 lg:h-16 bg-slate-800 border border-white/10 rounded-2xl flex justify-center items-center"><i class="fa-brands fa-line text-2xl lg:text-3xl text-slate-400"></i></div>
                    <span class="text-[10px] font-bold text-slate-500">LINE</span>
                </div>

                <div class="flex flex-col items-center gap-2 grayscale opacity-40 cursor-not-allowed relative group">
                    <div class="absolute -top-3 bg-slate-700 text-[9px] px-2 py-0.5 rounded border border-slate-500 text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">籌備中</div>
                    <div class="w-14 h-14 lg:w-16 lg:h-16 bg-slate-800 border border-white/10 rounded-2xl flex justify-center items-center"><i class="fa-brands fa-google text-2xl lg:text-3xl text-slate-400"></i></div>
                    <span class="text-[10px] font-bold text-slate-500">G.商家</span>
                </div>
                
                <div class="flex flex-col items-center gap-2 grayscale opacity-40 cursor-not-allowed relative group">
                    <div class="absolute -top-3 bg-slate-700 text-[9px] px-2 py-0.5 rounded border border-slate-500 text-white font-bold z-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">籌備中</div>
                    <div class="w-14 h-14 lg:w-16 lg:h-16 bg-slate-800 border border-white/10 rounded-2xl flex justify-center items-center"><i class="fa-brands fa-wordpress text-2xl lg:text-3xl text-slate-400"></i></div>
                    <span class="text-[10px] font-bold text-slate-500">Blog</span>
                </div>
            </div>
            <div class="flex justify-end border-t border-white/10 pt-4">
                <button id="btnConfirmPlat" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">鎖定戰場，準備發起任務</button>
            </div>
        </div>
    `);

    let tempPlats = [...MISSION.platforms];
    
    // UI 點擊切換邏輯
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
                box.classList.remove(...activeClasses); 
                box.classList.add(...inactiveClasses); 
                icon.classList.replace(`text-${activeClasses[0].split('-')[1]}-500`, 'text-slate-500'); 
                text.classList.replace('text-white', 'text-slate-400');
            } else { 
                tempPlats.push(val); 
                box.classList.remove(...inactiveClasses); 
                box.classList.add(...activeClasses); 
                icon.classList.replace('text-slate-500', `text-${activeClasses[0].split('-')[1]}-500`); 
                if(val === 'THREADS') icon.classList.replace('text-slate-500', 'text-white');
                text.classList.replace('text-slate-400', 'text-white');
            } 
        }; 
    });

    // 🌟 確認送出 & 透過 API.js 建立任務
    ui.querySelector('#btnConfirmPlat').onclick = async () => { 
        if (tempPlats.length === 0) return showError('請至少選擇一個平台！'); 
        MISSION.platforms = tempPlats; 
        
        const btn = ui.querySelector('#btnConfirmPlat');
        btn.innerHTML = '<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div>任務建檔中...';
        btn.disabled = true;

        try {
            const payload = {
                tenantId: STATE.uid || 'user_chief_001',
                missionContext: {
                    topic: MISSION.topic,
                    platforms: MISSION.platforms
                },
                currentStatus: 'DRAFTING'
            };

            const data = await API.createAgentTaskAPI(payload);
            MISSION.currentTaskId = data.taskId; 

            releaseUI(ui); 
            await addLog("系統", "💾", `任務已建立。追蹤代碼：<span class="text-xs font-mono text-slate-500">${MISSION.currentTaskId}</span>`);
            await addLog("社群總監", "✅", `已鎖定平台：${MISSION.platforms.join(' / ')}。`); 
            
            if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
            else { await triggerPersonaSkill(); } 

        } catch (error) {
            showError(`任務建檔失敗：${error.message}`);
            btn.innerHTML = '重試鎖定戰場';
            btn.disabled = false;
        }
    };
}

// ==========================================
// 📍 Step 3: 選擇人設 (The Persona)
// ==========================================
export async function triggerPersonaSkill() { 
    updateStepHeader("STEP 3: SOUL (PERSONA)"); 
    await addLog("專案總監", "🎭", "針對這些平台，我們這次要派出哪位「品牌代言人」來發言？", true);
    
    let html = `<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">`; 
    SYSTEM_DB.personas.forEach(p => { 
        html += `<button class="persona-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.persona === p.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${p.name}">
            <span class="text-2xl mb-1">${p.icon}</span>
            <span class="font-bold text-sm text-white">${p.name}</span>
            <span class="text-[10px] text-slate-400 leading-relaxed">${p.desc}</span>
        </button>`; 
    }); 
    html += `</div>`;
    
    const ui = createSkillUI(html); 
    ui.querySelectorAll('.persona-btn').forEach(btn => { 
        btn.onclick = async () => { 
            MISSION.persona = btn.dataset.val; 
            releaseUI(ui); 
            await addLog("專案總監", "✅", `已掛載人設模組：<b>${MISSION.persona}</b>。`); 
            
            if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
            else { await triggerHookSkill(); } 
        }; 
    });
}

// ==========================================
// 📍 Step 4: 鉤子與策略 (The Hook)
// ==========================================
export async function triggerHookSkill() { 
    updateStepHeader("STEP 4: TACTICS (HOOK & LENGTH)"); 
    await addLog("社群總監", "🎣", "人設鎖定！那麼開頭的第一句，我們打算怎麼抓住眼球？", true);
    
    const strategyPanelHTML = `
        <div class="p-5 bg-slate-800/80 border border-indigo-500/30 rounded-2xl shadow-inner text-left mb-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-2">🎣 開場勾子 (Hook)</label>
                    <select id="selHookType" class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer shadow-lg">
                        <option value="痛點提問" ${MISSION.hookType === '痛點提問' ? 'selected' : ''}>❓ 痛點提問 (引發共鳴)</option>
                        <option value="反直覺爆點" ${MISSION.hookType === '反直覺爆點' ? 'selected' : ''}>💥 反直覺爆點 (打破認知)</option>
                        <option value="利益誘惑" ${MISSION.hookType === '利益誘惑' ? 'selected' : ''}>🎁 利益誘惑 (直接給好處)</option>
                        <option value="溫情故事" ${MISSION.hookType === '溫情故事' ? 'selected' : ''}>📖 溫情故事 (感性訴求)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 mb-2">📏 文案長度節奏</label>
                    <select id="selLength" class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer shadow-lg">
                        <option value="短平快 (約150字)" ${MISSION.contentLength === '短平快 (約150字)' ? 'selected' : ''}>⚡ 短平快 (適合 IG/Threads)</option>
                        <option value="深度文 (約300字)" ${MISSION.contentLength === '深度文 (約300字)' ? 'selected' : ''}>📖 深度文 (適合 FB/Blog)</option>
                    </select>
                </div>
            </div>
            <div class="flex justify-end mt-6">
                <button id="btnConfirmHook" class="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all w-full sm:w-auto">🧠 鎖定戰術，進入宇宙設定</button>
            </div>
        </div>
    `;
    
    const ui = createSkillUI(strategyPanelHTML);
    
    ui.querySelector('#btnConfirmHook').onclick = async () => { 
        MISSION.hookType = ui.querySelector('#selHookType').value; 
        MISSION.contentLength = ui.querySelector('#selLength').value; 
        
        releaseUI(ui); 
        await addLog("社群總監", "✅", `戰術配置：${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]}`); 
        
        // 🚀 修正：斷橋接回！將原本的 triggerMissionSummary() 改成 triggerUniverseSkill()
        if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } 
        else { await triggerUniverseSkill(); }
    };
}

export async function triggerUniverseSkill() { 
    updateStepHeader("UNIVERSE SELECTION"); await addLog("美術總監", "🌌", "請選擇視覺宇宙：", true);
    const ui = createSkillUI(`<div class="grid grid-cols-1 sm:grid-cols-3 gap-3"><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-blue-500 hover:bg-blue-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'REALISTIC' ? 'border-blue-500 bg-blue-600/20' : 'bg-slate-800'}" data-val="REALISTIC"><span class="text-3xl">📷</span><span class="font-black text-xs text-white">真實攝影</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-pink-500 hover:bg-pink-600/20 active:scale-95 flex flex-col items-center gap-2 ${MISSION.universe === 'COMIC' ? 'border-pink-500 bg-pink-600/20' : 'bg-slate-800'}" data-val="COMIC"><span class="text-3xl">🎨</span><span class="font-black text-xs text-white">2D 動漫</span></button><button class="uni-btn p-4 rounded-2xl border border-white/10 hover:border-yellow-500 hover:bg-yellow-600/20 active:scale-95 transition-all flex flex-col items-center gap-2 ${MISSION.universe === 'ENHANCE' ? 'border-yellow-500 bg-yellow-600/20' : 'bg-slate-800'}" data-val="ENHANCE"><span class="text-3xl">✨</span><span class="font-black text-xs text-white">無損美化</span></button></div>`);
    ui.querySelectorAll('.uni-btn').forEach(btn => { btn.onclick = async () => { const oldUni = MISSION.universe; MISSION.universe = btn.dataset.val; if (oldUni !== MISSION.universe) { MISSION.style = ''; MISSION.colorMode = ''; MISSION.characters = []; MISSION.sceneFiles = []; MISSION.ratio = MISSION.universe === 'ENHANCE' ? '原圖比例' : '9:16'; } releaseUI(ui); await addLog("美術總監", "✅", `宇宙鎖定：${MISSION.universe}。`); await triggerStyleSkill(); }; });
}

export async function triggerStyleSkill() { 
    updateStepHeader("STYLE SELECTION"); const availableStyles = SYSTEM_DB.styles.length > 0 ? SYSTEM_DB.styles : [{id: 'MANGA_BW', name: '預設風格'}];
    let html = `<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">`; availableStyles.forEach(s => { html += `<button class="style-btn p-4 rounded-xl border border-white/10 hover:border-blue-400 hover:bg-slate-700 active:scale-95 text-left bg-slate-800 flex flex-col gap-1 ${MISSION.style === s.name ? 'border-blue-500 bg-slate-700' : ''}" data-val="${s.name}"><span class="text-xl">${s.icon || '🎨'}</span><span class="font-bold text-xs text-white">${s.name}</span></button>`; }); html += `</div>`;
    const ui = createSkillUI(html); ui.querySelectorAll('.style-btn').forEach(btn => { btn.onclick = async () => { MISSION.style = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `風格鎖定：${MISSION.style}。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerColorSkill(); } }; });
}

export async function triggerColorSkill() { 
    updateStepHeader("COLOR MODE"); await addLog("美術總監", "🎨", "請決定漫畫色系：", true);
    const ui = createSkillUI(`<div class="grid grid-cols-2 gap-3 mb-4"><button class="color-btn p-4 rounded-xl border border-white/10 hover:border-slate-400 hover:bg-white/5 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'BW' ? 'border-blue-500 bg-white/5' : ''}" data-val="BW"><span class="text-3xl mb-1">🏁</span><span class="font-bold text-xs text-white">經典黑白</span><span class="text-[9px] text-slate-400">懷舊網點質感</span></button><button class="color-btn p-4 rounded-xl border border-white/10 hover:border-pink-400 hover:bg-pink-600/10 active:scale-95 transition-all text-left bg-slate-800 flex flex-col gap-1 ${MISSION.colorMode === 'Color' ? 'border-pink-500 bg-pink-600/10' : ''}" data-val="Color"><span class="text-3xl mb-1">🌈</span><span class="font-bold text-xs text-white">現代全彩</span><span class="text-[9px] text-slate-400">飽滿現代動漫感</span></button></div>`);
    ui.querySelectorAll('.color-btn').forEach(btn => { btn.onclick = async () => { MISSION.colorMode = btn.dataset.val; releaseUI(ui); await addLog("美術總監", "✅", `色系已鎖定：<b>${MISSION.colorMode === 'BW' ? "黑白漫畫" : "全彩動漫"}</b>。`); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else if (MISSION.universe === 'ENHANCE') { await triggerVisualSkill(); } else { await triggerCharacterSkill(); } }; });
}

export async function triggerCharacterSkill() { 
    updateStepHeader("CHARACTER SUMMON"); await addLog("視覺工程師", "🧬", `請勾選要在本次任務中登場的角色 (最多4位)：`, true);
    const available = SYSTEM_DB.characters.filter(c => c.type === MISSION.universe);
    if(available.length === 0) { const ui = createSkillUI(`<div class="text-center p-4"><p class="text-slate-400 text-xs mb-4">您的基因庫目前沒有角色，將採用純場景模式。</p><button id="btnSkipChar" class="w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-bold active:scale-95 shadow-lg">⏭️ 確認並繼續</button></div>`); ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } }; return; }
    let html = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">`; let tempSelected = [...MISSION.characters];
    available.forEach(char => { const isSelected = tempSelected.includes(char.name); html += `<div class="char-select-card flex flex-col items-center gap-2 cursor-pointer transition-all p-3 rounded-xl bg-slate-800 relative ${isSelected ? 'border-2 border-blue-500 bg-blue-900/30' : 'border border-white/10 hover:border-slate-500'}" data-name="${char.name}"><div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-700 pointer-events-none"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-xs font-bold text-slate-200 pointer-events-none">${char.name}</span>${isSelected ? '<div class="absolute top-2 right-2 text-blue-400 font-black">✓</div>' : ''}</div>`; });
    html += `</div><div class="flex gap-2"><button id="btnSkipChar" class="flex-1 bg-slate-800 text-slate-300 py-3 rounded-xl text-xs font-bold active:scale-95 transition-all border border-white/10 hover:bg-slate-700">⏭️ 不召喚</button><button id="btnConfirmChar" class="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">✅ 確認召喚</button></div>`;
    const ui = createSkillUI(html);
    ui.querySelectorAll('.char-select-card').forEach(card => { card.onclick = () => { const name = card.dataset.name; if (tempSelected.includes(name)) { tempSelected = tempSelected.filter(n => n !== name); card.classList.remove('border-2', 'border-blue-500', 'bg-blue-900/30'); card.classList.add('border', 'border-white/10'); const check = card.querySelector('.absolute'); if(check) check.remove(); } else { if (tempSelected.length >= 4) return showError('最多 4 位。'); tempSelected.push(name); card.classList.remove('border', 'border-white/10'); card.classList.add('border-2', 'border-blue-500', 'bg-blue-900/30'); card.innerHTML += '<div class="absolute top-2 right-2 text-blue-400 font-black">✓</div>'; } }; });
    ui.querySelector('#btnSkipChar').onclick = async () => { MISSION.characters = []; releaseUI(ui); await addLog("視覺工程師", "✅", "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
    ui.querySelector('#btnConfirmChar').onclick = async () => { MISSION.characters = tempSelected; releaseUI(ui); await addLog("視覺工程師", "✅", MISSION.characters.length > 0 ? `已鎖定角色：<b>${MISSION.characters.join('、')}</b>。` : "純場景模式。"); if (IS_EDIT_MODE.value && isMissionComplete()) { await triggerMissionSummary(); } else { await triggerVisualSkill(); } };
}

export async function triggerVisualSkill() { 
    updateStepHeader("VISUAL CONFIG"); const isEnhance = MISSION.universe === 'ENHANCE'; const isComic = MISSION.universe === 'COMIC';
    await addLog("美術總監", "👨‍🎨", isEnhance ? "美化模式：請上傳原圖。" : "請確認畫面參數：", true);
    let currentRatio = MISSION.ratio; let currentRes = MISSION.resolution; let currentPanelCount = MISSION.panelCount || 4;
    const panelHtml = isComic ? `<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">🖼️ 漫畫格數</label><div class="grid grid-cols-4 gap-2"><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1">1格</button><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2">2格</button><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="3">3格</button><button class="panel-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4">4格</button></div></div>` : '';
    const ui = createSkillUI(`<div class="space-y-4 lg:space-y-6 flex flex-col relative mb-4"><div class="bg-blue-600/10 p-4 lg:p-5 rounded-2xl border border-blue-500/30"><div class="grid grid-cols-2 gap-3"><button ${isEnhance ? 'disabled' : `id="btnEditRatio"`} class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95 ${isEnhance ? 'opacity-50' : ''}"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white tag-ratio">${currentRatio}</span></button><button id="btnEditRes" class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 active:scale-95"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white tag-res">${currentRes}</span></button></div></div><div id="customPanel" class="hidden space-y-4 bg-slate-900/80 p-5 rounded-2xl border border-white/10 animate-fade-in">${isEnhance ? '' : `<div class="space-y-3"><label class="text-[10px] text-slate-500 font-black">📐 比例</label><div class="grid grid-cols-3 gap-2"><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="9:16">9:16</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="16:9">16:9</button><button class="ratio-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1:1">1:1</button></div></div>`}<div class="space-y-3 pt-4 border-t border-white/10"><label class="text-[10px] text-slate-500 font-black">✨ 解析度</label><div class="grid grid-cols-3 gap-2"><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="1K">1K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="2K">2K</button><button class="res-btn py-3 bg-slate-800 rounded-xl text-xs font-bold active:scale-95" data-val="4K">4K</button></div></div>${panelHtml}</div><button id="btnUploadScene" class="w-full bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 hover:border-slate-500 active:scale-95 transition-all"><span class="text-lg">📸</span> 點此上傳場景圖 (選填)</button><div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div><button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 lg:py-5 rounded-xl font-black text-sm shadow-lg mt-auto active:scale-[0.98]">✅ 鎖定參數</button></div>`);
    const openPanel = () => { ui.querySelector('#customPanel').classList.remove('hidden'); ui.querySelector('#customPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    if(ui.querySelector('#btnEditRatio')) ui.querySelector('#btnEditRatio').onclick = openPanel;
    if(ui.querySelector('#btnEditRes')) ui.querySelector('#btnEditRes').onclick = openPanel;
    if (!isEnhance) { ui.querySelectorAll('.ratio-btn').forEach(btn => { if(btn.dataset.val === currentRatio) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRatio = btn.dataset.val; ui.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-ratio').innerText = currentRatio; }; }); }
    ui.querySelectorAll('.res-btn').forEach(btn => { if(btn.dataset.val === currentRes) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentRes = btn.dataset.val; ui.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); ui.querySelector('.tag-res').innerText = currentRes; }; });
    if (isComic) { ui.querySelectorAll('.panel-btn').forEach(btn => { if(parseInt(btn.dataset.val) === currentPanelCount) btn.classList.add('bg-blue-600'); btn.onclick = () => { currentPanelCount = parseInt(btn.dataset.val); ui.querySelectorAll('.panel-btn').forEach(b => b.classList.remove('bg-blue-600')); btn.classList.add('bg-blue-600'); }; }); }
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.onchange = async (e) => { if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea')); }; i.click(); };
    ui.querySelector('#btnAcceptVisual').onclick = async () => { MISSION.ratio = currentRatio; MISSION.resolution = currentRes; MISSION.panelCount = currentPanelCount; if (!isMissionComplete()) return showError('請完成設定！'); releaseUI(ui); await addLog("美術總監", "✅", `畫面參數鎖定：<b>${MISSION.ratio} / ${isComic ? currentPanelCount+'格' : ''}</b>。`); await triggerScheduleSkill(); };
}

export async function handleAssetUpload(file, container) { 
    if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); 
    const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in'; 
    const dataUrl = await compressImage(file, 800); MISSION.sceneFiles = [{ dataUrl: dataUrl }]; 
    panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 參考素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `已優化並載入圖資。`); 
}

export async function triggerScheduleSkill() { 
    updateStepHeader("PUBLISH SCHEDULE"); await addLog("社群總監", "📅", "最後一步，請指派部署時間（留空為立即發佈）：", true);
    const ui = createSkillUI(`<div class="flex flex-col gap-3 mb-4"><div class="grid grid-cols-2 gap-3 relative"><input type="text" id="datePicker" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="📅 選擇日期 (選填)"><div class="relative w-full" id="timePickerWrapper"><input type="time" id="timePickerInput" class="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="⏰ 選擇時間 (選填)"></div></div><button id="btnConfirmSchedule" class="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">確認時間</button></div>`);
    const fpConfig = { dateFormat: "Y-m-d", minDate: "today", time_24hr: true, defaultDate: MISSION.scheduledAt ? new Date(MISSION.scheduledAt) : null };
    if (typeof flatpickr !== 'undefined' && flatpickr.l10ns && flatpickr.l10ns.zh) { fpConfig.locale = "zh"; }
    const fp = typeof flatpickr !== 'undefined' ? flatpickr("#datePicker", fpConfig) : null;
    const timeWrapper = ui.querySelector('#timePickerWrapper');
    timeWrapper.innerHTML += `<button id="btnClearTime" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors z-10">清除</button>`;
    ui.querySelector('#btnClearTime').onclick = (e) => { e.preventDefault(); ui.querySelector('#timePickerInput').value = ""; if(fp) fp.clear(); ui.querySelector('#datePicker').value = ""; };
    ui.querySelector('#btnConfirmSchedule').onclick = async () => {
        const dateStr = fp ? fp.input.value : ui.querySelector('#datePicker').value; const timeStr = ui.querySelector('#timePickerInput').value; if(fp) fp.destroy(); 
        if (dateStr && timeStr) { const dtStr = `${dateStr}T${timeStr}:00+08:00`; const schDate = new Date(dtStr); if (schDate < new Date()) { showError("部署時間不能小於當前時間！"); await triggerScheduleSkill(); return; } MISSION.scheduledAt = schDate.toISOString(); releaseUI(ui); const displaySch = schDate.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); await addLog("社群總監", "✅", `部署時間已寫入排程：<b>${displaySch}</b>。`); } 
        else { MISSION.scheduledAt = null; releaseUI(ui); await addLog("社群總監", "⚡", `已選擇<b>「立即部署」</b>模式。`); }
        await triggerMissionSummary();
    };
}
