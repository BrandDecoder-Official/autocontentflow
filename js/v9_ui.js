import { STATE } from './config.js';
import { MISSION, getMissionCharacterNames, SYSTEM_DB } from './v9_state.js';

// 🚀 動態注入 Canvas 3.0 極致特效與行動端樣式
(function injectCanvasStyles() {
    const styleId = 'bd-canvas-3d-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* 1. 雷射線掃描動畫 */
        @keyframes laser-sweep {
            0% { top: 0%; opacity: 0.1; }
            30% { opacity: 0.8; }
            50% { top: 100%; opacity: 1; }
            70% { opacity: 0.8; }
            100% { top: 0%; opacity: 0.1; }
        }
        .laser-container {
            position: relative;
            overflow: hidden;
        }
        .laser-line {
            position: absolute;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, transparent, #06b6d4, #6366f1, #06b6d4, transparent);
            box-shadow: 0 0 10px #06b6d4, 0 0 20px #6366f1;
            z-index: 10;
            animation: laser-sweep 3s ease-in-out infinite;
            pointer-events: none;
        }
        
        /* 2. 霓虹旋轉邊框流光動畫 */
        @keyframes neon-spin {
            100% { transform: rotate(360deg); }
        }
        .neon-border-glow {
            position: relative;
            overflow: hidden;
            border-radius: 1rem;
            padding: 2px; /* 邊框寬度 */
            z-index: 1;
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
        }
        .neon-border-glow::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(from 0deg, transparent 40%, #06b6d4 60%, #6366f1 80%, transparent 100%);
            animation: neon-spin 4s linear infinite;
            z-index: -2;
            pointer-events: none;
        }
        .neon-border-glow::after {
            content: '';
            position: absolute;
            inset: 2px;
            background: #0f172a;
            border-radius: calc(1rem - 2px);
            z-index: -1;
            pointer-events: none;
        }
        
        /* 3. 骨架屏漸層 Shimmer 載入 */
        @keyframes shimmer-run {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .shimmer-bg {
            background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
            background-size: 200% 100%;
            animation: shimmer-run 1.8s infinite linear;
        }
        
        /* 4. 3D 燈箱與縮放動畫 */
        .lightbox-open {
            overflow: hidden !important;
        }
        .lightbox-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(15px);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
        }
        .lightbox-backdrop.active {
            opacity: 1;
            pointer-events: auto;
        }
        .lightbox-content {
            transform: scale(0.9) rotateY(10deg);
            opacity: 0;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
            max-width: 90%;
            max-height: 80vh;
            border-radius: 1.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(99, 102, 241, 0.3);
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .lightbox-backdrop.active .lightbox-content {
            transform: scale(1) rotateY(0deg);
            opacity: 1;
        }
        
        /* 5. 漸變淡入動畫 */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
    `;
    document.head.appendChild(style);
})();

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
    
    // 🚀 Canvas 3.0 單一焦點定格化：清空以前的舊字卡，確保只有當前活躍步驟
    if (workspaceCards) {
        workspaceCards.innerHTML = '';
    }
    
    const div = document.createElement('div');
    div.className = 'skill-card w-full bg-slate-900/50 p-4 rounded-2xl border border-white/5 shadow-2xl mb-6 mx-auto relative z-10 animate-fade-in';
    div.id = 'activeControlCard';
    div.innerHTML = html;
    log.appendChild(div);
    
    // 🚀 更新頂部的任務 HUD 總覽看板
    if (typeof updateMissionHud === 'function') {
        updateMissionHud();
    }
    
    // 🎨 OiiOii SVG 流程線繪製
    if (typeof window.drawWorkflowLines === 'function') {
        setTimeout(window.drawWorkflowLines, 50);
    }

    // 💡 引導式快捷按鈕即時重繪
    if (typeof window.renderQuickReplies === 'function') {
        window.renderQuickReplies();
    }

    // 🚀 手機端自動切換至「工作區」頁籤以展示後續卡片
    if (workspaceCards) {
        const tabBtnWorkspace = document.getElementById('tabBtnWorkspace');
        if (tabBtnWorkspace && window.innerWidth < 1024) {
            tabBtnWorkspace.click();
        }
    }

    setTimeout(() => {
        if (workspaceCards) {
            const pane = document.getElementById('workspaceScrollContainer') || document.getElementById('workspacePane');
            if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
        } else {
            scrollDown();
        }
    }, 100);
    
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
                    <button id="btnMobileMediaAdd" type="button" class="flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 w-[46px] h-[46px] rounded-xl flex items-center justify-center text-lg active:scale-95 transition-all touch-manipulation" title="拍照或選取照片">
                        📸
                    </button>
                    <textarea id="agentChatInput" rows="1" class="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none resize-none max-h-32 overflow-y-auto no-scrollbar" placeholder="請透過對話讓 Agent 協助您修改 (例如：幫我把主題換成啦啦隊，Shift+Enter 換行)..."></textarea>
                    <button id="btnSendChat" class="flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-6 py-3 rounded-xl font-black text-sm shadow-[0_0_15px_rgba(79,70,229,0.5)] active:scale-95 transition-all h-[46px]">
                        <span class="hidden sm:inline">送出指令</span>
                        <span class="sm:hidden text-xl">🚀</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Right Workspace Pane -->
        <div id="workspacePane" class="hidden lg:flex flex flex-col lg:w-[60%] w-full h-full p-4 lg:p-8 relative bg-slate-900/10 z-10 overflow-hidden">
            <!-- HUD Panel (Fixed/Sticky at the top) -->
            <div id="missionHud" class="relative z-20 w-full max-w-2xl mx-auto mb-4 flex-none"></div>

            <!-- Scrollable Workspace content -->
            <div id="workspaceScrollContainer" class="flex-1 overflow-y-auto custom-scrollbar relative z-10 w-full pb-8">
                <!-- Workflow SVG Flowlines overlay -->
                <div class="absolute inset-0 pointer-events-none z-0" id="flowlineOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                    <svg class="w-full h-full" id="flowlineSvg" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none;"></svg>
                </div>
                
                <!-- Cards will render here -->
                <div id="workspaceCards" class="relative z-10 w-full max-w-2xl mx-auto space-y-16 py-8">
                    <!-- Theme Card, Draft Card, Publish Card render here -->
                </div>
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

    // Add scroll listener to workspaceScrollContainer to redraw lines on scroll
    const workspaceScrollContainer = log.querySelector('#workspaceScrollContainer');
    if (workspaceScrollContainer) {
        workspaceScrollContainer.addEventListener('scroll', () => {
            if (typeof window.drawWorkflowLines === 'function') {
                window.drawWorkflowLines();
            }
        });
    }

    // Make sure we rebind chat input events
    if (typeof window.rebindAgentChat === 'function') {
        window.rebindAgentChat();
    }

    // 🚀 手機端隨拍隨傳捷徑綁定
    const mobileMediaBtn = log.querySelector('#btnMobileMediaAdd');
    if (mobileMediaBtn) {
        mobileMediaBtn.onclick = async () => {
            if (window.FunnelActions && typeof window.FunnelActions.triggerVisualSkill === 'function') {
                await window.FunnelActions.triggerVisualSkill();
                
                // 手機端自動切換 Tab 至工作區，以便使用者直接看到上傳按鈕！
                if (tabBtnWorkspace) {
                    tabBtnWorkspace.click();
                }
                
                await addLog("系統", "🤖", "已為您切換至素材上傳畫面！請點選右側的「上傳場景圖」或「上傳人物照」按鈕拍照上傳當下照片！", true);
            } else {
                showError("目前尚未進入漏斗流程，無法上傳素材。");
            }
        };
    }

    // 🚀 初始化渲染 HUD 面板
    if (typeof updateMissionHud === 'function') {
        updateMissionHud();
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

/**
 * ==========================================
 * 📊 任務配置 HUD 總覽看板
 * ==========================================
 */
export function updateMissionHud() {
    window.updateMissionHud = updateMissionHud; // 🚀 掛載全域，方便跨模組更新
    const hud = document.getElementById('missionHud');
    if (!hud) return;

    const hasMission = MISSION.topic || MISSION.currentTaskId;
    if (!hasMission) {
        hud.innerHTML = `
            <div class="glass-panel p-4 rounded-2xl border border-white/5 flex items-center justify-between shadow-lg text-slate-400 text-xs animate-fade-in">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-slate-600"></span>
                    <span>等待建立或載入任務...</span>
                </div>
            </div>
        `;
        return;
    }

    // 取得平台圖標
    const platforms = MISSION.platforms || [];
    let platHtml = '';
    if (platforms.length > 0) {
        platHtml = '<div class="flex items-center gap-1.5">';
        platforms.forEach(p => {
            let icon = 'fa-solid fa-share-nodes';
            let colorClass = 'bg-slate-800 text-slate-400';
            if (p === 'FB') { icon = 'fa-brands fa-facebook-f'; colorClass = 'bg-blue-600/20 text-blue-400 border border-blue-500/30'; }
            else if (p === 'IG') { icon = 'fa-brands fa-instagram'; colorClass = 'bg-pink-600/20 text-pink-400 border border-pink-500/30'; }
            else if (p === 'THREADS') { icon = 'fa-solid fa-at'; colorClass = 'bg-slate-700/50 text-slate-200 border border-slate-600/40'; }
            platHtml += `<span class="w-6 h-6 rounded-md flex items-center justify-center text-xs ${colorClass}" title="${p}"><i class="${icon}"></i></span>`;
        });
        platHtml += '</div>';
    } else {
        platHtml = '<span class="text-[10px] text-slate-500">無指定平台</span>';
    }

    // 取得角色頭像
    let charsHtml = '';
    const charNames = typeof getMissionCharacterNames === 'function' ? getMissionCharacterNames() : [];
    if (charNames.length > 0) {
        charsHtml = '<div class="flex items-center -space-x-1.5">';
        charNames.forEach((c) => {
            const o = SYSTEM_DB?.characters?.find(mc => mc.name === c);
            if (o && o.imageUrl) {
                charsHtml += `<img src="${o.imageUrl}" class="w-6 h-6 rounded-full border border-indigo-500 flex-shrink-0 shadow-sm" title="${c}">`;
            } else {
                charsHtml += `<span class="text-[9px] bg-indigo-900/50 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-500/30 flex-shrink-0" title="${c}">${c}</span>`;
            }
        });
        charsHtml += '</div>';
    } else {
        charsHtml = `<span class="text-[10px] text-slate-500">無特定角色</span>`;
    }

    // 取得色系
    const isComic = MISSION.universe === 'COMIC';
    const colorLabel = isComic 
        ? (MISSION.colorMode === 'BW' ? '🏁 經典黑白' : '🌈 現代全彩')
        : (MISSION.colorMode || '原色直出');
    const panelLabel = isComic 
        ? `${MISSION.panelCount || 4}格分鏡` 
        : `寫實生圖`;

    // 當前步驟呼吸燈色彩與文字
    let stepText = "準備中";
    let pulseColor = "bg-slate-500 shadow-[0_0_8px_#64748b]";
    if (MISSION.funnelNextStep === 'visual') {
        stepText = "素材上傳中";
        pulseColor = "bg-amber-500 shadow-[0_0_8px_#f59e0b]";
    } else if (MISSION.funnelNextStep === 'draft') {
        stepText = "劇本校稿中";
        pulseColor = "bg-blue-500 shadow-[0_0_8px_#3b82f6]";
    } else if (MISSION.funnelNextStep === 'dashboard') {
        stepText = "任務發包中";
        pulseColor = "bg-purple-500 shadow-[0_0_8px_#a855f7]";
    } else if (MISSION.funnelNextStep === 'publish') {
        stepText = "生圖發佈中";
        pulseColor = "bg-green-500 shadow-[0_0_8px_#22c55e]";
    }

    hud.innerHTML = `
        <div class="glass-panel p-2.5 sm:p-3.5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 text-slate-200 text-xs transition-all duration-300 animate-fade-in">
            <!-- Glow background overlay -->
            <div class="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500 rounded-full blur-[40px] opacity-15"></div>
            
            <div class="flex-1 min-w-0 space-y-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="w-1.5 h-1.5 rounded-full ${pulseColor} animate-pulse flex-shrink-0"></span>
                    <span class="text-[9px] font-black uppercase tracking-widest text-indigo-400 whitespace-nowrap">${stepText}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono truncate max-w-[100px] sm:max-w-none" title="${MISSION.currentTaskId || 'No ID'}">${MISSION.currentTaskId || 'No ID'}</span>
                </div>
                <h2 class="text-xs sm:text-sm font-black text-white truncate pr-4" title="${MISSION.topic || '未命名任務'}">
                    ${MISSION.topic || '未命名任務'}
                </h2>
            </div>
            
            <div class="flex items-center gap-3 sm:gap-4 flex-wrap md:flex-nowrap flex-shrink-0 text-[10px] sm:text-xs">
                <!-- Specs -->
                <div class="flex items-center md:flex-col gap-1 md:gap-0.5 md:text-right">
                    <span class="text-[9px] sm:text-[10px] text-indigo-300 md:text-slate-400 font-bold">${MISSION.universe === 'COMIC' ? '🎨 動漫宇宙' : '📸 寫實宇宙'}</span>
                    <span class="text-[9px] text-slate-400 md:text-slate-500">(${panelLabel} · ${colorLabel})</span>
                </div>
                
                <div class="h-6 w-px bg-white/10 hidden md:block"></div>
                
                <!-- Characters -->
                <div class="flex items-center md:flex-col gap-1 md:gap-0.5">
                    <span class="text-[9px] sm:text-[10px] text-slate-400 font-bold block md:mb-0.5">登場人物:</span>
                    ${charsHtml}
                </div>
                
                <div class="h-6 w-px bg-white/10 hidden md:block"></div>
                
                <!-- Platforms -->
                <div class="flex items-center md:flex-col gap-1 md:gap-0.5">
                    <span class="text-[9px] sm:text-[10px] text-slate-400 font-bold block md:mb-0.5">發佈平台:</span>
                    ${platHtml}
                </div>
            </div>
        </div>
    `;
}
