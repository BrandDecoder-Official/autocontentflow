// js/v9_sidebar.js
import { STATE } from './config.js';
import * as API from './api.js';
import { SYSTEM_DB, compressImage, bootSystemData, updateSidebarCountUI } from './v9_state.js';

// 🚀 引入統一計費防護網
import { getPricingConfig, validatePoints, applyPointDeduction, getBillingActionDisplayName } from './v9_finance.js';

let tempCharBase64 = null;

// ==========================================
// 🧬 側邊欄全域管理與頁籤切換
// ==========================================
window.openCharManager = function() {
    const modal = document.getElementById('charManageModal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10);
    renderCharGrid();
    updateSidebarCountUI();
};

window.closeCharManager = function() {
    const modal = document.getElementById('charManageModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
    window.cancelNewChar();
};

window.openPersonaManager = function() {
    const modal = document.getElementById('personaManageModal');
    modal.classList.remove('hidden');
    setTimeout(() => { modal.classList.add('show'); modal.classList.remove('opacity-0'); }, 10);
    renderPersonaList();
    updateSidebarCountUI();
};

window.closePersonaManager = function() {
    const modal = document.getElementById('personaManageModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
    window.cancelNewPersona();
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
        grid.innerHTML += `
            <div class="bg-slate-800 rounded-xl border border-white/10 p-3 flex flex-col items-center gap-2 relative group shadow-lg">
                <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600">
                    <img src="${char.imageUrl}" class="w-full h-full object-cover">
                </div>
                <div class="text-center w-full">
                    <p class="text-xs font-bold text-white truncate">${char.name}</p>
                    <p class="text-[9px] text-slate-400 truncate w-full" title="${char.aiExtractedFeatures}">${char.aiExtractedFeatures || '特徵分析中...'}</p>
                </div>
                <button onclick="window.deleteChar('${char.id}')" class="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-md">✕</button>
            </div>`; 
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
    
    // 💡 財務閘門：註冊視覺基因扣點防呆
    const pricing = getPricingConfig();
    const cost = pricing.BASE_FEES.CREATE_CHARACTER || 800;
    if (!validatePoints(cost, "註冊視覺角色")) return; // 餘額不足直接阻擋

    const btn = document.getElementById('btnSubmitNewChar'); 
    btn.innerHTML = '<div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></div> 萃取中...'; 
    btn.disabled = true; 
    try { 
        const res = await API.createCharacterAPI({ tenantId: STATE.uid, name, type, persona, imageBase64: tempCharBase64, mimeType: 'image/jpeg' }); 
        if(res.success) { 
            alert('🎉 角色基因註冊成功！'); 
            // 後端已實際扣點並寫入 transactions；前端僅展演動畫並拉最新餘額
            const charged = Number(res.chargedPoints);
            await applyPointDeduction(
                Number.isFinite(charged) && charged > 0 ? charged : cost,
                getBillingActionDisplayName('CREATE_CHARACTER', '註冊視覺角色')
            );
            
            await bootSystemData(); 
            window.cancelNewChar(); 
            renderCharGrid(); 
        } 
        else throw new Error(res.message); 
    } catch(e) { alert(`❌ 失敗: ${e.message}`); } 
    finally { btn.innerHTML = '上傳並萃取'; btn.disabled = false; } 
};

window.deleteChar = async function(charId) { 
    if(!confirm('確定要從基因庫刪除此角色嗎？')) return; 
    try { 
        const res = await API.deleteCharacterAPI({ charId, tenantId: STATE.uid }); 
        if(res.success) { 
            await bootSystemData(); 
            renderCharGrid(); 
        } 
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
        const tabooHtml = p.taboos ? `<div class="mt-2 text-[10px] text-red-300 bg-red-900/20 p-2 rounded border border-red-500/20"><b>禁忌指令：</b>${p.taboos}</div>` : '';
        
        container.innerHTML += `
            <div class="bg-slate-800 rounded-xl border border-white/10 p-4 relative group shadow-lg">
                <div class="flex items-start gap-3">
                    <div class="text-3xl bg-slate-900 w-12 h-12 flex items-center justify-center rounded-lg border border-white/5 flex-shrink-0">${p.icon}</div>
                    <div class="flex-grow">
                        <h4 class="text-sm font-black text-white">${p.name}</h4>
                        <p class="text-xs text-slate-400 mt-1 leading-relaxed">${p.desc}</p>
                        ${tabooHtml}
                    </div>
                </div>
                <button onclick="window.deletePersona('${p.id}')" class="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white w-6 h-6 rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-md">✕</button>
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

window.submitNewPersona = async function() {
    const icon = document.getElementById('newPersonaEmoji').value.trim() || '🤖';
    const name = document.getElementById('newPersonaName').value.trim();
    const desc = document.getElementById('newPersonaTone').value.trim();
    const taboos = document.getElementById('newPersonaTaboo').value.trim();
    
    if(!name || !desc) return alert('圖示可以不填，但請提供人設名稱與語氣特徵！');
    
    // 💡 財務閘門：訓練品牌人設扣點防呆
    const pricing = getPricingConfig();
    const cost = pricing.BASE_FEES.CREATE_PERSONA || 500;
    if (!validatePoints(cost, "訓練品牌人設")) return; // 餘額不足直接阻擋

    const btn = document.getElementById('btnSubmitNewPersona');
    btn.innerHTML = '<div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></div> 寫入中...';
    btn.disabled = true;
    
    try {
        const res = await API.createPersonaAPI({ tenantId: STATE.uid, icon, name, desc, taboos });
        if(res.success) {
            alert('🎉 品牌人設已寫入神經網絡！');
            const charged = Number(res.chargedPoints);
            await applyPointDeduction(
                Number.isFinite(charged) && charged > 0 ? charged : cost,
                getBillingActionDisplayName('CREATE_PERSONA', '品牌人設')
            );

            await bootSystemData(); 
            window.cancelNewPersona();
            renderPersonaList();
        } else {
            throw new Error(res.message);
        }
    } catch(e) { 
        alert(`❌ 失敗: ${e.message}`); 
    } finally { 
        btn.innerHTML = '寫入神經網絡'; 
        btn.disabled = false; 
    }
};

window.deletePersona = async function(personaId) {
    if(!confirm('確定要刪除這組品牌人設嗎？')) return;
    
    if(personaId.startsWith('p_default_')) {
        return alert('❌ 系統預設人設為唯讀屬性，無法刪除！');
    }

    try {
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
// 📜 算力歷史紀錄邏輯
// ==========================================
window.refreshAuditLogs = async function() { 
    const container = document.getElementById('auditLogsContainer'); 
    container.innerHTML = `
        <div class="text-center text-xs text-slate-500 py-6">
            <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block align-middle mr-2"></div> 
            正在從區塊鏈同步紀錄...
        </div>`; 
        
    try { 
        const res = await API.fetchAuditLogsAPI(STATE.uid); 
        if(res.success && res.logs.length > 0) { 
            container.innerHTML = ''; 
            res.logs.forEach(log => { 
                const action = log.type || log.actionType || 'SYSTEM_LOG'; 
                const isDeduct = !!log.amount || action.includes('GENERATE') || action.includes('PUBLISH') || action.includes('UPLOAD') || action.includes('TOKEN'); 
                const ptClass = isDeduct ? 'text-red-400' : 'text-emerald-400'; 
                const sign = isDeduct ? '-' : '+'; 
                const pts = log.amount || log.pointsDeducted || Math.abs(log.pointsChanged || 0); 
                const desc = log.description || action;
                const dateTaipei = new Date(log.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); 
                
                let balanceHtml = '';
                if (log.balanceAfter !== undefined) {
                    const before = isDeduct ? (log.balanceAfter + pts) : (log.balanceAfter - pts);
                    balanceHtml = `
                        <div class="flex items-center justify-between w-full mt-2 pt-2 border-t border-white/5">
                            <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">算力餘額軌跡</span>
                            <div class="text-xs font-mono tracking-tight flex items-center">
                                <span class="text-slate-500 line-through decoration-slate-600 mr-2">${before.toLocaleString()}</span>
                                <span class="text-indigo-400 mx-1">➔</span>
                                <span class="text-white font-black ml-2">${log.balanceAfter.toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                }

                container.innerHTML += `
                    <div class="flex flex-col bg-slate-900/50 p-4 rounded-xl mb-3 border border-white/5 shadow-inner hover:bg-slate-800 transition-all duration-300">
                        <div class="flex justify-between items-start w-full">
                            <div class="flex-1 pr-2">
                                <p class="text-white font-black text-xs sm:text-sm leading-tight mb-1 truncate" title="${desc}">${desc}</p>
                                <p class="text-slate-500 text-[10px] sm:text-xs font-medium">${dateTaipei}</p>
                            </div>
                            <div class="flex-shrink-0 text-right">
                                <div class="${ptClass} font-black text-sm sm:text-base mb-0.5">${sign} ${pts.toLocaleString()}</div>
                                <div class="${ptClass} text-[9px] font-black tracking-widest opacity-80 uppercase">PTS</div>
                            </div>
                        </div>
                        ${balanceHtml}
                    </div>`; 
            }); 
        } else { 
            container.innerHTML = '<div class="text-center text-xs text-slate-500 py-10">目前尚無算力紀錄，立即開啟新任務！</div>'; 
        } 
    } catch(e) { 
        container.innerHTML = `<div class="text-center text-xs text-red-400 py-10">⚠️ 紀錄讀取失敗，請稍後再試</div>`; 
    } 
};
