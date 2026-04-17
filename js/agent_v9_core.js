// js/agent_v9_core.js
import { STATE, CONFIG } from './config.js';
import { APP_VERSION, MISSION } from './v9_state.js';
import { updateStepHeader, addLog, showError } from './v9_ui.js';

// 📦 引入專屬模組
import { initAgentChatBar } from './v9_chat.js';
import { startNewFunnel, renderDraftEditorCard, renderFinalPublishCard } from './v9_funnel.js';
import './v9_sidebar.js'; // 側欄

export { bootSystemData } from './v9_state.js';

// ==========================================
// 🚀 核心入口：初始化 (Lobby 渲染) - 被首頁呼叫
// ==========================================
export async function initAgentFunnel() {
    renderLobby();
}

// 🚀 監聽來自漏斗的「重啟大廳」事件 (解決互相引用的終極解法)
window.addEventListener('reloadLobby', () => {
    initAgentFunnel();
});

// ==========================================
// 🚀 狀態變數：控制目前所在的頁籤
// ==========================================
window.currentTaskTab = 'PENDING'; // 預設顯示進行中

// ==========================================
// 🎨 大廳畫面渲染
// ==========================================
function renderLobby() {
    const log = document.getElementById('funnelLog');
    // 初始化 MISSION 暫存 (將平台清空，等待漏斗寫入)
    Object.assign(MISSION, { persona: '', hookType: '', platforms: [], topic: '', currentTaskId: null });
    
    log.innerHTML = `
        <div class="max-w-5xl mx-auto mt-4 lg:mt-10 animate-fade-in space-y-6 lg:space-y-8">
            <div class="text-center space-y-2 mb-6">
                <h2 class="text-2xl lg:text-3xl font-black text-white tracking-tight">讓夢想在對話中落地</h2>
                <p class="text-xs text-slate-400">當前指揮官：<span class="text-blue-400 font-bold">總編 K.C</span></p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-8">
                <div class="bg-slate-800/50 border border-indigo-500/30 rounded-3xl p-6 lg:p-8 hover:bg-slate-800 transition-all cursor-not-allowed group relative flex flex-col h-full opacity-60">
                    <div class="absolute top-0 right-0 bg-indigo-600 text-[10px] font-black px-3 py-1 rounded-bl-xl tracking-widest uppercase">Auto-Pilot</div>
                    <div class="text-4xl mb-4">🤖</div>
                    <h3 class="text-lg font-black text-white mb-2">全自動巡航模式</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">Agent 根據品牌基因，自動抓取時事並生成草稿。(開發中)</p>
                </div>

                <div class="bg-blue-600/10 border border-blue-500/50 rounded-3xl p-6 lg:p-8 transition-all cursor-pointer group shadow-[0_0_30px_rgba(59,130,246,0.15)] flex flex-col h-full active:scale-95" id="btnManualStart">
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">✍️</div>
                    <h3 class="text-lg font-black text-white mb-2">發起實戰任務</h3>
                    <p class="text-xs text-slate-400 mb-6 leading-relaxed">從主題、平台到人設，親手建構您的獲利閉環。</p>
                    <button class="mt-auto w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">🚀 啟動全新漏斗</button>
                </div>
            </div>

            <div id="taskDashboardArea" class="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div class="flex items-center justify-between px-4 lg:px-6 py-4 border-b border-white/5 bg-white/5">
                    <div class="flex gap-4 lg:gap-6">
                        <button onclick="switchTaskTab('PENDING')" id="tabPending" class="text-sm font-black transition-colors text-blue-400 border-b-2 border-blue-400 pb-1">⚡ 進行中任務</button>
                        <button onclick="switchTaskTab('COMPLETED')" id="tabCompleted" class="text-sm font-black transition-colors text-slate-500 hover:text-white pb-1 border-b-2 border-transparent">✅ 歷史紀錄</button>
                    </div>
                    <button onclick="renderTaskDashboard()" class="text-xs text-slate-400 hover:text-white flex items-center gap-1"><i class="fa-solid fa-rotate"></i> <span class="hidden sm:inline">刷新</span></button>
                </div>

                <div id="taskListContainer" class="p-4 lg:p-6 space-y-4 min-h-[300px]">
                    <div class="text-center py-10"><div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"></div></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btnManualStart').onclick = async () => { 
        const log = document.getElementById('funnelLog');
        log.innerHTML = ''; 
        await addLog("系統", "🚀", `正在啟動 V10 核心漏斗...`); 
        await startNewFunnel();
    };

    renderTaskDashboard();
}

// 頁籤切換邏輯
window.switchTaskTab = function(tabName) {
    window.currentTaskTab = tabName;
    
    // 更新 UI 樣式
    const tabP = document.getElementById('tabPending');
    const tabC = document.getElementById('tabCompleted');
    
    if (tabName === 'PENDING') {
        tabP.className = "text-sm font-black transition-colors text-blue-400 border-b-2 border-blue-400 pb-1";
        tabC.className = "text-sm font-black transition-colors text-slate-500 hover:text-white pb-1 border-b-2 border-transparent";
    } else {
        tabC.className = "text-sm font-black transition-colors text-emerald-400 border-b-2 border-emerald-400 pb-1";
        tabP.className = "text-sm font-black transition-colors text-slate-500 hover:text-white pb-1 border-b-2 border-transparent";
    }
    
    // 重新渲染列表
    renderTaskDashboard();
}

// ==========================================
// 📋 任務儀表板與斷點續傳 (去重後保留最完整版)
// ==========================================
window.renderTaskDashboard = async function() {
    const container = document.getElementById('taskListContainer');
    if(!container) return;
    
    container.innerHTML = '<div class="text-center py-10"><div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block"></div></div>';
    
    try {
        const baseUrl = CONFIG.CLOUD_RUN_URL.replace(/\/$/, '');
        const currentTenantId = STATE.uid || 'user_chief_001';
        
        const response = await fetch(`${baseUrl}/api/agent/tasks/${currentTenantId}`);
        const data = await response.json();
        
        if (!data.success) throw new Error(data.message);

        // 💡 1. 預先過濾掉沒有主題的「垃圾草稿」
        let validTasks = data.tasks.filter(t => t.missionContext && t.missionContext.topic);

        // 💡 2. 依照當前頁籤進行狀態過濾
        if (window.currentTaskTab === 'PENDING') {
            validTasks = validTasks.filter(t => t.currentStatus !== 'COMPLETED');
        } else {
            validTasks = validTasks.filter(t => t.currentStatus === 'COMPLETED');
        }
        
        if (validTasks.length === 0) {
            const emptyMsg = window.currentTaskTab === 'PENDING' ? '指揮官，目前沒有進行中的任務。' : '目前尚無已發佈的歷史紀錄。';
            container.innerHTML = `<div class="text-slate-500 text-xs text-center py-12 flex flex-col items-center gap-3"><i class="fa-solid fa-inbox text-3xl opacity-50"></i><span>${emptyMsg}</span></div>`;
            return;
        }

        let html = '';
        window.tempTaskCache = validTasks; // 存入 Cache 供後續調用

        // 時間倒序排列
        validTasks.sort((a, b) => {
            let timeA = a.updatedAt?._seconds ? a.updatedAt._seconds * 1000 : new Date(a.updatedAt || 0).getTime();
            let timeB = b.updatedAt?._seconds ? b.updatedAt._seconds * 1000 : new Date(b.updatedAt || 0).getTime();
            return timeB - timeA;
        }).forEach((task, index) => {
            
            const topic = task.missionContext.topic; // 已經保證有值

            // 🛠️ 強健的時間解析
            let validDate = new Date();
            if (task.updatedAt) {
                if (task.updatedAt._seconds) validDate = new Date(task.updatedAt._seconds * 1000);
                else validDate = new Date(task.updatedAt);
            }
            if (isNaN(validDate.getTime()) && task.taskId) {
                const parts = task.taskId.split('_');
                const possibleTime = parseInt(parts[parts.length - 1]);
                if (!isNaN(possibleTime)) validDate = new Date(possibleTime);
            }
            let timeStr = !isNaN(validDate.getTime()) ? validDate.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未知時間';

            // 🧠 狀態與進度條判定
            let statusColor, statusText, actionText, icon, progressPct, barColor;
            switch(task.currentStatus) {
                case 'COMPLETED': 
                    statusColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'; statusText = '已發佈完成'; actionText = '查看成品'; icon = '✅'; progressPct = 100; barColor = 'bg-emerald-500'; break;
                case 'AWAITING_APPROVAL': 
                    statusColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'; statusText = '等候總編校稿'; actionText = '接續校稿'; icon = '👀'; progressPct = 50; barColor = 'bg-yellow-500'; break;
                case 'IMAGES_GENERATED': 
                    statusColor = 'text-blue-400 bg-blue-400/10 border-blue-400/20'; statusText = '等候確認發佈'; actionText = '接續發佈'; icon = '🖼️'; progressPct = 85; barColor = 'bg-blue-500'; break;
                case 'ERROR': 
                    statusColor = 'text-red-400 bg-red-400/10 border-red-400/20'; statusText = '發生錯誤中斷'; actionText = '重試任務'; icon = '🔴'; progressPct = 100; barColor = 'bg-red-500'; break;
                default: 
                    statusColor = 'text-purple-400 bg-purple-400/10 border-purple-400/20'; statusText = '大腦運算中...'; actionText = '強制載入'; icon = '🧠'; progressPct = 25; barColor = 'bg-purple-500 animate-pulse'; break;
            }

            // 🎨 UI 組裝 (結合雙按鈕與進度條)
            html += `
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/30 p-4 rounded-xl transition-all group gap-4 relative overflow-hidden shadow-lg">
                    
                    <div class="absolute bottom-0 left-0 h-1 w-full bg-slate-900">
                        <div class="h-full ${barColor} transition-all duration-1000" style="width: ${progressPct}%;"></div>
                    </div>

                    <div class="flex flex-col gap-2 w-full sm:w-auto overflow-hidden pl-1 pb-1">
                        <div class="flex items-start gap-2">
                            <span class="text-sm mt-0.5">${icon}</span>
                            <span class="text-base font-black text-white truncate max-w-[280px] sm:max-w-[400px] tracking-wide" title="${topic}">${topic}</span>
                        </div>
                        <div class="flex items-center gap-3 text-xs">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusColor} border">
                                ${statusText}
                            </span>
                            <span class="text-slate-400 font-mono text-[10px]">
                                ${timeStr}
                            </span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-shrink-0 mt-2 sm:mt-0 z-10">
                        <button onclick="resumeTask(${index})" class="flex-1 sm:flex-none justify-center bg-indigo-600/90 hover:bg-indigo-500 text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95">
                            📝 ${actionText}
                        </button>
                        <button onclick="deleteTask('${task.taskId}')" class="bg-slate-700/60 hover:bg-red-500/80 text-slate-300 hover:text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95" title="刪除此任務">
                            🗑️ 刪除
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-red-400 text-xs text-center py-4">連線中斷: ${error.message}</p>`;
    }
}

// ==========================================
// 🗑️ 刪除任務功能
// ==========================================
window.deleteTask = async function(taskId) {
    if (!confirm('總編，確定要刪除這筆任務嗎？\n(刪除後將無法恢復)')) return;
    
    console.log(`[任務控制台] 準備刪除任務: ${taskId}`);
    alert(`任務 ${taskId} 刪除 API 準備串接中...`);
}

// ==========================================
// 🔄 恢復/接續 任務功能
// ==========================================
window.resumeTask = async function(taskIndex) {
    const task = window.tempTaskCache[taskIndex];
    if(!task) return showError("任務資料遺失！");

    const log = document.getElementById('funnelLog');
    log.innerHTML = ''; 
    
    MISSION.currentTaskId = task.taskId;
    MISSION.topic = task.missionContext?.topic || '';
    MISSION.universe = task.missionContext?.universe || 'REALISTIC';
    MISSION.hookType = task.missionContext?.hookType || '痛點提問';
    MISSION.contentLength = task.missionContext?.contentLength || '深度文 (約300字)';
    MISSION.persona = task.missionContext?.persona || '專業顧問';
    
    await addLog("系統", "🔄", `正在為您恢復任務：<b>${MISSION.topic}</b>`, true);

    const chatBar = document.getElementById('agentChatBar');

    if (task.currentStatus === 'AWAITING_APPROVAL') {
        if(chatBar) chatBar.classList.remove('translate-y-full'); 
        await renderDraftEditorCard(task.taskId, task.agentData.draftContent, MISSION.universe === 'COMIC');
        
    } else if (task.currentStatus === 'IMAGES_GENERATED') {
        if(chatBar) chatBar.classList.remove('translate-y-full');
        await renderFinalPublishCard(task.taskId, task.agentData.generatedImages, task.agentData.draftContent.post_caption);
        
    } else if (task.currentStatus === 'COMPLETED') {
        if(chatBar) chatBar.classList.add('translate-y-full'); 
        await addLog("社群總監", "✅", "這篇貼文已經發佈完畢囉！以下是最終成品：", true);
        await renderFinalPublishCard(task.taskId, task.agentData.generatedImages, task.agentData.draftContent.post_caption);
        
    } else {
        if(chatBar) chatBar.classList.add('translate-y-full');
        showError(`此任務狀態 (${task.currentStatus}) 尚不支援直接續傳，請發起新任務。`);
        setTimeout(() => initAgentFunnel(), 2000);
    }
}
