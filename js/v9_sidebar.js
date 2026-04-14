// js/v9_sidebar.js
import { STATE } from './config.js';
import * as API from './api.js';
import { SYSTEM_DB, compressImage, bootSystemData } from './v9_state.js';

let tempCharBase64 = null;

window.openCharManager = function() { 
    const modal = document.getElementById('charManageModal'); 
    modal.classList.remove('hidden'); 
    setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10); 
    renderCharGrid(); 
};

window.closeCharManager = function() { 
    const modal = document.getElementById('charManageModal'); 
    modal.classList.remove('show'); 
    setTimeout(() => { modal.classList.add('hidden'); }, 300); 
    window.cancelNewChar(); 
};

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
    finally { btn.innerHTML = '上傳並萃取基因'; btn.disabled = false; } 
};

window.deleteChar = async function(charId) { 
    if(!confirm('確定要刪除嗎？')) return; 
    try { 
        const res = await API.deleteCharacterAPI({ charId, tenantId: STATE.uid }); 
        if(res.success) { await bootSystemData(); renderCharGrid(); } 
        else throw new Error(res.message); 
    } catch(e) { alert(`❌ 刪除失敗: ${e.message}`); } 
};

window.refreshAuditLogs = async function() { 
    const container = document.getElementById('auditLogsContainer'); 
    container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4"><div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div> 讀取中...</div>'; 
    try { 
        const res = await API.fetchAuditLogsAPI(STATE.uid); 
        if(res.success && res.logs.length > 0) { 
            container.innerHTML = ''; 
            res.logs.forEach(log => { 
                const action = (log.actionType || 'SYSTEM_LOG'); 
                const isDeduct = action.includes('GENERATE') || action.includes('PUBLISH') || action.includes('UPLOAD'); 
                const ptClass = isDeduct ? 'text-red-400' : 'text-green-400'; 
                const sign = isDeduct ? '-' : '+'; 
                const pts = log.pointsDeducted || Math.abs(log.pointsChanged || 0); 
                const dateTaipei = new Date(log.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); 
                container.innerHTML += `<div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg text-[11px] mb-2 border border-white/5 shadow-inner"><div><p class="text-white font-bold">${action}</p><p class="text-slate-500 text-[10px]">${dateTaipei}</p></div><span class="${ptClass} font-black text-xs">${sign} ${pts.toLocaleString()} PTS</span></div>`; 
            }); 
        } else { container.innerHTML = '<div class="text-center text-xs text-slate-500 py-4">目前尚無算力紀錄，立即開啟新任務！</div>'; } 
    } catch(e) { container.innerHTML = `<div class="text-center text-xs text-red-400 py-4">讀取失敗 (髒資料跳過)</div>`; } 
};
