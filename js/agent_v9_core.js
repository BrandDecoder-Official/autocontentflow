// js/agent_v9_core.js
import { STATE, CONFIG } from './config.js';
import { APP_VERSION, MISSION } from './v9_state.js';
import { updateStepHeader, addLog, showError } from './v9_ui.js';

// 📦 引入專屬模組
import { initAgentChatBar } from './v9_chat.js';
import { startNewFunnel, renderDraftEditorCard, renderFinalPublishCard } from './v9_funnel.js';
import './v9_sidebar.js'; // 側欄

export { bootSystemData } from './v9_state.js';

// 🚀 監聽來自漏斗的「重啟大廳」事件 (解決互相引用的終極解法)
window.addEventListener('reloadLobby', () => {
    initAgentFunnel();
});

// ==========================================
// 🚀 核心入口：初始化
// ==========================================
export async function initAgentFunnel() { 
    updateStepHeader("COMMAND LOBBY"); 
    renderLobby(); 
    
    // 初始化聊天條，並傳入渲染卡片的 callbacks 給聊天框
    initAgentChatBar({
        onDraftReady: renderDraftEditorCard,
        onImagesReady: renderFinalPublishCard
    });
}

function renderLobby() {
    const log = document.getElementById('funnelLog');
    // 初始化 MISSION 暫存
    Object.assign(MISSION, { persona: '', hookType: '痛點提問', platforms: [], topic: '', currentTaskId: null });
    
    log.innerHTML = `
        <div class="max-w-5xl mx-auto mt-4 lg:mt-10 animate-fade-in space-y-8">
            <div class="text-center space-y-2 mb-8">
                <h2 class="text-2xl lg:text-3xl font-black text-white tracking-tight">讓夢想在對話中落地</h2>
                <p class="text-xs text-slate-400">當前指揮官：<span class="text-blue-400 font-bold">總編 K.C</span></p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class="bg-slate-800/50 border border-indigo-500/30 rounded-3xl p-8 hover:bg-slate-800 transition-all cursor-pointer group relative flex flex-col h-full opacity-60">
                    <div class="absolute top-0 right-0 bg-indigo-600 text-[10px] font-black px-3 py-1 rounded-bl-xl tracking-widest">AUTO-PILOT</div>
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">🤖</div>
                    <h3 class="text-lg font-black text-white mb-2">全自動巡航模式</h3>
                    <p class="text-xs text-slate-400 leading-relaxed">Agent 根據品牌基因，自動抓取時事並生成草稿。</p>
                </div>

                <div class="bg-blue-600/10 border border-blue-500/50 rounded-3xl p-8 transition-all cursor-pointer group shadow-[0_0_30px_rgba(59,130,246,0.15)] flex flex-col h-full active:scale-95" id="btnManualStart">
                    <div class="text-4xl mb-4 group-hover:scale-110 transition-transform origin-left">✍️</div>
                    <h3 class="text-lg font-black text-white mb-2">發起實戰任務</h3>
                    <p class="text-xs text-slate-400 mb-6 leading-relaxed">從主題、平台到人設，親手建構您的獲利閉環。</p>
                    <button class="mt-auto w-full bg-blue-600 text-white py-3 rounded-xl text-xs font-black shadow-lg">🚀 啟動全新漏斗</button>
                </div>
            </div>

            <div id="taskDashboardArea" class="bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div class="flex items-center justify-between px-6 py-4 border-bottom border-white/5 bg-white/5">
                    <div class="flex gap-6">
                        <button onclick="switchTaskTab('PENDING')" id="tabPending" class="text-sm font-black transition-colors text-blue-400 border-b-2 border-blue-400 pb-1">⚡ 進行中任務</button>
                        <button onclick="switchTaskTab('COMPLETED')" id="tabCompleted" class="text-sm font-black transition-colors text-slate-500 hover:text-white pb-1">✅ 歷史紀錄</button>
                    </div>
                    <button onclick="renderTaskDashboard()" class="text-xs text-slate-400 hover:text-white"><i class="fa-solid fa-rotate"></i> 刷新</button>
                </div>

                <div id="taskListContainer" class="p-6 space-y-4 min-h-[300px]">
                    <p class="text-slate-500 text-xs text-center py-10">連線中...</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btnManualStart').onclick = async () => { 
        await startNewFunnel();
    };

    renderTaskDashboard();
}

// ==========================================
// 📋 任務儀表板與斷點續傳
// ==========================================
window.renderTaskDashboard = async function() {
    const container = document.getElementById('taskListContainer');
    if(!container) return;
    
    container.innerHTML = '<div class="text-center py-4"><div class="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block"></div></div>';
    
    try {
        const baseUrl = CONFIG.CLOUD_RUN_URL.replace(/\/$/, '');
        const currentTenantId = STATE.uid || 'user_chief_001';
        
        const response = await fetch(`${baseUrl}/api/agent/tasks/${currentTenantId}`);
        const data = await response.json();
        
        if (!data.success) throw new Error(data.message);
        
        if (data.tasks.length === 0) {
            container.innerHTML = '<p class="text-slate-500 text-xs text-center py-4">目前尚無歷史任務，請從上方發起新任務。</p>';
            return;
        }

        let html = '';
        window.tempTaskCache = data.tasks; 

        data.tasks.forEach((task, index) => {
            let statusColor, statusText, actionText, icon;
            const topic = task.missionContext?.topic || '未命名主題';
            
            // 🛠️ 1. 強健的時間解析邏輯 (消滅 Invalid Date)
            let validDate = new Date();
            if (task.updatedAt) {
                // 處理 Firebase Timestamp 特殊格式
                if (task.updatedAt._seconds) {
                    validDate = new Date(task.updatedAt._seconds * 1000);
                } else {
                    validDate = new Date(task.updatedAt);
                }
            }
            // 如果解析失敗，嘗試從 taskId 挽救
            if (isNaN(validDate.getTime()) && task.taskId) {
                const parts = task.taskId.split('_');
                const possibleTime = parseInt(parts[parts.length - 1]);
                if (!isNaN(possibleTime)) validDate = new Date(possibleTime);
            }
            // 最終格式化
            let timeStr = '未知時間';
            if (!isNaN(validDate.getTime())) {
                timeStr = validDate.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            // 狀態判定
            switch(task.currentStatus) {
                case 'COMPLETED': statusColor = 'text-emerald-400'; statusText = '已發佈'; actionText = '查看成品'; icon = '🟢'; break;
                case 'AWAITING_APPROVAL': statusColor = 'text-yellow-400'; statusText = '等待總編審核'; actionText = '接續校稿'; icon = '🟡'; break;
                case 'IMAGES_GENERATED': statusColor = 'text-blue-400'; statusText = '等待發佈'; actionText = '接續發佈'; icon = '🔵'; break;
                case 'ERROR': statusColor = 'text-red-400'; statusText = '執行異常'; actionText = '重試任務'; icon = '🔴'; break;
                default: statusColor = 'text-slate-400'; statusText = '處理中'; actionText = '查看進度'; icon = '⚪'; break;
            }

            // 🛠️ 2. UI 改造：填滿右側空間，加入雙按鈕
            html += `
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/50 p-4 rounded-xl transition-all group gap-3">
                    
                    <div class="flex flex-col gap-1 w-full sm:w-auto overflow-hidden">
                        <div class="flex items-center gap-2">
                            <span class="text-xs">${icon}</span>
                            <span class="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[300px]" title="${topic}">${topic}</span>
                        </div>
                        <div class="flex gap-3 text-[10px]">
                            <span class="${statusColor} font-black">${statusText}</span>
                            <span class="text-slate-500">${timeStr}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
                        <button onclick="resumeTask(${index})" class="bg-indigo-600/90 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-1.5 active:scale-95">
                            📝 ${actionText}
                        </button>
                        <button onclick="deleteTask('${task.taskId}')" class="bg-slate-700/80 hover:bg-red-500 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95">
                            🗑️ 刪除
                        </button>
                    </div>

                </div>
            `;
        });
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-red-400 text-xs text-center py-4">讀取失敗: ${error.message}</p>`;
    }
}

// ==========================================
// 🗑️ 新增：刪除任務功能 (API 串接準備)
// ==========================================
window.deleteTask = async function(taskId) {
    if (!confirm('總編，確定要刪除這筆任務嗎？\n(刪除後將無法恢復)')) return;
    
    // 這裡先做 UI 樂觀更新，並印出要刪除的 ID，讓總編確認
    console.log(`[任務控制台] 準備刪除任務: ${taskId}`);
    alert(`任務 ${taskId} 刪除 API 準備串接中...`);
    
    // 💡 未來這裡要補上 fetch(DELETE) 到後端的代碼
    /*
    try {
        const baseUrl = CONFIG.CLOUD_RUN_URL.replace(/\/$/, '');
        await fetch(`${baseUrl}/api/agent/tasks/${taskId}`, { method: 'DELETE' });
        // 刪除成功後重新渲染列表
        renderTaskDashboard();
    } catch (e) {
        alert('刪除失敗: ' + e.message);
    }
    */
}

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
        
        // 🚀 呼叫獨立出去的卡片渲染模組！
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
