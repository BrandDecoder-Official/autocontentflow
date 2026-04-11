  // js/agent_v9_core.js
import { STATE } from './config.js';

// 🚀 任務卷宗 (漏斗數據中心)
const MISSION_DATA = {
    platforms: [],
    topic: '',
    mode: '',
    step: 'START'
};

/**
 * 🛠️ 核心：初始化代理人漏斗
 */
export async function initAgentFunnel() {
    console.log("🚀 BrandDecoder V9 Agent Funnel 啟動...");
    
    // 1. 抓取 UI 元素
    const inputEl = document.getElementById('agentInput');
    const btnSend = document.getElementById('btnSend');
    
    // 2. 初始對話引導
    await addAgentMessage("專案總監", "👨‍💼", "總編您好！我是您的數位代理人。BrandDecoder V9 系統已就緒，準備開始新的內容漏斗。");
    
    // 3. 觸發第一個 Skill: 平台選擇
    await triggerPlatformSkill();
}

/**
 * 📡 Skill: 平台選擇組件 (互動式按鈕)
 */
async function triggerPlatformSkill() {
    const funnelLog = document.getElementById('funnelLog');
    
    await addAgentMessage("社群總監", "🚀", "首先，請鎖定本次內容的發布平台：", true);

    // 🌟 注入富交互組件 (Rich Component)
    const skillDiv = document.createElement('div');
    skillDiv.className = 'flex gap-3 animate-fade-in p-4 bg-slate-800/50 rounded-2xl border border-blue-500/30';
    skillDiv.innerHTML = `
        <button class="plat-btn px-4 py-2 rounded-xl border border-slate-600 hover:bg-blue-600 transition-all font-bold" data-val="FB">Facebook</button>
        <button class="plat-btn px-4 py-2 rounded-xl border border-slate-600 hover:bg-pink-600 transition-all font-bold" data-val="IG">Instagram</button>
        <button class="plat-btn px-4 py-2 rounded-xl border border-slate-600 hover:bg-slate-700 transition-all font-bold" data-val="THREADS">Threads</button>
        <button id="btnPlatConfirm" class="ml-auto px-6 py-2 bg-blue-500 text-white rounded-xl font-black shadow-lg hover:scale-105 transition-all">確認鎖定</button>
    `;
    
    funnelLog.appendChild(skillDiv);
    scrollDown();

    // 處理點擊邏輯
    const btns = skillDiv.querySelectorAll('.plat-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('bg-blue-600');
            btn.classList.toggle('border-blue-400');
        };
    });

    document.getElementById('btnPlatConfirm').onclick = async function() {
        const selected = Array.from(skillDiv.querySelectorAll('.plat-btn.bg-blue-600')).map(b => b.dataset.val);
        if (selected.length === 0) return alert("請至少選擇一個平台！");

        MISSION_DATA.platforms = selected;
        // 鎖定組件，讓它變灰不可再點
        skillDiv.style.opacity = "0.5";
        skillDiv.style.pointerEvents = "none";
        
        await addAgentMessage("社群總監", "✅", `已鎖定平台：${selected.join(', ')}。`);
        
        // 進入下一步：解鎖輸入框拿主題
        unlockInputForTopic();
    };
}

/**
 * 🔓 解鎖輸入框：獲取主題
 */
async function unlockInputForTopic() {
    const inputEl = document.getElementById('agentInput');
    const btnSend = document.getElementById('btnSend');

    await addAgentMessage("專案總監", "👨‍💼", "接下來，請在下方輸入框告訴我今天的貼文主題。");

    // 💡 解鎖與 Focus
    inputEl.disabled = false;
    inputEl.classList.remove('locked-input');
    inputEl.placeholder = "請輸入主題細節...";
    inputEl.focus();
    btnSend.classList.remove('opacity-50', 'cursor-not-allowed');

    btnSend.onclick = async () => {
        const val = inputEl.value.trim();
        if (!val) return;

        MISSION_DATA.topic = val;
        
        // 💡 再次鎖定
        inputEl.value = "";
        inputEl.disabled = true;
        inputEl.classList.add('locked-input');
        inputEl.placeholder = "正在解析主題...";
        btnSend.classList.add('opacity-50', 'cursor-not-allowed');

        await addAgentMessage("總編指令", "🗣️", val);
        await addAgentMessage("首席文案", "✍️", "收到！主題已進入卷宗。正在調度「Skills 影像建議包」進行適配性分析...");
        
        // 此處後續會接：模式選擇建議 Skill...
    };
}

/**
 * 🖋️ 視覺效果：增加 Agent 對話
 */
async function addAgentMessage(role, icon, message, skipTyping = false) {
    const log = document.getElementById('funnelLog');
    const id = `msg_${Date.now()}`;
    
    const div = document.createElement('div');
    div.className = 'flex items-start gap-4 mb-4';
    div.innerHTML = `
        <div class="text-3xl">${icon}</div>
        <div class="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-white/5 max-w-[80%]">
            <div class="text-[10px] font-black text-slate-500 mb-1 uppercase">${role}</div>
            <div id="${id}" class="text-sm leading-relaxed">${skipTyping ? message : '...'}</div>
        </div>
    `;
    log.appendChild(div);
    scrollDown();

    if (!skipTyping) {
        await new Promise(r => setTimeout(r, 600));
        document.getElementById(id).innerText = message;
    }
}

function scrollDown() {
    const log = document.getElementById('funnelLog');
    log.scrollTop = log.scrollHeight;
}
