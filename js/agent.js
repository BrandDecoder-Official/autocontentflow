// js/agent.js
import * as UI from './ui.js';

window.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// ⚡ 算力點數 UI 預警引擎
// ==========================================
window.updatePointsDisplay = function(points) {
    const displayEl = document.getElementById('userPointsDisplay');
    const badgeEl = document.getElementById('pointsBadge');
    if (!displayEl || !badgeEl) return;

    displayEl.innerText = points.toLocaleString();

    if (points < 100) {
        badgeEl.classList.remove('text-yellow-400', 'border-gray-600');
        badgeEl.classList.add('text-red-500', 'border-red-500', 'animate-pulse');
    } else {
        badgeEl.classList.add('text-yellow-400', 'border-gray-600');
        badgeEl.classList.remove('text-red-500', 'border-red-500', 'animate-pulse');
    }
};

// ==========================================
// 📡 全域點擊雷達
// ==========================================
window.LAST_CLICKED_EL = null;
document.addEventListener('mousedown', (e) => {
    window.LAST_CLICKED_EL = e.target.closest('button, label, select, textarea, input, .cursor-pointer, .char-item') || e.target;
}, true);

// ==========================================
// 🧠 60fps 動態神經元連線引擎
// ==========================================
window.drawNeuralLine = function(sourceEl, targetEl) {
    if (!sourceEl || !targetEl || window.innerWidth < 1024) return;
    const canvas = document.getElementById('neuralNetCanvas');
    if (!canvas) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "neural-line");
    canvas.appendChild(path);

    let animationFrameId;

    const updatePath = () => {
        const startRect = sourceEl.getBoundingClientRect();
        const endRect = targetEl.getBoundingClientRect();

        if (startRect.width === 0 || endRect.width === 0) {
            path.style.opacity = '0';
            return;
        }

        const startX = startRect.left + startRect.width / 2;
        const startY = startRect.top + startRect.height / 2;
        const endX = endRect.left;
        const endY = endRect.top + endRect.height / 2;

        const cp1X = startX + (endX - startX) * 0.5;
        const cp1Y = startY;
        const cp2X = startX + (endX - startX) * 0.5;
        const cp2Y = endY;

        path.setAttribute("d", `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`);
        animationFrameId = requestAnimationFrame(updatePath);
    };

    updatePath();

    setTimeout(() => {
        cancelAnimationFrame(animationFrameId);
        path.remove();
    }, 2500);
};

// ==========================================
// 🤖 核心大腦對話牆控制
// ==========================================
window.initAgentCapsule = function() {
    const consoleEl = document.getElementById('aiTeamConsole');
    const logEl = document.getElementById('aiTeamConsoleLog');
    const header = consoleEl?.querySelector('.flex.items-center.justify-between');
    const previewDiv = document.getElementById('aiCapsulePreview');
    
    if (!consoleEl || !logEl || consoleEl.dataset.capsuleInit) return;

    if (window.innerWidth >= 1024) {
        logEl.classList.remove('hidden');
        previewDiv?.classList.add('hidden');
        consoleEl.dataset.capsuleInit = 'true';
        return;
    }

    logEl.classList.add('hidden'); 
    previewDiv?.classList.remove('hidden');
    
    consoleEl.onclick = function(e) {
        if (window.innerWidth >= 1024) return;
        if (e.target.closest('#aiTeamConsoleLog')) return;
        
        const isCollapsed = logEl.classList.contains('hidden');
        if (isCollapsed) {
            logEl.classList.remove('hidden');
            previewDiv?.classList.add('hidden');
            header?.classList.add('mb-3', 'border-b', 'border-gray-700', 'pb-2');
            document.getElementById('capsuleToggleIcon').innerText = '👆';
        } else {
            logEl.classList.add('hidden');
            previewDiv?.classList.remove('hidden');
            header?.classList.remove('mb-3', 'border-b', 'border-gray-700', 'pb-2');
            document.getElementById('capsuleToggleIcon').innerText = '👇';
        }
    };
    consoleEl.dataset.capsuleInit = 'true';
};

window.resetAgentConsole = function() {
    const logEl = document.getElementById('aiTeamConsoleLog');
    const previewEl = document.getElementById('aiCapsulePreview');
    if (logEl) logEl.innerHTML = ''; 
    if (previewEl) previewEl.innerHTML = '等待總編下達指令...';
};

/**
 * 🌟 核心 Log 輸出
 * @param {string} isFinalSpinner - 是否在文字後方加上旋轉圖示
 */
window.addAgentLog = async function(role, icon, message, isFinalSpinner = false, sourceEl = null) {
    try {
        const logEl = document.getElementById('aiTeamConsoleLog');
        const previewEl = document.getElementById('aiCapsulePreview');
        if (!logEl) return;

        // 清除上一個旋轉圖示，確保不會轉不停
        const oldSpinners = logEl.querySelectorAll('.agent-spinner');
        oldSpinners.forEach(s => s.remove());

        const divId = `log_${Date.now()}`;
        const div = document.createElement('div');
        div.id = divId;
        div.className = 'flex items-start gap-3 animate-slide-up bg-gray-800 p-3 rounded-xl border border-gray-700 shadow-inner mt-3';
        
        div.innerHTML = `
            <div class="text-2xl flex-shrink-0 bg-gray-700 p-2 rounded-lg shadow-sm">${icon}</div>
            <div class="flex-grow flex flex-col justify-center">
                <div class="text-[11px] font-black text-gray-400 mb-1 tracking-wider">${role}</div>
                <div class="flex space-x-1 mt-1">
                    <div class="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot"></div>
                    <div class="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot"></div>
                    <div class="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot"></div>
                </div>
            </div>
        `;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight; 

        if (sourceEl) window.drawNeuralLine(sourceEl, div);
        if (previewEl) previewEl.innerHTML = `${icon} ${role}：<span class="text-gray-500">正在輸入中...</span>`;

        // 打字延遲感
        await window.sleep(Math.floor(Math.random() * 400) + 600);

        const targetDiv = document.getElementById(divId);
        if (targetDiv) {
            let spinnerHtml = isFinalSpinner ? `<svg class="agent-spinner animate-spin ml-2 h-4 w-4 text-green-400 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>` : '';
            targetDiv.innerHTML = `
                <div class="text-2xl flex-shrink-0 bg-gray-700 p-2 rounded-lg shadow-sm">${icon}</div>
                <div class="flex-grow">
                    <div class="text-[11px] font-black text-gray-400 mb-1 tracking-wider">${role}</div>
                    <div class="text-sm font-bold text-gray-100 leading-relaxed">${message}${spinnerHtml}</div>
                </div>
            `;
            logEl.scrollTop = logEl.scrollHeight; 
            if (previewEl) {
                const cleanMsg = message.replace(/<[^>]*>?/gm, '');
                previewEl.innerHTML = `${icon} ${role}：${cleanMsg}`;
            }
        }
    } catch (err) {
        console.error("Agent Log Error:", err);
    }
};

// ==========================================
// 🌟 UX 魔法：全方位行為攔截器
// ==========================================
window.initInteractions = function() {
    window.CURRENT_USER_STATE = { topic: '', reviewCaption: '', finalCaption: '' };

    // 1. 攔截比例與解析度
    ['aspectRatioSelect', 'resolutionSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async (e) => {
                const val = e.target.options[e.target.selectedIndex].text;
                const role = (id === 'aspectRatioSelect') ? '影像處理組' : '美術總監';
                const icon = (id === 'aspectRatioSelect') ? '📐' : '👨‍🎨';
                const msg = (id === 'aspectRatioSelect') ? `收到！已調整畫布比例為「${val}」。` : `了解！將以「${val}」解析度進行最終算圖。`;
                await window.addAgentLog(role, icon, msg, false, e.target);
            });
        }
    });

    // 2. 攔截平台、畫風、色彩、文字框 (您的代碼邏輯維持不變)
    // ... 此處保持您剛才貼給我的最新版本邏輯 ...
};

// 🌟 覆蓋原本的 switchMode 加入對話連動
const originalSwitchMode = UI.switchMode;
window.switchMode = async function(isComic) {
    try {
        originalSwitchMode(isComic);
        const targetEl = isComic ? document.getElementById('btnComicMode') : document.getElementById('btnStandardMode');
        const msg = isComic ? '切換至「🦸‍♂️ 動漫宇宙」引擎！' : '切換至「📸 真實攝影」引擎！';
        await window.addAgentLog('美術總監', '👨‍🎨', msg, false, targetEl);
    } catch (err) { console.error("switchMode error", err); }
};

// 🌟 覆蓋原本的 setRealSubMode 加入對話連動
const originalSetRealSubMode = window.setRealSubMode;
window.setRealSubMode = async function(mode) {
    try {
        if (typeof originalSetRealSubMode === 'function') originalSetRealSubMode(mode);
        const targetEl = document.getElementById(`btnReal${mode.charAt(0) + mode.slice(1).toLowerCase()}`);
        const descMap = {
            'INFLUENCER': '網紅模式',
            'SUPERMODEL': '超模展示',
            'ENHANCE': '原圖美化'
        };
        await window.addAgentLog('導播間', '📽️', `切換戰術策略：【${descMap[mode]}】就緒。`, false, targetEl);
    } catch (err) { console.error("setRealSubMode error", err); }
};
