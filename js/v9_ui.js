// js/v9_ui.js
import { STATE } from './config.js';

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

/**
 * ==========================================
 * 📌 函數名稱：createSkillUI
 * 💡 功能說明：在對話漏斗中插入互動式卡片。
 * 🚀 優化情境：移除所有偏移 Margin (ml-8/ml-12)，強制 w-full 滿版，解決右側被切邊與偏右的問題。
 * ==========================================
 */
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
    // 💡 關鍵修復：拔除 ml-8，改用 w-full，讓外部容器的 padding 來決定邊界
    div.className = 'skill-card w-full bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6 mx-auto';
    div.id = 'activeControlCard';
    div.innerHTML = html;
    log.appendChild(div);
    scrollDown();
    return div;
}

/**
 * ==========================================
 * 📌 函數名稱：releaseUI
 * 💡 功能說明：封裝當前卡片，鎖定所有輸入與按鈕，並清空殘留的錯誤提示框。
 * ==========================================
 */
export function releaseUI(ui) {
    document.body.style.overflow = '';
    lockUI(ui);
    ui.removeAttribute('id');
    ui.querySelectorAll('button').forEach(b => b.disabled = true);
    const inputs = ui.querySelectorAll('input, textarea, select');
    if(inputs) inputs.forEach(i => i.disabled = true);
    
    // 💡 步驟完成時，清除上一步遺留的警報框
    const errBox = document.getElementById('singletonErrorMsg');
    if (errBox) errBox.remove();
}

/**
 * ==========================================
 * 📌 函數名稱：addLog
 * 💡 功能說明：在畫面上印出大腦或系統的對話泡泡。
 * 🚀 優化情境：改用 Mobile-First 滿版卡片式排版，收納 Icon 至頂部 Header，徹底釋放手機寬度。字體升級至 14px/16px。
 * ==========================================
 */
/**
 * 漏斗對話區：扣點摘要橫條（原因 + 點數）
 */
/**
 * @param {string} [opts.persistNote] 扣點後附註（例如雲端任務已儲存）
 */
export function appendBillingNotice(reason, points, opts = {}) {
    const log = document.getElementById('funnelLog');
    if (!log) return;
    const wrap = document.createElement('div');
    wrap.className = 'w-full mb-2 animate-fade-in';
    const bar = document.createElement('div');
    bar.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-950/50 to-slate-900/90 border border-amber-500/25 text-[10px] shadow-sm';
    const tag = document.createElement('span');
    tag.className = 'flex-shrink-0 font-black text-amber-400 tracking-tight';
    tag.textContent = '🪙 扣點';
    const mid = document.createElement('span');
    mid.className = 'flex-1 min-w-0 truncate text-slate-300';
    mid.textContent = reason || '算力扣除';
    const pts = document.createElement('span');
    pts.className = 'flex-shrink-0 font-mono font-black text-red-300 tabular-nums';
    pts.textContent = `−${Number(points).toLocaleString()} PTS`;
    bar.append(tag, mid, pts);
    wrap.appendChild(bar);
    if (opts.persistNote && String(opts.persistNote).trim()) {
        const note = document.createElement('div');
        note.className = 'mt-1.5 mx-0.5 px-2 py-1.5 rounded-md bg-slate-900/80 border border-emerald-500/20 text-[10px] text-emerald-200/95 leading-snug';
        note.textContent = String(opts.persistNote).trim();
        wrap.appendChild(note);
    }
    const activeCard = document.getElementById('activeControlCard');
    if (activeCard) log.insertBefore(wrap, activeCard);
    else log.appendChild(wrap);
    scrollDown();
}

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

/**
 * ==========================================
 * 📌 函數名稱：showError
 * 💡 功能說明：顯示錯誤警報框。
 * 🚀 優化情境：導入 Singleton (單一實例) 模式，避免用戶連點導致錯誤堆疊。
 * ==========================================
 */
export async function showError(msg) {
    const log = document.getElementById('funnelLog'); 
    let div = document.getElementById('singletonErrorMsg');
    
    if (div) {
        // 如果已經有了，就更新文字並重新觸發彈跳特效
        div.querySelector('.error-text').innerHTML = msg;
        div.classList.remove('animate-bounce');
        void div.offsetWidth; // 觸發瀏覽器重繪 (Reflow) 以重啟動畫
        div.classList.add('animate-bounce');
    } else {
        // 沒有則新建
        div = document.createElement('div');
        div.id = 'singletonErrorMsg';
        div.className = 'flex justify-center w-full my-2 animate-bounce';
        div.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"><span class="text-lg">🚨</span> <span class="error-text">${msg}</span></div>`;
        const activeCard = document.getElementById('activeControlCard');
        if (activeCard) log.insertBefore(div, activeCard); else log.appendChild(div);
    }
    scrollDown();
}

/**
 * ==========================================
 * 📌 函數名稱：updatePointsDisplay
 * 💡 功能說明：更新右上角算力餘額，並包含「重力下拉拉霸」與 500 點警示效果。
 * 🚀 優化情境：
 * 1. 放大點數按鈕空間。
 * 2. 低於 500 點時，啟動紅色脈衝警戒。
 * 3. 扣點動畫改為向下沉降 (translate-y)，避免被頂部切斷。
 * ==========================================
 */
export function updatePointsDisplay(newPoints) {
    const ptsEl = document.getElementById('userPoints');
    if (!ptsEl) return;
    const parentEl = ptsEl.parentElement;

    const currentStr = ptsEl.innerText.replace(/,/g, '').replace(/---/g, '0');
    const currentPts = parseInt(currentStr, 10) || 0;
    const targetPts = parseInt(newPoints, 10) || 0;
    STATE.userPoints = targetPts;

    parentEl.classList.add('px-4', 'py-2', 'shadow-md');
    ptsEl.classList.add('text-sm', 'lg:text-base', 'font-black');

    // 💡 優化 2：警戒線調整為 500 點
    if (targetPts < 500) {
        parentEl.classList.add('animate-pulse', 'bg-red-900/80', 'border-red-500');
        parentEl.classList.remove('bg-slate-800', 'border-white/10', 'hover:bg-slate-700');
        ptsEl.classList.remove('text-yellow-400');
        ptsEl.classList.add('text-red-400');
        if (parentEl.innerHTML.includes('⚡')) parentEl.innerHTML = parentEl.innerHTML.replace('⚡', '⚠️');
    } else {
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
            
            // 💡 動畫結束：向下沉降拉霸特效 (重力感)
            ptsEl.classList.add('origin-top', 'translate-y-2', 'scale-110', 'text-white', 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]');
            setTimeout(() => {
                ptsEl.classList.remove('origin-top', 'translate-y-2', 'scale-110', 'text-white', 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]');
            }, 350); 
        }
    }, 1000 / frameRate);
}
