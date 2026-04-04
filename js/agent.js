// js/agent.js 全代碼
import * as UI from './ui.js';

window.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 🧠 神經元連線繪製引擎 (只限 PC 端)
// ==========================================
window.drawNeuralLine = function(sourceEl, targetEl) {
    if (!sourceEl || !targetEl || window.innerWidth < 1024) return;

    const canvas = document.getElementById('neuralNetCanvas');
    if (!canvas) return;

    const startRect = sourceEl.getBoundingClientRect();
    const endRect = targetEl.getBoundingClientRect();

    // 計算起點 (來源元素的中心) 與 終點 (對話框的左側中心)
    const startX = startRect.left + startRect.width / 2;
    const startY = startRect.top + startRect.height / 2;
    const endX = endRect.left;
    const endY = endRect.top + endRect.height / 2;

    // 貝茲曲線控制點 (創造有機的柔和弧度)
    const cp1X = startX + (endX - startX) * 0.5;
    const cp1Y = startY;
    const cp2X = startX + (endX - startX) * 0.5;
    const cp2Y = endY;

    const pathData = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("class", "neural-line");
    
    canvas.appendChild(path);

    // 4秒後自動移除 DOM 節點
    setTimeout(() => path.remove(), 4000);
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

    // 🧠 觸發神經元連線 (在對話框生成的瞬間)
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
// 🌟 UX 魔法：全方位行為攔截器 (Action-Driven UI)
// ==========================================
window.initInteractions = function() {
    window.CURRENT_USER_STATE = { topic: '' };

    // 1. 攔截比例與解析度切換
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

    // 2. 監聽發布平台勾選
    ['platFB', 'platIG', 'platThreads'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async (e) => {
                const platform = e.target.nextElementSibling.innerText.trim();
                const msg = e.target.checked ? `已為您鎖定 ${platform} 平台！` : `已取消 ${platform} 的發布設定。`;
                await window.addAgentLog('社群總監', '🚀', msg, false, e.target);
            });
        }
    });

    // 3. 監聽畫風選擇 (動態 Radio)
    const styleContainer = document.getElementById('styleRadioContainer');
    if (styleContainer) {
        styleContainer.addEventListener('change', async (e) => {
            if (e.target.name === 'targetStyle') {
                const styleName = e.target.nextElementSibling.innerText.trim();
                await window.addAgentLog('美術總監', '👨‍🎨', `載入「${styleName}」風格模型成功！`, false, e.target);
            }
        });
    }

    // 4. 監聽色彩模式
    document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const modeName = e.target.value === 'BW' ? '經典黑白網點' : '🌈 彩色';
            await window.addAgentLog('美術總監', '👨‍🎨', `色彩模式已切換至「${modeName}」。`, false, e.target);
        });
    });

    // 5. 腳本主題輸入
    const topicInput = document.getElementById('topic');
    if (topicInput) {
        topicInput.addEventListener('blur', async (e) => {
            const val = e.target.value.trim();
            if (val && val !== window.CURRENT_USER_STATE.topic) {
                window.CURRENT_USER_STATE.topic = val;
                await window.addAgentLog('專案總監', '👨‍💼', `主題內容更新成功，我已同步至任務卷宗。`, false, e.target);
            }
        });
    }
};

// 重新包裝原本的 UI 函數 (攔截器)
const originalSwitchMode = UI.switchMode;
window.switchMode = async function(isComic) {
    originalSwitchMode(isComic);
    const targetEl = isComic ? document.getElementById('btnComicMode') : document.getElementById('btnStandardMode');
    const msg = isComic ? '切換至「🦸‍♂️ 動漫宇宙」引擎！' : '切換至「📸 真實攝影」引擎！';
    await window.addAgentLog('美術總監', '👨‍🎨', msg, false, targetEl);
};
