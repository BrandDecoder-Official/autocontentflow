// js/v9_agent_client.js
import { CONFIG, STATE } from './config.js';
import { MISSION, SYSTEM_DB } from './v9_state.js';
import { addLog, showError, updateMissionHud } from './v9_ui.js';
import { applyPointDeduction, getBillingActionDisplayName } from './v9_finance.js';
import { renderDraftEditorCard } from './v9_funnel_editor.js';
import { triggerMissionSummary } from './v9_funnel_dashboard.js';

// ==========================================
// 🛠️ Agent 專屬武器庫 (Tools Schema)
// ==========================================
export const AGENT_TOOLS_SCHEMA = [
    {
        name: "update_mission_params",
        description: "當使用者想要修改貼文主題、發布平台、品牌人設、語氣、長度、格數等參數時，呼叫此工具。可以一次修改多個參數。",
        parameters: {
            type: "OBJECT",
            properties: {
                topic: { type: "STRING", description: "貼文的主題或核心內容" },
                persona: { type: "STRING", description: "品牌人設名稱 (例如: 專業顧問, 毒舌教官, 溫暖知心, 迷因小編，或使用者自訂的人設)" },
                platforms: { type: "ARRAY", items: { type: "STRING" }, description: "發布平台，可選值包含: FB, IG, THREADS" },
                hookType: { type: "STRING", description: "開場勾子戰術，可選值包含: 痛點提問, 反直覺爆點, 利益誘惑, 爭議站隊" },
                contentLength: { type: "STRING", description: "文案長度節奏，可選值包含: 短平快 (約150字), 深度文 (約300字)" },
                panelCount: { type: "NUMBER", description: "漫畫格數，可選值為 1, 2, 3, 4" }
            }
        }
    },
    {
        name: "execute_funnel_action",
        description: "當使用者明確指示要『執行』、『發包』、『產出』或『進行下一步』時，呼叫此工具來觸發系統流程。",
        parameters: {
            type: "OBJECT",
            properties: {
                action: { 
                    type: "STRING", 
                    description: "要執行的動作代碼。'GENERATE_DRAFT': 產出全新劇本/草稿; 'GENERATE_IMAGES': 確認草稿並發包生圖; 'PUBLISH': 立即發佈至社群" 
                }
            },
            required: ["action"]
        }
    },
    {
        name: "revise_draft_text",
        description: "當使用者在『草稿校稿』階段，要求修改『特定分鏡對白』或『社群內文』時呼叫此工具。【🚨鐵律】：如果是修改分鏡對白 (panel_X)，為了塞進漫畫對話框，字數絕對不可超過 15 個中文字！如果是修改社群內文，請根據目前的平台風格精簡或擴寫。",
        parameters: {
            type: "OBJECT",
            properties: {
                target: { type: "STRING", description: "要修改的目標。可選值：'caption' (社群內文), 'panel_1' (第一格對白), 'panel_2' (第二格對白), 以此類推。" },
                new_text: { type: "STRING", description: "你重新撰寫的全新文字內容 (分鏡對白請控制在15字內)。" }
            },
            required: ["target", "new_text"]
        }
    },
    // 🆕 V10 新增：Telegram 發送推播工具
    {
        name: "send_telegram_notification",
        description: "當你需要主動通知使用者重要事項、報價，或任務發包/生圖完成時，呼叫此工具發送推播到使用者的 Telegram。",
        parameters: {
            type: "OBJECT",
            properties: {
                message: { 
                    type: "STRING", 
                    description: "要發送給使用者的完整訊息內容（可使用 Emoji 和基本的 Markdown 換行）。" 
                },
                priority: {
                    type: "STRING",
                    description: "通知層級：INFO (一般通知), SUCCESS (完成通知), WARNING (警告/報價)。",
                    enum: ["INFO", "SUCCESS", "WARNING"]
                }
            },
            required: ["message", "priority"]
        }
    },
    // 🆕 V10 新增：步驟導航與切換工具
    {
        name: "navigate_to_step",
        description: "當使用者要求上傳檔案、修改參考圖、回上一步，或者要直接切換到特定介面步驟時，呼叫此工具。例如使用者說「我要附加上傳檔」、「切換到素材頁」、「我想看總表」。",
        parameters: {
            type: "OBJECT",
            properties: {
                step: {
                    type: "STRING",
                    description: "要切換到的步驟代碼。'visual': 素材與參考圖上傳步驟; 'draft': 草稿校稿編輯步驟; 'dashboard': 任務總表/控制面板步驟",
                    enum: ["visual", "draft", "dashboard"]
                }
            },
            required: ["step"]
        }
    }
];

// ==========================================
// 🧠 Agent 終端機 (負責與大腦連線並執行指令)
// ==========================================
export class AgentClient {
    
    // 🧠 幫 Agent 植入「短期記憶體 (海馬迴)」
    static chatMemory = [];

    // 1. 漏斗流程專用的指令通道
    static async sendCommand(commandType, payload, taskId = null) {
        try {
            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/agent/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
                body: JSON.stringify({ 
                    tenantId: STATE.uid, 
                    command: commandType, 
                    payload: payload, 
                    taskId: taskId 
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || '大腦神經元連線失敗');
            return data.agentState;
        } catch (error) {
            console.error("Agent 執行失敗:", error);
            throw error;
        }
    }

    // 2. 🚀 自然語言對話通道 (支援記憶體與 Function Calling)
    static async sendChatMessage(userMessage) {
        try {
            this.chatMemory.push(`總編: ${userMessage}`);
            if (this.chatMemory.length > 6) this.chatMemory.shift();

            const contextMessage = `【前情提要(近期對話紀錄)】\n${this.chatMemory.join('\n')}\n\n【總編最新指令】\n${userMessage}\n\n(請根據前情提要判斷總編的意圖，若需執行介面修改，請精準調用工具)`;

            const res = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/agent/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
                body: JSON.stringify({
                    tenantId: STATE.uid,
                    command: 'CHAT_MESSAGE',
                    message: contextMessage, 
                    taskId: MISSION.currentTaskId,
                    tools: AGENT_TOOLS_SCHEMA,
                    currentMissionState: MISSION
                })
            });
            
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || '大腦思考中斷');

            // 💸 V10 真實算力扣點 (採取後端單一來源，避免與資料庫不一致)
            if (data.chargedPoints !== undefined && data.chargedPoints > 0) {
                const tokenLabel = data.tokensUsed ? ` (${data.tokensUsed} tokens)` : '';
                await applyPointDeduction(
                    data.chargedPoints,
                    `${getBillingActionDisplayName('TOKEN_USAGE', '大腦思考耗能')}${tokenLabel}`
                );
            }

            const agentReplyText = data.agentState?.reply || '[執行了系統自動化操作]';
            this.chatMemory.push(`Agent: ${agentReplyText}`);

            // 🤖 判斷大腦是否決定調用工具
            if (data.agentState && data.agentState.functionCalls && data.agentState.functionCalls.length > 0) {
                await this.executeToolCalls(data.agentState.functionCalls);
                return { type: 'action', message: data.agentState.reply || '已為您執行介面自動化操作！' };
            } else {
                return { type: 'text', message: data.agentState?.reply || '我聽懂了，但目前沒有對應的操作。' };
            }
            
        } catch (error) {
            showError(`對話失敗：${error.message}`);
            return { type: 'error', message: error.message };
        }
    }

    // 3. ⚙️ 前端自動化引擎
    static async executeToolCalls(functionCalls) {
        for (const call of functionCalls) {
            console.log("⚡ 觸發 Agent 武器庫:", call.name, call.args);
            
            if (call.name === 'update_mission_params') {
                const args = call.args;
                let updatedMsg = "✅ Agent 已自動更新參數：<br>";
                
                if (args.topic) { MISSION.topic = args.topic; updatedMsg += `- 主題更新為：${args.topic}<br>`; }
                if (args.persona) { MISSION.persona = args.persona; updatedMsg += `- 人設切換為：${args.persona}<br>`; }
                if (args.platforms && args.platforms.length > 0) { MISSION.platforms = args.platforms; updatedMsg += `- 平台鎖定為：${args.platforms.join(', ')}<br>`; }
                if (args.hookType) { MISSION.hookType = args.hookType; updatedMsg += `- 戰術切換為：${args.hookType}<br>`; }
                if (args.contentLength) { MISSION.contentLength = args.contentLength; updatedMsg += `- 節奏改為：${args.contentLength}<br>`; }
                if (args.panelCount) { MISSION.panelCount = args.panelCount; updatedMsg += `- 格數切換為：${args.panelCount}格<br>`; }
                
                await addLog("系統", "🤖", updatedMsg, true);
                
                // 🚀 關鍵同步：如果上帝卡片在畫面上，強制刷新卡片 UI！
                if (typeof window.refreshMissionDashboard === 'function') {
                    window.refreshMissionDashboard();
                }
                
                // 🚀 同步更新頂部 HUD 看板
                if (typeof updateMissionHud === 'function') {
                    updateMissionHud();
                }

            } else if (call.name === 'execute_funnel_action') {
                const action = call.args.action;
                
                if (action === 'GENERATE_DRAFT') {
                    if (window.FunnelActions && window.FunnelActions.generateDraft) {
                        await window.FunnelActions.generateDraft();
                    } else {
                        showError("目前尚未進入參數確認階段，無法產出草稿。");
                    }
                } else if (action === 'GENERATE_IMAGES') {
                    if (window.FunnelActions && window.FunnelActions.generateImages) {
                        const captionEl = document.getElementById('editCaption') || document.getElementById('finalCaptionEdit');
                        let editedCaption = '';
                        if (captionEl) {
                            editedCaption = captionEl.value;
                        } else {
                            const tab = MISSION.isIndependentPost ? (MISSION.platforms[0] || 'FB') : 'UNIFIED';
                            const tagsStr = (MISSION.currentHashtags[tab] || []).length > 0
                                ? '\n\n' + MISSION.currentHashtags[tab].map(t => '#' + String(t).replace(/^#/, '')).join(' ')
                                : '';
                            editedCaption = (MISSION.currentCaptions[tab] || MISSION.currentCaption || '').trim() + tagsStr;
                        }
                        const panelInputs = document.querySelectorAll('.panel-dialogue');
                        let editedPanels = [];
                        
                        if (panelInputs.length > 0 && MISSION.currentDraft && Array.isArray(MISSION.currentDraft.panels)) {
                            panelInputs.forEach((input, idx) => { 
                                const src = MISSION.currentDraft.panels[idx];
                                if (!src) return;
                                editedPanels.push({ 
                                    panel_number: src.panel_number, 
                                    dialogue: input.value, 
                                    action_zh: src.action_zh, 
                                    action_en: src.action_en 
                                }); 
                            });
                        } else if (Array.isArray(MISSION.currentPanels) && MISSION.currentPanels.length > 0) {
                            editedPanels = MISSION.currentPanels.map((p) => ({ ...p }));
                        }
                        
                        await window.FunnelActions.generateImages(MISSION.currentTaskId, editedCaption, editedPanels);
                    } else {
                        showError("目前沒有草稿可供發包。");
                    }
                } else if (action === 'PUBLISH') {
                    const btn = document.getElementById('btnDeploy');
                    if (btn) {
                        await addLog("系統", "🤖", "已接收指令，正在自動為您【發佈貼文】...", true);
                        btn.click();
                    } else {
                        showError("目前沒有可發佈的內容。");
                    }
                }

            } else if (call.name === 'revise_draft_text') {
                const { target, new_text } = call.args;
                let updatedMsg = "";
                
                if (target === 'caption') {
                    const captionEl = document.getElementById('editCaption');
                    if (captionEl) {
                        // 🆕 V10：同步更新到對應的 Tab 狀態中
                        const activeTabBtn = document.querySelector('.plat-tab-btn.bg-indigo-600');
                        let currentTab = activeTabBtn ? activeTabBtn.dataset.plat : (MISSION.isIndependentPost ? MISSION.platforms[0] : 'UNIFIED');
                        
                        captionEl.value = new_text;
                        MISSION.currentCaptions[currentTab] = new_text; // 同步存入大腦
                        captionEl.dispatchEvent(new Event('input')); // 觸發自動保存
                        
                        updatedMsg = `✅ Agent 已為您重寫了目前的【社群內文】！`;
                    }
                } else if (target.startsWith('panel_')) {
                    const panelIndex = parseInt(target.replace('panel_', '')) - 1;
                    const panelInputs = document.querySelectorAll('.panel-dialogue');
                    
                    if (panelInputs && panelInputs[panelIndex]) {
                        panelInputs[panelIndex].value = new_text;
                        panelInputs[panelIndex].dispatchEvent(new Event('input'));
                        updatedMsg = `✅ Agent 已為您將【第 ${panelIndex + 1} 格】重新撰寫為：\n"${new_text}"`;
                    }
                }
                
                if (updatedMsg) {
                    await addLog("系統", "🤖", updatedMsg, true);
                }
            } 
            // 🆕 V10 新增：Telegram 發送邏輯
            else if (call.name === 'send_telegram_notification') {
                const msg = call.args.message;
                const hasTgConfig = MISSION.tgConfig && MISSION.tgConfig.botToken && MISSION.tgConfig.chatId;

                if (hasTgConfig) {
                    // (後端實作後可以把這個換成真實的 API 呼叫)
                    await addLog("通訊兵", "✈️", `已向您的 Telegram 發送推播：<br><span class="text-xs text-slate-400 font-normal">"${msg}"</span>`, true);
                } else {
                    await addLog("通訊兵", "⚠️", "Agent 嘗試發送 Telegram 通知，但您尚未在左側邊欄綁定 Bot Token 與 Chat ID！", true);
                }
            }
            // 🆕 V10 新增：介面步驟導航與切換邏輯
            else if (call.name === 'navigate_to_step') {
                const step = call.args.step;
                let msg = "";
                const oldActive = document.getElementById('activeControlCard');
                if (oldActive) releaseUI(oldActive);
                
                if (step === 'visual') {
                    if (window.FunnelActions && window.FunnelActions.triggerVisualSkill) {
                        msg = "🔄 Agent 已自動為您切換至【素材與參考圖】上傳頁面，您現在可以直接點擊下方按鈕上傳您的圖片檔案。";
                        await addLog("系統", "🤖", msg, true);
                        await window.FunnelActions.triggerVisualSkill();
                    } else {
                        showError("無法執行切換，系統狀態尚未初始化。");
                    }
                } else if (step === 'draft') {
                    if (MISSION.currentTaskId && MISSION.currentDraft) {
                        msg = "🔄 Agent 已自動為您切換至【草稿校稿總編室】。";
                        await addLog("系統", "🤖", msg, true);
                        await renderDraftEditorCard(MISSION.currentTaskId, MISSION.currentDraft, MISSION.universe === 'COMIC');
                    } else {
                        showError("目前尚未產生草稿，無法前往草稿校稿室。");
                    }
                } else if (step === 'dashboard') {
                    if (typeof triggerMissionSummary === 'function') {
                        msg = "🔄 Agent 已自動為您切換至【任務控制面板】。";
                        await addLog("系統", "🤖", msg, true);
                        await triggerMissionSummary();
                    } else {
                        showError("目前無法切換至任務控制面板。");
                    }
                }
            }
        }
    }
}
