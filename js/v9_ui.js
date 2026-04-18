// js/v9_ui.js

/**
 * ==========================================
 * 📌 函數名稱：updateStepHeader
 * 💡 功能說明：更新畫面左上角的任務步驟指示器。
 * ==========================================
 */
export function updateStepHeader(name) { document.getElementById('missionStep').innerText = name; }

/**
 * ==========================================
 * 📌 函數名稱：lockUI
 * 💡 功能說明：將傳入的 UI 元素半透明化並鎖定點擊。
 * ==========================================
 */
export function lockUI(el) { el.classList.add('opacity-40', 'pointer-events-none'); }

/**
 * ==========================================
 * 📌 函數名稱：scrollDown
 * 💡 功能說明：平滑滾動對話漏斗到底部。
 * ==========================================
 */
export function scrollDown() { document.getElementById('funnelLog').scrollTo({ top: document.getElementById('funnelLog').scrollHeight, behavior: 'smooth' }); }

export function createSkillUI(html) {
    const log = document.getElementById('funnelLog');
    const oldActive = document.getElementById('activeControlCard');
    if (oldActive) {
        oldActive.removeAttribute('id');
        oldActive.querySelectorAll('button').forEach(b => b.disabled = true);
        const inputs = oldActive.querySelectorAll('input, textarea, select');
        if(inputs) inputs.forEach(i => i.disabled = true);
    }
    const div = document.createElement('div');
    // 優化卡片邊距，適應手機螢幕
    div.className = 'skill-card w-full bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6';
    div.id = 'activeControlCard';
    div.innerHTML = html;
    log.appendChild(div);
    scrollDown();
    return div;
}

export function releaseUI(ui) {
    lockUI(ui);
    ui.removeAttribute('id');
    ui.querySelectorAll('button').forEach(b => b.disabled = true);
    const inputs = ui.querySelectorAll('input, textarea, select');
    if(inputs) inputs.forEach(i => i.disabled = true);
}

/**
 * ==========================================
 * 📌 函數名稱：addLog
 * 💡 功能說明：在畫面上印出大腦或系統的對話泡泡。
 * 🚀 優化情境：改用 Mobile-First 滿版卡片式排版，收納 Icon 至頂部 Header，徹底釋放手機寬度。字體升級至 14px/16px。
 * ==========================================
 */
export async function addLog(role, icon, msg, skipTyping = false) {
    const log = document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'w-full animate-fade-in mb-4';
    
    // 💡 滿版卡片設計：頭部放 Icon 與名稱，身體放滿版文字
    div.innerHTML = `
        <div class="bg-slate-800/90 rounded-2xl border border-white/10 shadow-lg overflow-hidden flex flex-col">
            <div class="flex items-center gap-2 bg-slate-900/50 px-3 py-2 border-b border-white/5">
                <div class="text-xl lg:text-2xl">${icon}</div>
                <div class="text-[11px] lg:text-xs font-black text-slate-400 uppercase tracking-widest">${role}</div>
            </div>
            <div class="p-3 lg:p-4 msg-content text-sm lg:text-base text-slate-100 leading-relaxed">
                ${skipTyping ? msg : '<span class="animate-pulse text-slate-500">...</span>'}
            </div>
        </div>
    `;
    
    const activeCard = document.getElementById('activeControlCard');
    if (activeCard) log.insertBefore(div, activeCard); else log.appendChild(div);
    scrollDown();
    if (!skipTyping) { await new Promise(r => setTimeout(r, 600)); div.querySelector('.msg-content').innerHTML = msg; }
}

export async function showError(msg) {
    const log = document.getElementById('funnelLog'); const div = document.createElement('div');
    div.className = 'flex justify-center w-full my-2 animate-bounce';
    div.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"><span class="text-lg">🚨</span> <span>${msg}</span></div>`;
    const activeCard = document.getElementById('activeControlCard');
    if (activeCard) log.insertBefore(div, activeCard); else log.appendChild(div);
    scrollDown();
}

/**
 * ==========================================
 * 📌 函數名稱：updatePointsDisplay
 * 💡 功能說明：更新右上角算力餘額，並包含拉霸動態與警示效果。
 * 🚀 優化情境：
 * 1. 放大點數按鈕空間與字體。
 * 2. 低於 100 點時，啟動紅色脈衝警戒 (Pulse) 並更換 ⚠️ 圖示。
 * ⚠️ 注意事項：依賴 DOM 元素 `id="userPoints"` 及其父元素進行樣式控制。
 * ==========================================
 */
export function updatePointsDisplay(newPoints) {
    const ptsEl = document.getElementById('userPoints');
    if (!ptsEl) return;
    const parentEl = ptsEl.parentElement;

    const currentStr = ptsEl.innerText.replace(/,/g, '').replace(/---/g, '0');
    const currentPts = parseInt(currentStr, 10) || 0;
    const targetPts = parseInt(newPoints, 10) || 0;

    // 💡 優化 1：強制放大父元素 padding 與自身字體，吃滿空間
    parentEl.classList.add('px-4', 'py-2', 'shadow-md');
    ptsEl.classList.add('text-sm', 'lg:text-base', 'font-black');

    // 💡 優化 2：低於 100 點的急迫性警戒狀態
    if (targetPts < 100) {
        parentEl.classList.add('animate-pulse', 'bg-red-900/80', 'border-red-500');
        parentEl.classList.remove('bg-slate-800', 'border-white/10', 'hover:bg-slate-700');
        ptsEl.classList.remove('text-yellow-400');
        ptsEl.classList.add('text-red-400');
        if (parentEl.innerHTML.includes('⚡')) parentEl.innerHTML = parentEl.innerHTML.replace('⚡', '⚠️');
    } else {
        // 恢復正常狀態
        parentEl.classList.remove('animate-pulse', 'bg-red-900/80', 'border-red-500');
        parentEl.classList.add('bg-slate-800', 'border-white/10', 'hover:bg-slate-700');
        ptsEl.classList.remove('text-red-400');
        ptsEl.classList.add('text-yellow-400');
        if (parentEl.innerHTML.includes('⚠️')) parentEl.innerHTML = parentEl.innerHTML.replace('⚠️', '⚡');
    }

    if (currentPts === targetPts) {
        ptsEl.innerText = targetPts.toLocaleString();
        return;
    }

    // 🎰 拉霸動畫參數
    const duration = 1000;
    const frameRate = 30; 
    const totalFrames = Math.round(duration / (1000 / frameRate));
    let frame = 0;

    const counter = setInterval(() => {
        frame++;
        const progress = frame / totalFrames;
        const easeOutProgress = 1 - Math.pow(1 - progress, 3); 
        
        const currentAnimatedPts = Math.round(currentPts + (targetPts - currentPts) * easeOutProgress);
        ptsEl.innerText = currentAnimatedPts.toLocaleString();

        if (frame >= totalFrames) {
            clearInterval(counter);
            ptsEl.innerText = targetPts.toLocaleString();
            
            // 💡 動畫結束：超強文字發光放大特效
            ptsEl.classList.add('scale-[1.3]', 'text-white', 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]');
            setTimeout(() => {
                ptsEl.classList.remove('scale-[1.3]', 'text-white', 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]');
            }, 300);
        }
    }, 1000 / frameRate);
}
