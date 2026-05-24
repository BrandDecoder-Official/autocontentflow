// js/v9_ui.js
import { STATE } from './config.js';

/**
 * ==========================================
 * 📌 函數名稱：updateStepHeader
 * 💡 功能說明：更新畫面左上角的任務步驟指示器。
 * ==========================================
 */
export function updateStepHeader(name) { 
    const missionStep = document.getElementById('missionStep');
    if (missionStep) missionStep.innerText = name; 
}

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
 * 💡 功能說明：平滑滾動對話區到底部。
 * ==========================================
 */
export function scrollDown() { 
    const container = document.getElementById('chatMessages') || document.getElementById('funnelLog');
    if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }); 
    }
}

/**
 * ==========================================
 * 📌 函數名稱：createSkillUI
 * 💡 功能說明：在工作區中插入互動式卡片。
 * ==========================================
 */
export function createSkillUI(html) {
    const workspaceCards = document.getElementById('workspaceCards');
    const log = workspaceCards || document.getElementById('funnelLog');
    const oldActive = document.getElementById('activeControlCard');
    
    if (oldActive) {
        oldActive.removeAttribute('id');
        oldActive.querySelectorAll('button').forEach(b => b.disabled = true);
        const inputs = oldActive.querySelectorAll('input, textarea, select');
        if(inputs) inputs.forEach(i => i.disabled = true);
    }
    
    const div = document.createElement('div');
    div.className = 'skill-card w-full bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6 mx-auto relative z-10';
    div.id = 'activeControlCard';
    div.innerHTML = html;
    log.appendChild(div);
    
    // 🎨 OiiOii SVG 流程線繪製
    if (typeof window.drawWorkflowLines === 'function') {
        setTimeout(window.drawWorkflowLines, 50);
    }

    // 💡 引導式快捷按鈕即時重繪
    if (typeof window.renderQuickReplies === 'function') {
        window.renderQuickReplies();
    }

    if (workspaceCards) {
        const pane = document.getElementById('workspacePane');
        if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
    } else {
        scrollDown();
    }
    
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
 * 💡 功能說明：在左側對話框中印出大腦或系統的對話泡泡。
 * ==========================================
 */
export function appendBillingNotice(reason, points, opts = {}) {
    const chatMessages = document.getElementById('chatMessages');
    const log = chatMessages || document.getElementById('funnelLog');
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
    if (activeCard && activeCard.parentNode === log) {
        log.insertBefore(wrap, activeCard);
    } else {
        log.appendChild(wrap);
    }
    
    scrollDown();
}

export async function addLog(role, icon, msg, skipTyping = false) {
    const chatMessages = document.getElementById('chatMessages');
    const log = chatMessages || document.getElementById('funnelLog');
    const div = document.createElement('div');
    div.className = 'w-full animate-fade-in mb-4';
    
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
    if (activeCard && activeCard.parentNode === log) {
        log.insertBefore(div, activeCard);
    } else {
        log.appendChild(div);
    }
    
    scrollDown();
    if (!skipTyping) { 
        await new Promise(r => setTimeout(r, 600)); 
        div.querySelector('.msg-content').innerHTML = msg; 
    }
}

/**
 * ==========================================
 * 📌 函數名稱：showError
 * 💡 功能說明：顯示錯誤警報框。
 * ==========================================
 */
export async function showError(msg) {
    const chatMessages = document.getElementById('chatMessages');
    const log = chatMessages || document.getElementById('funnelLog');
    let div = document.getElementById('singletonErrorMsg');
    
    if (div) {
        div.querySelector('.error-text').innerHTML = msg;
        div.classList.remove('animate-bounce');
        void div.offsetWidth; 
        div.classList.add('animate-bounce');
    } else {
        div = document.createElement('div');
        div.id = 'singletonErrorMsg';
        div.className = 'flex justify-center w-full my-2 animate-bounce';
        div.innerHTML = `<div class="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center gap-2"><span class="text-lg">🚨</span> <span class="error-text">${msg}</span></div>`;
        
        const activeCard = document.getElementById('activeControlCard');
        if (activeCard && activeCard.parentNode === log) {
            log.insertBefore(div, activeCard);
        } else {
            log.appendChild(div);
        }
    }
    scrollDown();
}

/**
 * ==========================================
 * 📌 函數名稱：updatePointsDisplay
 * 💡 功能說明：更新右上角算力餘額，並包含訂閱 Tier 標籤渲染與低於 500 點警告效果。
 * ==========================================
 */
export function updatePointsDisplay(newPoints, tier) {
    const ptsEl = document.getElementById('userPoints');
    if (!ptsEl) return;
    const parentEl = ptsEl.parentElement;

    const currentStr = ptsEl.innerText.replace(/,/g, '').replace(/---/g, '0');
    const currentPts = parseInt(currentStr, 10) || 0;
    const targetPts = parseInt(newPoints, 10) || 0;
    STATE.userPoints = targetPts;

    // 💸 V10 右上角 錢包標章 (Tier Badge) 整合
    const tierEl = document.getElementById('userTier');
    if (tierEl) {
        if (tier) {
            tierEl.innerText = tier.toUpperCase();
            tierEl.classList.remove('hidden');
            tierEl.className = 'text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all duration-300';
            
            if (tier.toUpperCase() === 'APEX') {
                tierEl.classList.add('bg-gradient-to-r', 'from-amber-500/20', 'to-orange-500/20', 'text-amber-300', 'border-amber-500/40', 'shadow-[0_0_10px_rgba(245,158,11,0.2)]');
            } else if (tier.toUpperCase() === 'PRO') {
                tierEl.classList.add('bg-gradient-to-r', 'from-cyan-500/20', 'to-blue-500/20', 'text-cyan-300', 'border-cyan-500/40', 'shadow-[0_0_10px_rgba(6,182,212,0.2)]');
            } else {
                tierEl.classList.add('bg-indigo-500/10', 'text-indigo-300', 'border-indigo-500/30');
            }
        } else {
            tierEl.classList.add('hidden');
        }
    }

    parentEl.classList.add('px-4', 'py-2', 'shadow-md');
    ptsEl.classList.add('text-sm', 'lg:text-base', 'font-black');

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
            
            ptsEl.classList.add('origin-top', 'translate-y-2', 'scale-110', 'text-white', 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]');
            setTimeout(() => {
                ptsEl.classList.remove('origin-top', 'translate-y-2', 'scale-110', 'text-white', 'drop-shadow-[0_0_12px_rgba(255,255,255,1)]');
            }, 350); 
        }
    }, 1000 / frameRate);
}

/**
 * ==========================================
 * 🎨 雙欄式對話工作室 (Split-Pane Studio) 初始化
 * ==========================================
 */
export function initSplitPaneLayout() {
    const log = document.getElementById('funnelLog');
    if (!log) return;

    log.className = "flex-grow flex lg:flex-row flex-col overflow-hidden relative agent-chat-area";
    log.innerHTML = `
        <!-- Mobile Tab Switcher -->
        <div class="lg:hidden flex items-center border-b border-white/5 bg-slate-900/50 flex-shrink-0 z-10 w-full">
            <button id="tabBtnChat" class="flex-1 py-3 text-xs font-bold text-indigo-400 border-b-2 border-indigo-500 text-center">💬 對話</button>
            <button id="tabBtnWorkspace" class="flex-1 py-3 text-xs font-bold text-slate-400 border-b-2 border-transparent text-center">🎨 工作區</button>
        </div>

        <!-- Left Chat Pane -->
        <div id="chatPane" class="w-full lg:w-[40%] h-full flex flex-col border-r border-white/5 bg-slate-950/20 relative z-10">
            <!-- Chat Messages Scroll Container -->
            <div id="chatMessages" class="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar pb-32">
                <!-- Chat history/bubbles will land here -->
            </div>
            
            <!-- Chat Bar Container (embedded) -->
            <div id="agentChatBar" class="absolute bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t border-indigo-500/50 p-3 pb-safe z-[50] flex flex-col transition-transform duration-500">
                <!-- Quick Reply Guidance Box -->
                <div id="quickRepliesContainer" class="flex items-center gap-2 overflow-x-auto no-scrollbar mb-2 py-1 w-full">
                    <!-- Quick replies render dynamically -->
                </div>
                
                <div class="w-full flex items-end gap-2">
                    <textarea id="agentChatInput" rows="1" class="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none resize-none max-h-32 overflow-y-auto no-scrollbar" placeholder="請透過對話讓 Agent 協助您修改 (例如：幫我把主題換成啦啦隊，Shift+Enter 換行)..."></textarea>
                    <button id="btnSendChat" class="flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-6 py-3 rounded-xl font-black text-sm shadow-[0_0_15px_rgba(79,70,229,0.5)] active:scale-95 transition-all h-[46px]">
                        <span class="hidden sm:inline">送出指令</span>
                        <span class="sm:hidden text-xl">🚀</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Right Workspace Pane -->
        <div id="workspacePane" class="hidden lg:flex lg:w-[60%] h-full flex-col overflow-y-auto p-4 lg:p-8 custom-scrollbar relative bg-slate-900/10 z-10">
            <!-- Workflow SVG Flowlines overlay -->
            <div class="absolute inset-0 pointer-events-none z-0" id="flowlineOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                <svg class="w-full h-full" id="flowlineSvg" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none;"></svg>
            </div>
            
            <!-- Cards will render here -->
            <div id="workspaceCards" class="relative z-10 w-full max-w-2xl mx-auto space-y-16 py-8">
                <!-- Theme Card, Draft Card, Publish Card render here -->
            </div>
        </div>
    `;

    // Define switchMobileTab helper for tabs
    const chatPane = log.querySelector('#chatPane');
    const workspacePane = log.querySelector('#workspacePane');
    const tabBtnChat = log.querySelector('#tabBtnChat');
    const tabBtnWorkspace = log.querySelector('#tabBtnWorkspace');

    tabBtnChat.onclick = () => {
        chatPane.classList.remove('hidden');
        workspacePane.classList.add('hidden');
        tabBtnChat.className = "flex-1 py-3 text-xs font-bold text-indigo-400 border-b-2 border-indigo-500 text-center";
        tabBtnWorkspace.className = "flex-1 py-3 text-xs font-bold text-slate-400 border-b-2 border-transparent text-center";
    };

    tabBtnWorkspace.onclick = () => {
        chatPane.classList.add('hidden');
        workspacePane.classList.remove('hidden');
        tabBtnChat.className = "flex-1 py-3 text-xs font-bold text-slate-400 border-b-2 border-transparent text-center";
        tabBtnWorkspace.className = "flex-1 py-3 text-xs font-bold text-indigo-400 border-b-2 border-indigo-500 text-center";
        
        // Redraw flowlines upon tab switch
        if (typeof window.drawWorkflowLines === 'function') {
            setTimeout(window.drawWorkflowLines, 50);
        }
    };

    // Add scroll listener to workspacePane to redraw lines on scroll
    workspacePane.addEventListener('scroll', () => {
        if (typeof window.drawWorkflowLines === 'function') {
            window.drawWorkflowLines();
        }
    });

    // Make sure we rebind chat input events
    if (typeof window.rebindAgentChat === 'function') {
        window.rebindAgentChat();
    }
}

/**
 * ==========================================
 * ⚡ SVG Flowline 連接引擎 (Workflow Flowlines)
 * ==========================================
 */
window.drawWorkflowLines = function() {
    const svg = document.getElementById('flowlineSvg');
    if (!svg) return;
    svg.innerHTML = ''; // Clear previous lines

    const cards = Array.from(document.querySelectorAll('#workspaceCards .skill-card'));
    if (cards.length < 2) return;

    const svgRect = svg.getBoundingClientRect();
    if (svgRect.width === 0 || svgRect.height === 0) return;

    // Draw lines between consecutive cards
    for (let i = 0; i < cards.length - 1; i++) {
        const card1 = cards[i];
        const card2 = cards[i + 1];

        const r1 = card1.getBoundingClientRect();
        const r2 = card2.getBoundingClientRect();

        const x1 = r1.left + r1.width / 2 - svgRect.left;
        const y1 = r1.bottom - svgRect.top;
        const x2 = r2.left + r2.width / 2 - svgRect.left;
        const y2 = r2.top - svgRect.top;

        const controlY = y1 + (y2 - y1) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;

        // 1. Background line (grey dashed)
        const bgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        bgPath.setAttribute('d', d);
        bgPath.setAttribute('fill', 'none');
        bgPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
        bgPath.setAttribute('stroke-width', '4');
        bgPath.setAttribute('stroke-linecap', 'round');
        svg.appendChild(bgPath);

        // 2. Animated glow line (indigo/cyan gradient)
        const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        glowPath.setAttribute('d', d);
        glowPath.setAttribute('fill', 'none');
        glowPath.setAttribute('stroke', 'url(#flowlineGrad)');
        glowPath.setAttribute('stroke-width', '3');
        glowPath.setAttribute('stroke-linecap', 'round');
        glowPath.setAttribute('stroke-dasharray', '8, 12');
        glowPath.setAttribute('class', 'animate-flowline');
        svg.appendChild(glowPath);
    }

    // Add gradient definition if it doesn't exist
    if (!svg.querySelector('defs')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', 'flowlineGrad');
        grad.setAttribute('x1', '0%');
        grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '0%');
        grad.setAttribute('y2', '100%');

        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#6366f1'); // Indigo

        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#06b6d4'); // Cyan

        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
        svg.appendChild(defs);
    }
};

// Redraw lines on window resize
window.addEventListener('resize', () => {
    if (typeof window.drawWorkflowLines === 'function') {
        window.drawWorkflowLines();
    }
});
