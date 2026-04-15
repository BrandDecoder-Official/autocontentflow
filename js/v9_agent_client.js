// js/v9_agent_client.js
import { CONFIG, STATE } from './config.js';
import { MISSION, SYSTEM_DB } from './v9_state.js';
import { addLog, showError } from './v9_ui.js';
import { applyPointDeduction } from './v9_finance.js';

// ==========================================
// 🛠️ Agent 專屬武器庫 (Tools Schema)
// ==========================================
export const AGENT_TOOLS_SCHEMA = [
    {
        name: "update_mission_params",
        description: "當使用者想要修改貼文主題、發布平台、品牌人設、語氣、長度等參數時，呼叫此工具。可以一次修改多個參數。",
        parameters: {
            type: "OBJECT",
            properties: {
                topic: { type: "STRING", description: "貼文的主題或核心內容" },
                persona: { type: "STRING", description: "品牌人設名稱 (例如: 專業顧問, 毒舌教官, 溫暖知心, 迷因小編，或使用者自訂的人設)" },
                platforms: { type: "ARRAY", items: { type: "STRING" }, description: "發布平台，可選值包含: FB, IG, THREADS" },
                hookType: { type: "STRING", description: "開場勾子戰術，可選值包含: 痛點提問, 反直覺爆點, 利益誘惑, 爭議站隊" },
                contentLength: { type: "STRING", description: "文案長度節奏，可選值包含: 短平快 (約150字), 深度文 (約300字)" }
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
        description: "當使用者在『草稿校稿』階段，要求修改『特定分鏡對白』或『社群內文』時呼叫此工具。【🚨鐵律】：如果是修改分鏡對白 (panel_X)，為了塞進漫畫對話框，字數絕對不可超過 15 個中文字！請精簡有力地輸出新內容。",
        parameters: {
            type: "OBJECT",
            properties: {
                target: { type: "STRING", description: "要修改的目標。可選值：'caption' (社群內文), 'panel_1' (第一格對白), 'panel_2' (第二格對白), 以此類推。" },
                new_text: { type: "STRING", description: "你重新撰寫的全新文字內容 (分鏡對白請控制在15字內)。" }
            },
            required: ["target", "new_text"]
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

            // 💸 實時扣點視覺特效
            if (data.tokensUsed && data.tokensUsed > 0) {
                const deductedPoints = Math.ceil(data.tokensUsed / 100);
                applyPointDeduction(deductedPoints, `大腦思考耗能 (${data.tokensUsed} 算力)`);
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
                
                await addLog("系統", "🤖", updatedMsg, true);
                
                const btnRender = document.getElementById('btnRender');
                if (btnRender) {
                    const topicStrategyDisplay = `${MISSION.topic} (${MISSION.hookType} / ${MISSION.contentLength.split(' ')[0]})`;
                    const labelTopic = document.getElementById('label_mission_topic');
                    if (labelTopic) labelTopic.innerText = topicStrategyDisplay;
                }

            // 🚀 [重點修改區]：改為呼叫全域函數，不再依賴畫面上的按鈕！
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
                        // 抓取畫面上目前的文字，發包給全局函數
                        const captionEl = document.getElementById('editCaption');
                        const editedCaption = captionEl ? captionEl.value : (MISSION.currentCaption || "");
                        const panelInputs = document.querySelectorAll('.panel-dialogue');
                        const editedPanels = [];
                        
                        if (panelInputs.length > 0) {
                            panelInputs.forEach((input, idx) => { 
                                editedPanels.push({ 
                                    panel_number: MISSION.currentDraft.panels[idx].panel_number, 
                                    dialogue: input.value, 
                                    action_zh: MISSION.currentDraft.panels[idx].action_zh, 
                                    action_en: MISSION.currentDraft.panels[idx].action_en 
                                }); 
                            });
                        } else if (MISSION.currentPanels) {
                            // 如果退回總編室，畫面上沒有輸入框，就吃上次存好的
                            Object.assign(editedPanels, MISSION.currentPanels);
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
                        captionEl.value = new_text;
                        updatedMsg = `✅ Agent 已為您重寫【社群內文】！`;
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
        }
    }
}
