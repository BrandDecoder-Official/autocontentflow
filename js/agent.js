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

    // 更新點數數字 (加上千分位逗號)
    displayEl.innerText = points.toLocaleString();

    // 算力見底預警：低於 100 點時亮紅燈閃爍
    if (points < 100) {
        badgeEl.classList.remove('text-yellow-400', 'border-gray-600');
        badgeEl.classList.add('text-red-500', 'border-red-500', 'animate-pulse');
    } else {
        badgeEl.classList.add('text-yellow-400', 'border-gray-600');
        badgeEl.classList.remove('text-red-500', 'border-red-500', 'animate-pulse');
    }
};

// ==========================================
// 📡 全域點擊雷達 (抓取實體目標，破解幽靈按鈕)
// ==========================================
window.LAST_CLICKED_EL = null;
document.addEventListener('mousedown', (e) => {
    // 優先抓取最近的可視互動元件 (包含文字框、按鈕、選單、卡片)
    window.LAST_CLICKED_EL = e.target.closest('button, label, select, textarea, input, .cursor-pointer, .char-item') || e.target;
}, true);

// ==========================================
// 🧠 60fps 動態神經元連線引擎 (requestAnimationFrame)
// ==========================================
window.drawNeuralLine = function(sourceEl, targetEl) {
    if (!sourceEl || !targetEl || window.innerWidth < 1024) return;
    const canvas = document.getElementById('neuralNetCanvas');
    if (!canvas) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "neural-line");
    canvas.appendChild(path);

    let animationFrameId;

    // 引擎核心：每秒 60 次更新座標，自動追蹤捲動
    const updatePath = () => {
        const startRect = sourceEl.getBoundingClientRect();
        const endRect = targetEl.getBoundingClientRect();

        // 若元素消失或寬度為 0，隱藏線條並提前結束
        if (startRect.width === 0 || endRect.width === 0) {
            path.style.opacity = '0';
            return;
        }

        // 起點：點擊元件的中心點
        const startX = startRect.left + startRect.width / 2;
        const startY = startRect.top + startRect.height / 2;
        // 終點：AI 氣泡的左側中心點
        const endX = endRect.left;
        const endY = endRect.top + endRect.height / 2;

        // 貝茲曲線控制點 (創造有機的柔和弧度)
        const cp1X = startX + (endX - startX) * 0.5;
        const cp1Y = startY;
        const cp2X = startX + (endX - startX) * 0.5;
        const cp2Y = endY;

        path.setAttribute("d", `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`);
        animationFrameId = requestAnimationFrame(updatePath);
    };

    // 啟動引擎
    updatePath();

    // 拔插頭機制：2.5 秒後自動銷毀引擎與畫布物件，釋放記憶體，確保 0 負擔
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
    const header = consoleEl.querySelector('.flex.items-center.justify-between');
    const previewDiv = document.getElementById('aiCapsulePreview');
    
    if (!consoleEl || !logEl || consoleEl.dataset.capsuleInit) return;

    if (window.innerWidth >= 1024) {
        logEl.classList.remove('hidden');
        previewDiv.classList.add('hidden');
        consoleEl.dataset.capsuleInit = 'true';
        return;
    }

    logEl.classList.add('hidden'); 
    previewDiv.classList.remove('hidden');
    consoleEl.classList.add('cursor-pointer', 'hover:border-gray-500', 'p-3', 'px-4');
    consoleEl.classList.remove('p-5');
    header.classList.remove('mb-4', 'border-b', 'border-gray-700', 'pb-3');
    
    consoleEl.onclick = function(e) {
        if (window.innerWidth >= 1024) return;
        if (e.target.closest('#aiTeamConsoleLog')) return;
        
        const isCollapsed = logEl.classList.contains('hidden');
        if (isCollapsed) {
            logEl.classList.remove('hidden');
            previewDiv.classList.add('hidden');
            header.classList.add('mb-3', 'border-b', 'border-gray-700', 'pb-2');
            consoleEl.classList.remove('p-3', 'px-4');
            consoleEl.classList.add('p-4');
            document.getElementById('capsuleToggleIcon').innerText = '👆';
            logEl.scrollTop = logEl.scrollHeight;
        } else {
            logEl.classList.add('hidden');
            previewDiv.classList.remove('hidden');
            header.classList.remove('mb-3', 'border-b', 'border-gray-700', 'pb-2');
            consoleEl.classList.add('p-3', 'px-4');
            consoleEl.classList.remove('p-4');
            document.getElementById('capsuleToggleIcon').innerText = '👇';
        }
    };
    consoleEl.dataset.capsuleInit = 'true';
};

window.resetAgentConsole = function() {
    const consoleEl = document.getElementById('aiTeamConsole');
    const logEl = document.getElementById('aiTeamConsoleLog');
    const previewEl = document.getElementById('aiCapsulePreview');
    if (consoleEl && logEl) {
        logEl.innerHTML = ''; 
        if (previewEl) previewEl.innerHTML = '等待總編下達指令...';
    }
};

window.addAgentLog = async function(role, icon, message, isFinalSpinner = false, sourceEl = null) {
    const logEl = document.getElementById('aiTeamConsoleLog');
    const previewEl = document.getElementById('aiCapsulePreview');
    if (!logEl) return;

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

    // 🧠 發射追蹤連線！
    if (sourceEl) {
        window.drawNeuralLine(sourceEl, div);
    }

    if (previewEl) previewEl.innerHTML = `${icon} ${role}：<span class="text-gray-500">正在輸入中...</span>`;

    const typingTime = Math.floor(Math.random() * 400) + 600;
    await window.sleep(typingTime);

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
};

// ==========================================
// 🌟 UX 魔法：全方位行為攔截器
// ==========================================
window.initInteractions = function() {
    window.CURRENT_USER_STATE = { 
        topic: '',
        reviewCaption: '',
        finalCaption: ''
    };

    // 1. 攔截比例與解析度
    ['aspectRatioSelect', 'resolutionSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async (e) => {
                const val = e.target.options[e.target.selectedIndex].text;
                if (id === 'aspectRatioSelect') {
                    await window.addAgentLog('影像處理組', '📐', `收到！已調整畫布比例為「${val}」。`, false, e.target);
                } else {
                    await window.addAgentLog('美術總監', '👨‍🎨', `了解！將以「${val}」解析度進行最終算圖輸出。`, false, e.target);
                }
            });
        }
    });

    // 2. 攔截社群平台
    ['platFB', 'platIG', 'platThreads'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async (e) => {
                const platform = e.target.nextElementSibling.innerText.trim();
                const msg = e.target.checked ? `已為您鎖定 ${platform} 平台！` : `已取消 ${platform} 的發布設定。`;
                await window.addAgentLog('社群總監', '🚀', msg, false, window.LAST_CLICKED_EL || e.target);
            });
        }
    });

    // 3. 攔截畫風
    const styleContainer = document.getElementById('styleRadioContainer');
    if (styleContainer) {
        styleContainer.addEventListener('change', async (e) => {
            if (e.target.name === 'targetStyle') {
                const styleName = e.target.nextElementSibling.innerText.trim();
                await window.addAgentLog('美術總監', '👨‍🎨', `載入「${styleName}」風格模型成功！`, false, window.LAST_CLICKED_EL || e.target);
            }
        });
    }

    // 4. 攔截色彩模式
    document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const modeName = e.target.value === 'BW' ? '經典黑白網點' : '🌈 彩色';
            await window.addAgentLog('美術總監', '👨‍🎨', `色彩模式已切換至「${modeName}」。`, false, window.LAST_CLICKED_EL || e.target);
        });
    });

    // 5. 攔截文字框 (第一步、第二步、第三步)
    const textareas = [
        { id: 'topic', stateKey: 'topic', role: '專案總監', icon: '👨‍💼', msg: '主題內容更新成功，我已同步至任務卷宗。' },
        { id: 'reviewCaption', stateKey: 'reviewCaption', role: '首席文案', icon: '✍️', msg: '腳本文字已收到您的微調，準備以此發包生圖。' },
        { id: 'finalCaptionDisplay', stateKey: 'finalCaption', role: '社群總監', icon: '🚀', msg: '最終發文文字已鎖定！我們隨時可以發射。' }
    ];

    textareas.forEach(t => {
        const el = document.getElementById(t.id);
        if (el) {
            el.addEventListener('blur', async (e) => {
                const val = e.target.value.trim();
                if (val && val !== window.CURRENT_USER_STATE[t.stateKey]) {
                    window.CURRENT_USER_STATE[t.stateKey] = val;
                    await window.addAgentLog(t.role, t.icon, t.msg, false, window.LAST_CLICKED_EL || e.target);
                }
            });
        }
    });

    // 6. 攔截排程時間 (Step 3)
    const scheduleEl = document.getElementById('scheduleTime');
    if (scheduleEl) {
        scheduleEl.addEventListener('change', async (e) => {
            const val = e.target.value;
            if (val) {
                const dateStr = new Date(val).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                await window.addAgentLog('系統管理員', '🗓️', `排程時間已設定為「${dateStr}」，機器人將於該時間自動喚醒發布。`, false, window.LAST_CLICKED_EL || e.target);
            } else {
                await window.addAgentLog('系統管理員', '🗓️', `排程已取消，將改為「立即發射」模式。`, false, window.LAST_CLICKED_EL || e.target);
            }
        });
    }
};

// 重新包裝原本的 UI 函數
const originalSwitchMode = UI.switchMode;
window.switchMode = async function(isComic) {
    originalSwitchMode(isComic);
    const targetEl = isComic ? document.getElementById('btnComicMode') : document.getElementById('btnStandardMode');
    const msg = isComic ? '切換至「🦸‍♂️ 動漫宇宙」引擎！' : '切換至「📸 真實攝影」引擎！';
    await window.addAgentLog('美術總監', '👨‍🎨', msg, false, targetEl);
};
