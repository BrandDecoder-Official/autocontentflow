// js/agent_v9_core.js
import { STATE } from './config.js';
import * as API from './api.js'; 

const APP_VERSION = "V0.27 完美封裝版";
const MISSION = { persona: '', platforms: [], topic: '', universe: '', style: '', ratio: '9:16', resolution: '1K', characters: [], sceneFiles: [], scheduleMode: 'NOW', scheduleDate: '', scheduleTime: '' };
let IS_EDIT_MODE = false;

export const SYSTEM_DB = {
    styles: [], characters: [],
    personas: [
        { id: 'HUMOR', name: '幽默酸民', icon: '🤡', desc: '時事嘲諷、網路迷因語氣' },
        { id: 'PRO', name: '專業權威', icon: '💼', desc: '數據導向、菁英分析觀點' },
        { id: 'WARM', name: '溫暖知性', icon: '☕', desc: '心靈雞湯、柔和共鳴語氣' }
    ]
};

// 啟動資料同步
export async function bootSystemData() {
    try {
        const result = await API.fetchSystemOptionsAPI(STATE.uid);
        if(result.success && result.data) {
            SYSTEM_DB.styles = result.data.styles || [];
            SYSTEM_DB.characters = result.data.characters || [];
            document.getElementById('charCountLabel').innerText = `已擁有 ${SYSTEM_DB.characters.length} 組角色模型`;
        }
    } catch(e) { console.error("同步資料失敗", e); }
}

function isMissionComplete() {
    if (!MISSION.persona || MISSION.platforms.length === 0 || !MISSION.topic || !MISSION.universe || !MISSION.style) return false;
    return !(MISSION.universe === 'ENHANCE' && MISSION.sceneFiles.length === 0);
}

// 🌟 V0.27: 智慧過濾角色
async function triggerCharacterPicker(container) {
    const existing = container.querySelector('.char-picker-panel'); if (existing) existing.remove();
    // 關鍵：根據目前選的 universe (REALISTIC / COMIC) 進行過濾
    const available = SYSTEM_DB.characters.filter(c => c.type === MISSION.universe);
    
    if(available.length === 0) return showError(`您的基因庫目前沒有 ${MISSION.universe === 'COMIC' ? '動漫' : '真人'} 角色！`);

    const panel = document.createElement('div'); panel.className = 'char-picker-panel bg-slate-900/30 rounded-xl border border-white/5 p-3 animate-fade-in';
    panel.innerHTML = `<div class="flex justify-between items-center mb-3"><span class="text-[10px] text-blue-400 font-bold uppercase">🧬 適合此宇宙的分身 (Max 4)</span><button id="btnConfirmBatch" class="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black active:scale-95">✅ 確認</button></div><div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar items-center" id="charGrid"></div>`;

    const grid = panel.querySelector('#charGrid'); let tempSelected = [...MISSION.characters];
    available.forEach(char => {
        const isSelected = tempSelected.includes(char.name);
        const card = document.createElement('div'); card.className = `flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer transition-all p-1 rounded-xl ${isSelected ? 'char-card-selected' : ''}`;
        card.innerHTML = `<div class="w-12 h-12 rounded-full border border-slate-700 overflow-hidden bg-slate-800"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><span class="text-[9px] font-bold text-slate-400">${char.name}</span>`;
        card.onclick = () => {
            if (tempSelected.includes(char.name)) { tempSelected = tempSelected.filter(n => n !== char.name); card.classList.remove('char-card-selected'); } 
            else { if (tempSelected.length >= 4) return showError('算力限制：單次最多 4 位。'); tempSelected.push(char.name); card.classList.add('char-card-selected'); }
        };
        grid.appendChild(card);
    });

    panel.querySelector('#btnConfirmBatch').onclick = async () => { MISSION.characters = tempSelected; const names = MISSION.characters.join('、'); await addLog("視覺工程師", "🧬", MISSION.characters.length > 0 ? `召喚確認：<b>${names}</b>。` : "已清空召喚名單。"); panel.remove(); };
    container.appendChild(panel);
}

// 漏斗主邏輯 (略，與上一版同)
export async function initAgentFunnel() { updateStepHeader("COMMAND LOBBY"); renderLobby(); }
function renderLobby() { /* ... 同 V0.26 ... */ }
async function triggerPersonaSkill() { /* ... 同 V0.26 ... */ }
async function triggerPlatformSkill() { /* ... 同 V0.26 ... */ }
async function triggerTopicSkill() { /* ... 同 V0.26 ... */ }
async function triggerUniverseSkill() { /* ... 同 V0.26 ... */ }
async function triggerStyleSkill() { /* ... 同 V0.26 ... */ }
async function triggerVisualSkill() {
    updateStepHeader("VISUAL CONFIG"); await addLog("美術總監", "👨‍🎨", "請確認參數。可自由從您的雲端基因庫召喚角色：", true);
    let currentRatio = MISSION.ratio; let currentRes = MISSION.resolution;
    const ui = createSkillUI(`
        <div class="space-y-4 lg:space-y-6 flex flex-col relative">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30">
                <div class="grid grid-cols-2 gap-3"><button class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 opacity-50 cursor-not-allowed"><span class="text-[10px] text-slate-400 font-bold">⛭ 比例</span><span class="text-lg font-black text-white">${currentRatio}</span></button><button class="flex flex-col items-center justify-center bg-slate-800 p-3 rounded-xl border border-white/10 opacity-50 cursor-not-allowed"><span class="text-[10px] text-slate-400 font-bold">⛭ 解析度</span><span class="text-lg font-black text-white">${currentRes}</span></button></div>
            </div>
            <div class="grid grid-cols-2 gap-2"><button id="btnSummonChar" class="bg-indigo-600/20 py-4 rounded-xl text-xs font-black border border-indigo-500/50 active:scale-95"><span class="text-lg">🧬</span> 召喚專屬角色</button><button id="btnUploadScene" class="bg-slate-800 py-4 rounded-xl text-xs font-black border border-white/10 active:scale-95"><span class="text-lg">📸</span> 場景/道具參考圖</button></div>
            <div id="dynamicAssetsArea" class="space-y-3 empty:hidden w-full"></div>
            <button id="btnAcceptVisual" class="w-full bg-blue-600 py-4 rounded-xl font-black text-sm shadow-lg mt-auto active:scale-[0.98]">✅ 鎖定參數</button>
        </div>
    `);
    ui.querySelector('#btnSummonChar').onclick = () => triggerCharacterPicker(ui.querySelector('#dynamicAssetsArea'));
    ui.querySelector('#btnUploadScene').onclick = () => { let i = document.createElement('input'); i.type='file'; i.onchange=async(e)=>{if(e.target.files[0]) await handleAssetUpload(e.target.files[0], ui.querySelector('#dynamicAssetsArea'))}; i.click(); };
    ui.querySelector('#btnAcceptVisual').onclick = async () => { if (!isMissionComplete()) return showError('請完成設定！'); releaseUI(ui); await triggerMissionSummary(); };
}

// 輔助：DataURL 轉 Base64 純字串 (給 API 用)
function getPureBase64(dataUrl) { return dataUrl.replace(/^data:image\/\w+;base64,/, ""); }

async function triggerMissionSummary() {
    IS_EDIT_MODE = false; updateStepHeader("FINAL CONFIRMATION");
    await addLog("專案總監", "👨‍💼", "請確認清單。即將發送至雲端進行劇本創作：", true);

    const basePts = 15; const totalPts = basePts + MISSION.characters.length;
    let assetsHtml = '<div class="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[150px] justify-end">';
    MISSION.characters.forEach(c => { const o = SYSTEM_DB.characters.find(mc => mc.name === c); if(o) assetsHtml += `<img src="${o.imageUrl}" class="w-6 h-6 rounded-full border border-slate-500 flex-shrink-0">`; });
    if (MISSION.sceneFiles.length > 0) assetsHtml += `<img src="${MISSION.sceneFiles[0].dataUrl}" class="w-6 h-6 rounded border border-slate-500 object-cover flex-shrink-0">`;
    assetsHtml += '</div>';

    const ui = createSkillUI(`
        <div class="bg-slate-900 border border-blue-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
            <div class="flex justify-between items-center border-b border-white/10 pb-3"><span class="text-xs font-black text-blue-400">MISSION BRIEF</span><span class="text-[10px] text-slate-500">${APP_VERSION}</span></div>
            <div class="space-y-3 text-[11px]">
                <div class="flex justify-between"><span>🎭 人設</span><span class="text-white">${MISSION.persona}</span></div>
                <div class="flex justify-between"><span>🚀 平台</span><span class="text-white">${MISSION.platforms.join(', ')}</span></div>
                <div class="flex justify-between"><span>📝 主題</span><span class="text-white truncate max-w-[150px]">${MISSION.topic}</span></div>
                <div class="flex justify-between"><span>🌌 宇宙</span><span class="text-white">${MISSION.universe} / ${MISSION.style}</span></div>
                <div class="flex justify-between"><span>👥 角色素材</span><div>${assetsHtml}</div></div>
            </div>
            <button id="btnRender" class="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all">⚡ 扣除 ${totalPts} 點發送指令</button>
        </div>
    `);

    ui.querySelector('#btnRender').onclick = async () => {
        releaseUI(ui);
        await addLog("首席文案", "⏳", `<div class="flex items-center gap-2"><div class="spinner"></div><span>正在為您產出腳本，請稍候...</span></div>`, true);

        // 🌟 V0.27: 完美封裝 Payload
        const referenceImages = [];
        
        // 1. 角色圖打包 (附帶 type: character 與名字)
        MISSION.characters.forEach(name => {
            const charData = SYSTEM_DB.characters.find(c => c.name === name);
            if(charData) {
                referenceImages.push({ type: 'character', name: name, imageUrl: charData.imageUrl }); // 如果後端吃 URL
                // 如果後端需要 Data，這裡可以先 fetch 轉 Base64，但因為我們後端寫過 fetchImageUrlToBase64，所以傳 URL 最快！
            }
        });

        // 2. 場景圖打包 (type: scene)
        MISSION.sceneFiles.forEach(sf => {
            referenceImages.push({ type: 'scene', data: sf.dataUrl });
        });

        const payload = {
            tenantId: STATE.uid,
            topic: MISSION.topic,
            isComicMode: MISSION.universe === 'COMIC',
            style: MISSION.style,
            platforms: MISSION.platforms,
            persona: MISSION.persona,
            // 角色陣列包含 persona
            characters: MISSION.characters.map(name => {
                const c = SYSTEM_DB.characters.find(x => x.name === name);
                return { name: name, persona: c ? c.persona : "" };
            }),
            image_options: { referenceImages: referenceImages }
        };

        try {
            const result = await API.createDraftAPI(payload);
            if (result.success) {
                // 扣點與顯示
                STATE.userPoints -= totalPts;
                document.getElementById('userPoints').innerText = STATE.userPoints.toLocaleString();
                await addLog("首席文案", "✅", "劇本建立成功！已進入校稿階段。", true);
                // 🌟 V0.27：觸發校稿編輯卡片
                await renderDraftEditorCard(result.taskId, result.draftContent, result.isComicMode);
            } else throw new Error(result.message);
        } catch (e) { showError(`發送失敗：${e.message}`); }
    };
}

// 🌟 V0.27: 校稿總編室 UI
async function renderDraftEditorCard(taskId, draftContent, isComic) {
    let panelsHtml = '';
    if (isComic && draftContent.panels) {
        draftContent.panels.forEach((p, idx) => {
            panelsHtml += `
                <div class="bg-slate-800/50 p-3 rounded-xl border border-white/5 space-y-2">
                    <div class="flex justify-between items-center"><span class="text-[9px] font-black text-indigo-400"># PANEL ${p.panel_number}</span></div>
                    <p class="text-[10px] text-slate-400 leading-tight italic">${p.action_zh}</p>
                    <input type="text" class="panel-dialogue w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white" value="${p.dialogue}" data-idx="${idx}">
                </div>
            `;
        });
    }

    const ui = createSkillUI(`
        <div class="space-y-4">
            <div class="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 space-y-3">
                <h3 class="text-xs font-black text-blue-400 uppercase tracking-widest">📝 貼文校稿總編室</h3>
                <div class="space-y-1">
                    <label class="text-[9px] text-slate-500 font-bold">社群內文 (Caption)</label>
                    <textarea id="editCaption" class="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-slate-200 min-h-[100px] focus:border-blue-500 focus:outline-none">${draftContent.post_caption}</textarea>
                </div>
                <div class="space-y-2">${panelsHtml}</div>
            </div>
            <button id="btnFinalGenerate" class="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-black text-sm shadow-xl active:scale-95 transition-all">✨ 確認劇本，發包生圖</button>
        </div>
    `);

    ui.querySelector('#btnFinalGenerate').onclick = async () => {
        const editedCaption = ui.querySelector('#editCaption').value;
        const editedPanels = [];
        ui.querySelectorAll('.panel-dialogue').forEach(input => {
            const idx = input.dataset.idx;
            editedPanels.push({ panel_number: draftContent.panels[idx].panel_number, dialogue: input.value });
        });

        releaseUI(ui);
        await addLog("視覺工程師", "🎨", `<div class="flex items-center gap-2"><div class="spinner"></div><span>正在進行 AI 影像合成，預計需要 20-30 秒...</span></div>`, true);
        
        // 🔜 下一版 V0.28 將對接 generateImageFromDraft
        console.log("🚀 發包生圖 Payload:", { taskId, tenantId: STATE.uid, editedCaption, editedPanels });
        setTimeout(() => { addLog("系統", "🚧", "生圖 API 介接中，敬請期待 V0.28！"); }, 2000);
    };
}

// 🧬 角色管理邏輯 (新增分類支援)
window.submitNewChar = async function() {
    const name = document.getElementById('newCharName').value.trim();
    const type = document.getElementById('newCharType').value;
    const persona = document.getElementById('newCharPersona').value.trim();
    if(!name || !tempCharBase64) return alert('請提供照片與角色名稱！');
    const btn = document.getElementById('btnSubmitNewChar'); btn.innerHTML = '<div class="spinner"></div> 基因萃取中...'; btn.disabled = true;
    try {
        // 🌟 這裡將 type 送往 API (您的後端會存入 Firestore)
        const res = await API.createCharacterAPI({ tenantId: STATE.uid, name, type, persona, imageBase64: tempCharBase64 });
        if(res.success) { await bootSystemData(); window.cancelNewChar(); renderCharGrid(); } else throw new Error(res.message);
    } catch(e) { alert(`❌ 失敗: ${e.message}`); } finally { btn.innerHTML = '上傳並萃取基因'; btn.disabled = false; }
};

// 📜 歷史軌跡修正 (防呆版)
window.refreshAuditLogs = async function() {
    const container = document.getElementById('auditLogsContainer');
    container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4"><div class="spinner inline-block align-middle mr-2"></div> 讀取中...</div>';
    try {
        const res = await API.fetchAuditLogsAPI(STATE.uid);
        if(res.success && res.logs.length > 0) {
            container.innerHTML = '';
            res.logs.forEach(log => {
                // 🌟 V0.27 關鍵修正：加上 (log.actionType || '') 防止 includes 報錯
                const action = (log.actionType || 'SYSTEM_LOG');
                const isDeduct = action.includes('GENERATE') || action.includes('PUBLISH');
                const ptClass = isDeduct ? 'text-red-400' : 'text-green-400';
                const sign = isDeduct ? '-' : '+';
                const pts = log.pointsDeducted || Math.abs(log.pointsChanged || 0);
                container.innerHTML += `<div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg text-[11px] mb-2"><div><p class="text-white font-bold">${action}</p><p class="text-slate-500">${new Date(log.createdAt).toLocaleString()}</p></div><span class="${ptClass} font-bold">${sign} ${pts} PTS</span></div>`;
            });
        } else { container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4">目前尚無紀錄。</div>'; }
    } catch(e) { container.innerHTML = `<div class="text-center text-xs text-red-400 py-4">讀取失敗 (髒資料已跳過)</div>`; }
};

// 其他工具函數保持不變...
function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }
function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }
function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }
function createSkillUI(html) { const log = document.getElementById('funnelLog'); const oldActive = document.getElementById('activeControlCard'); if (oldActive) { oldActive.removeAttribute('id'); oldActive.querySelectorAll('button').forEach(b => b.disabled = true); const inputs = oldActive.querySelectorAll('input, textarea'); if(inputs) inputs.forEach(i => i.disabled = true); } const div = document.createElement('div'); div.className = 'skill-card ml-8 lg:ml-12 bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6'; div.id = 'activeControlCard'; div.innerHTML = html; log.appendChild(div); scrollDown(); return div; }
function releaseUI(ui) { lockUI(ui); ui.removeAttribute('id'); ui.querySelectorAll('button').forEach(b => b.disabled = true); const inputs = ui.querySelectorAll('input, textarea'); if(inputs) inputs.forEach(i => i.disabled = true); }
async function handleAssetUpload(file, container) { if(!file) return; const existing = container.querySelector('.scene-picker-panel'); if (existing) existing.remove(); const panel = document.createElement('div'); panel.className = 'scene-picker-panel flex flex-col gap-2 p-3 bg-slate-900/30 rounded-xl border border-white/5 animate-fade-in'; const dataUrl = await readFileAsDataURL(file); MISSION.sceneFiles = [{ file: file, dataUrl: dataUrl }]; panel.innerHTML = `<div class="text-[10px] text-blue-400 font-bold uppercase">📸 參考素材</div><div class="w-16 h-16 rounded-md overflow-hidden border border-white/20"><img src="${dataUrl}" class="w-full h-full object-cover"></div>`; container.appendChild(panel); await addLog("影像處理組", "📐", `載入圖資：<img src="${dataUrl}" class="w-8 h-8 rounded border border-slate-600 inline-block align-middle mx-1 object-cover">`); }
async function addLog(role, icon, msg, skipTyping = false) { const log = document.getElementById('funnelLog'); const div = document.createElement('div'); div.className = 'flex items-start gap-3 lg:gap-4 animate-fade-in mb-4'; div.innerHTML = `<div class="text-2xl">${icon}</div><div class="bg-slate-800/80 p-3 lg:p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[90%] lg:max-w-[85%] shadow-md"><div class="text-[9px] font-black text-slate-500 mb-1 uppercase">${role}</div><div class="msg-content text-xs lg:text-sm leading-relaxed">${skipTyping ? msg : '<span class="animate-pulse">...</span>'}</div></div>`; const activeCard = document.getElementById('activeControlCard'); if (activeCard) { log.insertBefore(div, activeCard); } else { log.appendChild(div); } scrollDown(); if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; } }
