// js/v9_sidebar.js
import { STATE } from './config.js';
import * as API from './api.js';
import { SYSTEM_DB, compressImage, bootSystemData } from './v9_state.js';

let tempCharBase64 = null;

// ==========================================
// 🧬 側邊欄全域管理與頁籤切換
// ==========================================
window.openCharManager = function() { 
    const modal = document.getElementById('charManageModal'); 
    modal.classList.remove('hidden'); 
    setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10); 
    renderCharGrid(); 
    renderPersonaList(); // 開啟時一併渲染人設清單
};

window.closeCharManager = function() { 
    const modal = document.getElementById('charManageModal'); 
    modal.classList.remove('show'); 
    setTimeout(() => { modal.classList.add('hidden'); }, 300); 
    window.cancelNewChar(); 
    window.cancelNewPersona();
};

window.switchVaultTab = function(tabName) {
    const tabVisual = document.getElementById('tabVisual');
    const tabText = document.getElementById('tabText');
    const contentVisual = document.getElementById('vaultVisualContent');
    const contentText = document.getElementById('vaultTextContent');

    if (tabName === 'VISUAL') {
        tabVisual.className = "flex-1 py-3 text-sm font-black border-b-2 transition-all text-blue-400 border-blue-500 bg-slate-800/50";
        tabText.className = "flex-1 py-3 text-sm font-black border-b-2 transition-all text-slate-500 border-transparent hover:bg-slate-800/30";
        contentVisual.classList.remove('hidden');
        contentVisual.classList.add('block');
        contentText.classList.remove('block');
        contentText.classList.add('hidden');
    } else {
        tabText.className = "flex-1 py-3 text-sm font-black border-b-2 transition-all text-pink-400 border-pink-500 bg-slate-800/50";
        tabVisual.className = "flex-1 py-3 text-sm font-black border-b-2 transition-all text-slate-500 border-transparent hover:bg-slate-800/30";
        contentText.classList.remove('hidden');
        contentText.classList.add('block');
        contentVisual.classList.remove('block');
        contentVisual.classList.add('hidden');
    }
};


// ==========================================
// 🖼️ 視覺角色 (Characters) 邏輯
// ==========================================
function renderCharGrid() { 
    const grid = document.getElementById('charGridContainer'); 
    grid.innerHTML = ''; 
    if(SYSTEM_DB.characters.length === 0) { 
        grid.innerHTML = `<div class="col-span-full text-center text-sm text-slate-500 py-10">尚無角色，請立即註冊！</div>`; return; 
    } 
    SYSTEM_DB.characters.forEach(char => { 
        grid.innerHTML += `<div class="bg-slate-800 rounded-xl border border-white/10 p-3 flex flex-col items-center gap-2 relative group"><div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600"><img src="${char.imageUrl}" class="w-full h-full object-cover"></div><div class="text-center w-full"><p class="text-xs font-bold text-white truncate">${char.name}</p><p class="text-[9px] text-slate-400 truncate w-full" title="${char.aiExtractedFeatures}">${char.aiExtractedFeatures || '特徵分析中...'}</p></div><button onclick="window.deleteChar('${char.id}')" class="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button></div>`; 
    }); 
}

window.openNewCharForm = function() { 
    document.getElementById('newCharForm').classList.remove('hidden'); 
    document.getElementById('btnAddNewCharContainer').classList.add('hidden'); 
};

window.cancelNewChar = function() { 
    document.getElementById('newCharForm').classList.add('hidden'); 
    document.getElementById('btnAddNewCharContainer').classList.remove('hidden'); 
    document.getElementById('charPreviewEmpty').classList.remove('hidden'); 
    document.getElementById('charPreviewImg').classList.add('hidden'); 
    document.getElementById('newCharName').value = ''; 
    document.getElementById('newCharPersona').value = ''; 
    tempCharBase64 = null; 
};

window.handleCharPhotoSelect = async function(e) { 
    const file = e.target.files[0]; if(!file) return; 
    tempCharBase64 = await compressImage(file, 600); 
    document.getElementById('charPreviewEmpty').classList.add('hidden'); 
    const img = document.getElementById('charPreviewImg'); 
    img.src = tempCharBase64; img.classList.remove('hidden'); 
};

window.submitNewChar = async function() { 
    const name = document.getElementById('newCharName').value.trim(); 
    const type = document.getElementById('newCharType').value; 
    const persona = document.getElementById('newCharPersona').value.trim(); 
    if(!name || !tempCharBase64) return alert('請提供照片與名稱！'); 
    const btn = document.getElementById('btnSubmitNewChar'); 
    btn.innerHTML = '<div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></div> 萃取中...'; 
    btn.disabled = true; 
    try { 
        const res = await API.createCharacterAPI({ tenantId: STATE.uid, name, type, persona, imageBase64: tempCharBase64, mimeType: 'image/jpeg' }); 
        if(res.success) { alert('🎉 註冊成功！'); await bootSystemData(); window.cancelNewChar(); renderCharGrid(); } 
        else throw new Error(res.message); 
    } catch(e) { alert(`❌ 失敗: ${e.message}`); } 
    finally { btn.innerHTML = '上傳並萃取'; btn.disabled = false; } 
};

window.deleteChar = async function(charId) { 
    if(!confirm('確定要刪除嗎？')) return; 
    try { 
        const res = await API.deleteCharacterAPI({ charId, tenantId: STATE.uid }); 
        if(res.success) { await bootSystemData(); renderCharGrid(); } 
        else throw new Error(res.message); 
    } catch(e) { alert(`❌ 刪除失敗: ${e.message}`); } 
};


// ==========================================
// ✍️ 品牌人設 (Personas) 邏輯
// ==========================================
function renderPersonaList() {
    const container = document.getElementById('personaListContainer');
    container.innerHTML = '';
    
    if(SYSTEM_DB.personas.length === 0) {
        container.innerHTML = `<div class="text-center text-sm text-slate-500 py-10 border border-dashed border-white/10 rounded-xl">尚無品牌人設，系統將使用預設設定。</div>`; return;
    }
    
    SYSTEM_DB.personas.forEach(p => {
        // 如果該人設有設定 taboos，則顯示出來；否則隱藏
        const tabooHtml = p.taboos ? `<div class="mt-2 text-[10px] text-red-300 bg-red-900/20 p-2 rounded border border-red-500/20"><b>禁忌指令：</b>${p.taboos}</div>` : '';
        
        container.innerHTML += `
            <div class="bg-slate-800 rounded-xl border border-white/10 p-4 relative group">
                <div class="flex items-start gap-3">
                    <div class="text-3xl bg-slate-900 w-12 h-12 flex items-center justify-center rounded-lg border border-white/5 flex-shrink-0">${p.icon}</div>
                    <div class="flex-grow">
                        <h4 class="text-sm font-black text-white">${p.name}</h4>
                        <p class="text-xs text-slate-400 mt-1 leading-relaxed">${p.desc}</p>
                        ${tabooHtml}
                    </div>
                </div>
                <button onclick="window.deletePersona('${p.id}')" class="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            </div>
        `;
    });
}

window.openNewPersonaForm = function() {
    document.getElementById('newPersonaForm').classList.remove('hidden');
    document.getElementById('btnAddNewPersonaContainer').classList.add('hidden');
};

window.cancelNewPersona = function() {
    document.getElementById('newPersonaForm').classList.add('hidden');
    document.getElementById('btnAddNewPersonaContainer').classList.remove('hidden');
    document.getElementById('newPersonaEmoji').value = '';
    document.getElementById('newPersonaName').value = '';
    document.getElementById('newPersonaTone').value = '';
    document.getElementById('newPersonaTaboo').value = '';
};

// js/v9_sidebar.js (局部替換最下方的兩個函數)

window.submitNewPersona = async function() {
    const icon = document.getElementById('newPersonaEmoji').value.trim() || '🤖';
    const name = document.getElementById('newPersonaName').value.trim();
    const desc = document.getElementById('newPersonaTone').value.trim();
    const taboos = document.getElementById('newPersonaTaboo').value.trim();
    
    if(!name || !desc) return alert('圖示可以不填，但請提供人設名稱與語氣特徵！');
    
    const btn = document.getElementById('btnSubmitNewPersona');
    btn.innerHTML = '<div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></div> 寫入中...';
    btn.disabled = true;
    
    try {
        // 🚀 正式打向後端 API
        const res = await API.createPersonaAPI({ tenantId: STATE.uid, icon, name, desc, taboos });
        if(res.success) {
            alert('🎉 品牌人設已寫入神經網路！');
            await bootSystemData(); // 重新向後端拉取最新資料庫
            window.cancelNewPersona();
            renderPersonaList();
        } else {
            throw new Error(res.message);
        }
    } catch(e) { 
        alert(`❌ 失敗: ${e.message}`); 
    } finally { 
        btn.innerHTML = '寫入神經網路'; 
        btn.disabled = false; 
    }
};

window.deletePersona = async function(personaId) {
    if(!confirm('確定要刪除這組品牌人設嗎？')) return;
    
    // 🛡️ 防呆機制：保護預設人設不被誤刪
    if(personaId.startsWith('p_default_')) {
        return alert('❌ 系統預設人設為唯讀屬性，無法刪除！');
    }

    try {
        // 🚀 正式打向後端 API
        const res = await API.deletePersonaAPI({ personaId, tenantId: STATE.uid });
        if(res.success) {
            await bootSystemData();
            renderPersonaList();
        } else {
            throw new Error(res.message);
        }
    } catch(e) { 
        alert(`❌ 刪除失敗: ${e.message}`); 
    }
};


// ==========================================
// 📜 算力歷史紀錄邏輯 (V10 引擎相容版 + 餘額軌跡)
// ==========================================
window.refreshAuditLogs = async function() { 
    const container = document.getElementById('auditLogsContainer'); 
    container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4"><div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div> 讀取中...</div>'; 
    try { 
        const res = await API.fetchAuditLogsAPI(STATE.uid); 
        if(res.success && res.logs.length > 0) { 
            container.innerHTML = ''; 
            res.logs.forEach(log => { 
                const action = log.type || log.actionType || 'SYSTEM_LOG'; 
                const isDeduct = !!log.amount || action.includes('GENERATE') || action.includes('PUBLISH') || action.includes('UPLOAD') || action.includes('TOKEN'); 
                const ptClass = isDeduct ? 'text-red-400' : 'text-green-400'; 
                const sign = isDeduct ? '-' : '+'; 
                const pts = log.amount || log.pointsDeducted || Math.abs(log.pointsChanged || 0); 
                const desc = log.description || action;
                const dateTaipei = new Date(log.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); 
                
                // 💡 新增：結餘變動計算與 UI 生成
                let balanceHtml = '';
                if (log.balanceAfter !== undefined) {
                    // 數學推算：如果是扣款，扣款前 = 扣款後 + 點數；如果是加值，加值前 = 扣款後 - 點數
                    const before = isDeduct ? (log.balanceAfter + pts) : (log.balanceAfter - pts);
                    balanceHtml = `
                        <div class="hidden sm:flex flex-col items-center justify-center px-4 border-l border-white/5">
                            <span class="text-[9px] text-slate-500 mb-0.5">算力結餘變化</span>
                            <div class="text-[10px] font-mono">
                                <span class="text-slate-400 line-through decoration-slate-600">${before.toLocaleString()}</span>
                                <span class="text-indigo-400 mx-1">➔</span>
                                <span class="text-white font-bold">${log.balanceAfter.toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                }

                container.innerHTML += `
                    <div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg text-[11px] mb-2 border border-white/5 shadow-inner hover:bg-slate-800 transition-colors">
                        <div class="flex-1 min-w-0 pr-2">
                            <p class="text-white font-bold truncate" title="${desc}">${desc}</p>
                            <p class="text-slate-500 text-[10px]">${dateTaipei}</p>
                        </div>
                        
                        ${balanceHtml}

                        <div class="flex-shrink-0 text-right min-w-[70px] pl-3 border-l border-white/5 sm:border-none">
                            <span class="${ptClass} font-black text-xs">${sign} ${pts.toLocaleString()}</span>
                            <span class="${ptClass} text-[9px] font-bold"> PTS</span>
                        </div>
                    </div>`; 
            }); 
        } else { 
            container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4">目前尚無算力紀錄，立即開啟新任務！</div>'; 
        } 
    } catch(e) { 
        container.innerHTML = `<div class="text-center text-xs text-red-400 py-4">讀取失敗 (髒資料跳過)</div>`; 
    } 
};
