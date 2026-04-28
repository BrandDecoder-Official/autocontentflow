// js/agent_v9_core.js
import { STATE, CONFIG } from './config.js';
import { APP_VERSION, MISSION, loadMissionFromDB, IS_EDIT_MODE } from './v9_state.js'; // 🚀 引入時光機引擎
import { updateStepHeader, addLog, showError } from './v9_ui.js';
import * as API from './api.js';

// 📦 引入專屬模組
import { initAgentChatBar } from './v9_chat.js';
import { startNewFunnel, renderDraftEditorCard, renderFinalPublishCard } from './v9_funnel.js';
import { triggerMissionSummary } from './v9_funnel_dashboard.js'; // 🚀 引入跳轉目的地
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

function getTaskContext(task) {
    return task?.missionContext || task?.payload?.missionContext || task?.payload || task?.agentData?.missionContext || {};
}

function getTaskTopic(task) {
    const ctx = getTaskContext(task);
    return ctx.topic || task?.topic || task?.title || task?.agentData?.topic || '';
}

function getTaskStatus(task) {
    return task?.status || task?.currentStatus || task?.agentData?.status || 'UNKNOWN';
}

// ==========================================
// 🎨 大廳畫面渲染
// ==========================================
function renderLobby() {
    const log = document.getElementById('funnelLog');
    // 初始化 MISSION 暫存 (將平台清空，等待漏斗寫入)
    Object.assign(MISSION, {
        persona: '',
        hookType: '',
        platforms: [],
        topic: '',
        currentTaskId: null,
        isIndependentPost: false,
        taskMode: 'GENERATE',
        plannedImageCount: 1,
        isStoryMode: false,
        generatedImageBatches: [],
        selectedImageBatchId: null,
        imageRegenerationRequired: false,
        lastGeneratedContextKey: ''
    });
    IS_EDIT_MODE.value = false; // 確保回到大廳時關閉編輯模式
    
    log.innerHTML = `
        <div class="max-w-5xl mx-auto mt-4 lg:mt-10 animate-fade-in space-y-6 lg:space-y-8">
            <div class="text-center space-y-2 mb-6">
                <h2 class="text-2xl lg:text-3xl font-black text-white tracking-tight">讓夢想在對話中落地</h2>
                <p class="text-xs text-slate-400">當前指揮官：<span class="text-blue-400 font-bold">總編</span></p>
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
        await addLog("系統", "🚀", `正在啟動 V1 核心漏斗...`); 
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
// 📋 任務儀表板與斷點續傳 (完美適配後端狀態碼)
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

        // 💡 1. 預先過濾掉完全缺乏識別資訊的任務（避免過度誤殺）
        let validTasks = data.tasks.filter(t => {
            const topic = getTaskTopic(t);
            const status = getTaskStatus(t);
            return !!(topic || (t.taskId || t.id) || status !== 'UNKNOWN');
        });

        // 💡 2. 依照當前頁籤進行狀態過濾 (精準對齊後端狀態碼)
        if (window.currentTaskTab === 'PENDING') {
            // 進行中：DRAFTING (草稿完成待生圖), IMAGE_READY (圖片完成待發佈), AWAITING_APPROVAL
            validTasks = validTasks.filter(t => {
                const s = getTaskStatus(t);
                return s !== 'COMPLETED' && s !== 'PUBLISHED' && s !== 'SCHEDULED';
            });
        } else {
            // 已完成：PUBLISHED, COMPLETED, SCHEDULED
            validTasks = validTasks.filter(t => {
                const s = getTaskStatus(t);
                return s === 'COMPLETED' || s === 'PUBLISHED' || s === 'SCHEDULED';
            });
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
            let timeA = a.updatedAt?._seconds ? a.updatedAt._seconds * 1000 : new Date(a.createdAt || a.updatedAt || 0).getTime();
            let timeB = b.updatedAt?._seconds ? b.updatedAt._seconds * 1000 : new Date(b.createdAt || b.updatedAt || 0).getTime();
            return timeB - timeA;
        }).forEach((task, index) => {
            
            const topic = getTaskTopic(task) || '（未命名任務）';
            const finalStatus = getTaskStatus(task);

            // 🛠️ 強健的時間解析
            let validDate = new Date();
            if (task.createdAt || task.updatedAt) {
                const timeObj = task.createdAt || task.updatedAt;
                if (timeObj._seconds) validDate = new Date(timeObj._seconds * 1000);
                else validDate = new Date(timeObj);
            }
            let timeStr = !isNaN(validDate.getTime()) ? validDate.toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未知時間';

            // 🧠 狀態與進度條判定 (對齊 V1 後端)
            let statusColor, statusText, actionText, icon, progressPct, barColor;
            switch(finalStatus) {
                case 'COMPLETED': 
                case 'PUBLISHED':
                    statusColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'; statusText = '已發佈完成'; actionText = '查看成品'; icon = '✅'; progressPct = 100; barColor = 'bg-emerald-500'; break;
                case 'SCHEDULED':
                    statusColor = 'text-blue-400 bg-blue-400/10 border-blue-400/20'; statusText = '已排程待發佈'; actionText = '查看任務'; icon = '📅'; progressPct = 100; barColor = 'bg-blue-500'; break;
                case 'IMAGE_READY': 
                case 'IMAGES_GENERATED': 
                    statusColor = 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20'; statusText = '圖片已產出 (待確認)'; actionText = '預覽與發佈'; icon = '🖼️'; progressPct = 85; barColor = 'bg-indigo-500'; break;
                case 'DRAFTING': 
                    statusColor = 'text-orange-400 bg-orange-400/10 border-orange-400/20'; statusText = '草稿已建立 (待生圖)'; actionText = '強制載入編輯'; icon = '🟠'; progressPct = 50; barColor = 'bg-orange-500'; break;
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
                        <button onclick="deleteTask('${task.taskId || task.id}')" class="bg-slate-700/60 hover:bg-red-500/80 text-slate-300 hover:text-white px-4 py-2.5 sm:py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95" title="刪除此任務">
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
// 🗑️ 刪除任務功能 (已接通 API)
// ==========================================
window.deleteTask = async function(taskId) {
    const ok = await (window.showConfirm
        ? window.showConfirm('總編，確定要刪除這筆任務嗎？（刪除後將無法恢復）', { title: '刪除任務' })
        : Promise.resolve(false));
    if (!ok) return;
    
    try {
        console.log(`[任務控制台] 準備刪除任務: ${taskId}`);
        // 呼叫刪除 API
        await API.deleteAgentTaskAPI(taskId);
        
        // 重新刷新當前畫面 (重新抓取最新資料)
        window.renderTaskDashboard();
        
        if (window.showToast) window.showToast('任務已成功刪除。', 'success');
        
    } catch (error) {
        console.error("刪除失敗:", error);
        if (window.showToast) window.showToast('刪除失敗：' + error.message, 'error');
    }
}

// ==========================================
// 🔄 恢復/接續 任務功能 (時光機核心)
// ==========================================
window.resumeTask = async function(taskIndex) {
    const task = window.tempTaskCache[taskIndex];
    if(!task) return showError("任務資料遺失！");

    const log = document.getElementById('funnelLog');
    log.innerHTML = ''; 
    
    // 🚀 1. 神級還原！使用剛寫好的 loadMissionFromDB 灌回資料
    const status = loadMissionFromDB(task);
    IS_EDIT_MODE.value = true; // 開啟編輯模式，讓漏斗知道我們是從中途插入的

    await addLog("系統", "🔄", `正在為您恢復任務：<b>${MISSION.topic.substring(0, 15)}...</b>`, true);
    const chatBar = document.getElementById('agentChatBar');

    // 🚀 2. 狀態分流時光機 (精準跳轉)
    if (status === 'DRAFTING') {
        // 情況 A：草稿狀態直接回到「內容字卡」，避免再繞回漏斗
        if(chatBar) chatBar.classList.remove('translate-y-full');
        const draftFromTask = task.draftContent || task.agentData?.draftContent || {
            post_caption: task.social_post_draft || '',
            hashtags: task.hashtags || [],
            panels: task.panels || task.agentData?.panels || MISSION.currentPanels || []
        };
        await renderDraftEditorCard(MISSION.currentTaskId, draftFromTask, MISSION.universe === 'COMIC');

    } else if (status === 'IMAGE_READY' || status === 'IMAGES_GENERATED') {
        // 情況 B：圖片已經生好了！跳轉到最終的預覽發佈卡片
        if(chatBar) chatBar.classList.remove('translate-y-full');
        const imgs = task.images || task.agentData?.generatedImages || [];
        const caption = task.social_post_draft || task.draftContent?.post_caption || task.agentData?.draftContent?.post_caption || '';
        await renderFinalPublishCard(MISSION.currentTaskId, imgs, caption);

    } else if (status === 'COMPLETED' || status === 'PUBLISHED' || status === 'SCHEDULED') {
        // 情況 C：已經發佈或排程的成品，直接檢視
        if(chatBar) chatBar.classList.add('translate-y-full'); 
        await addLog("社群總監", "✅", "這篇貼文已經處理完畢囉！以下是最終成品：", true);
        const imgs = task.images || task.agentData?.generatedImages || [];
        const caption = task.social_post_draft || task.draftContent?.post_caption || task.agentData?.draftContent?.post_caption || '';
        await renderFinalPublishCard(MISSION.currentTaskId, imgs, caption);

    } else {
        if(chatBar) chatBar.classList.add('translate-y-full');
        showError(`此任務狀態 (${status}) 尚不支援直接續傳，請發起新任務。`);
        setTimeout(() => initAgentFunnel(), 2000);
    }
}
