// js/agent.js
import * as UI from './ui.js';

// ==========================================
// 🤖 共用工具
// ==========================================
window.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 🤖 核心大腦對話牆控制 (PC側邊欄 / 手機動態膠囊)
// ==========================================
window.initAgentCapsule = function() {
    const consoleEl = document.getElementById('aiTeamConsole');
    const logEl = document.getElementById('aiTeamConsoleLog');
    const header = consoleEl.querySelector('.flex.items-center.justify-between');
    const previewDiv = document.getElementById('aiCapsulePreview');
    
    // 如果找不到元素，或已經初始化過，就跳出
    if (!consoleEl || !logEl || consoleEl.dataset.capsuleInit) return;

    // 🖥️ PC 電腦端 (寬度 >= 1024px)：直接保持展開，不啟動膠囊邏輯
    if (window.innerWidth >= 1024) {
        logEl.classList.remove('hidden');
        previewDiv.classList.add('hidden');
        consoleEl.dataset.capsuleInit = 'true';
        return;
    }

    // 📱 手機端：調整外觀，預設為收合 (膠囊) 狀態
    logEl.classList.add('hidden'); 
    previewDiv.classList.remove('hidden');
    consoleEl.classList.add('cursor-pointer', 'hover:border-gray-500', 'p-3', 'px-4');
    consoleEl.classList.remove('p-5');
    header.classList.remove('mb-4', 'border-b', 'border-gray-700', 'pb-3');
    
    // 點擊展開/收合邏輯
    consoleEl.onclick = function(e) {
        // 如果使用者把視窗拉大變 PC 版，關閉點擊功能
        if (window.innerWidth >= 1024) return;
        // 避免點到對話紀錄內部觸發收合
        if (e.target.closest('#aiTeamConsoleLog')) return;
        
        const isCollapsed = logEl.classList.contains('hidden');
        if (isCollapsed) {
            // 展開
            logEl.classList.remove('hidden');
            previewDiv.classList.add('hidden');
            header.classList.add('mb-3', 'border-b', 'border-gray-700', 'pb-2');
            consoleEl.classList.remove('p-3', 'px-4');
            consoleEl.classList.add('p-4');
            document.getElementById('capsuleToggleIcon').innerText = '👆';
            logEl.scrollTop = logEl.scrollHeight;
        } else {
            // 收合
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
        consoleEl.classList.remove('hidden');
        logEl.innerHTML = ''; 
        if (previewEl) previewEl.innerHTML = '等待總編下達指令...';
    }
};

window.addAgentLog = async function(role, icon, message, isFinalSpinner = false) {
    const logEl = document.getElementById('aiTeamConsoleLog');
    const previewEl = document.getElementById('aiCapsulePreview');
    
    if (!logEl) return;

    // 清除上一個人的 spinner 轉圈圈
    const oldSpinners = logEl.querySelectorAll('.agent-spinner');
    oldSpinners.forEach(s => s.remove());

    const divId = `log_${Date.now()}`;
    const div = document.createElement('div');
    div.id = divId;
    div.className = 'flex items-start gap-3 animate-slide-up bg-gray-800 p-3 rounded-xl border border-gray-700 shadow-inner mt-3';
    
    // 1. 先顯示正在輸入的跳動點點特效
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

    // 同步更新膠囊預覽文字為輸入中
    if (previewEl) {
        previewEl.innerHTML = `${icon} ${role}：<span class="text-gray-500">正在輸入中...</span>`;
    }

    // 2. 模擬真人打字時間 (0.8秒 ~ 1.2秒)
    const typingTime = Math.floor(Math.random() * 400) + 800;
    await window.sleep(typingTime);

    // 3. 替換成真實對話內容
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
        
        // 同步更新膠囊預覽文字為最終訊息 (濾掉 HTML 標籤)
        if (previewEl) {
            const cleanMsg = message.replace(/<[^>]*>?/gm, '');
            previewEl.innerHTML = `${icon} ${role}：${cleanMsg}`;
        }
    }
};

window.hideAgentConsole = function() {
    // 刻意留空：膠囊永遠常駐
};


// ==========================================
// 🌟 UX 魔法：行為驅動對話 (Action-Driven UI)
// ==========================================

// 1. 攔截畫風模式切換
const originalSwitchMode = UI.switchMode;
window.switchMode = async function(isComic) {
    originalSwitchMode(isComic);
    if (isComic) {
        await window.addAgentLog('美術總監', '👨‍🎨', '已切換至「🦸‍♂️ 動漫宇宙」引擎，隨時準備載入專屬渲染風格！');
    } else {
        await window.addAgentLog('美術總監', '👨‍🎨', '已切換至「📸 真實攝影」引擎，將為您生成高質感實境照片！');
    }
};

// 2. 攔截實境/道具圖片上傳
const originalHandleFileSelect = UI.handleFileSelect;
window.handleFileSelect = async function(input, type, max, previewId) {
    originalHandleFileSelect(input, type, max, previewId);
    if (input.files && input.files.length > 0) {
        if (type === 'scene') {
            await window.addAgentLog('影像處理組', '📐', '收到實境背景圖！我先放在暫存區備用，等待融合指令。');
        } else if (type === 'object') {
            await window.addAgentLog('影像處理組', '📐', '收到道具/商品圖！這會讓畫面細節更豐富。');
        }
    }
};

// 3. 註冊其他所有表單互動的狀態監視器
window.initInteractions = function() {
    // 狀態記憶體：用來防洗頻
    window.CURRENT_USER_STATE = {
        topic: ''
    };

    // 監聽：發布平台勾選
    ['platFB', 'platIG', 'platThreads'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', async (e) => {
                const platform = e.target.nextElementSibling.innerText.trim();
                if (e.target.checked) {
                    await window.addAgentLog('社群總監', '🚀', `已為您鎖定 ${platform} 平台，準備套用專屬排版規範。`);
                } else {
                    await window.addAgentLog('社群總監', '🚀', `已取消 ${platform} 發佈設定。`);
                }
            });
        }
    });

    // 監聽：畫風選擇 (Delegate 綁定，因為是動態生成的 radio)
    const styleContainer = document.getElementById('styleRadioContainer');
    if (styleContainer) {
        styleContainer.addEventListener('change', async (e) => {
            if (e.target.name === 'targetStyle') {
                const styleName = e.target.nextElementSibling.innerText.trim();
                await window.addAgentLog('美術總監', '👨‍🎨', `了解！已載入「${styleName}」渲染模型，期待接下來的視覺表現！`);
            }
        });
    }

    // 監聽：色彩模式 (彩色/黑白)
    document.querySelectorAll('input[name="colorMode"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.value === 'BW') {
                await window.addAgentLog('美術總監', '👨‍🎨', '收到！已切換為「經典黑白網點」模式，準備為您加上充滿張力的墨線。');
            } else {
                await window.addAgentLog('美術總監', '👨‍🎨', '沒問題，我們換回「🌈 彩色」模式，保持高飽和度的視覺衝擊！');
            }
        });
    });

    // 監聽：腳本主題 Input Blur (失去焦點時判斷是否改變)
    const topicInput = document.getElementById('topic');
    if (topicInput) {
        topicInput.addEventListener('blur', async (e) => {
            const val = e.target.value.trim();
            // 只有在真的有打字，且內容跟上次不一樣時，才觸發回應
            if (val && val !== window.CURRENT_USER_STATE.topic) {
                window.CURRENT_USER_STATE.topic = val;
                const shortVal = val.length > 15 ? val.substring(0, 15) + '...' : val;
                await window.addAgentLog('專案總監', '👨‍💼', `收到主題！「${shortVal}」這個情境非常有畫面感，我已記錄在案。`);
            }
        });
    }
};
