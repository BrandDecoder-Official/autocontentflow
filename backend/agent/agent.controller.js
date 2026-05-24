// agent/agent.controller.js
const { db, createAgentTask: dbCreateAgentTask } = require('../services/firestore.service'); // ⚠️ 引入我們新增的 DB 操作
const { GoogleGenAI } = require('@google/genai');
const { MODELS } = require('../config/ai.config');

// 🛡️ 雙重保險載入計費模組
let billingService;
try { 
    billingService = require('../services/billingService'); 
} catch (e1) { 
    try { 
        billingService = require('../services/billing.service'); 
    } catch (e2) {
        console.error("💥 計費模組載入失敗 (兩種檔名都找不到):", e2.message);
    } 
}

// 初始化 Gemini 官方最新 SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** Firestore Timestamp / ISO / Date → sortable ms */
function taskTimeMs(val) {
    if (val == null) return 0;
    if (typeof val === 'object' && val._seconds != null) {
        return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1e6);
    }
    const t = new Date(val).getTime();
    return Number.isFinite(t) ? t : 0;
}

class AgentController {

    // ==========================================
    // 🧠 核心大腦中樞：處理 Agent 指令與工具調用 (Function Calling)
    // ==========================================
    async handleAgentRequest(req, res) {
        try {
            const { tenantId, command, message, tools, currentMissionState } = req.body;

            if (!tenantId) {
                return res.status(400).json({ success: false, message: '缺少用戶識別碼' });
            }

            console.log(`[Agent API] 接收到 ${tenantId} 的指令: ${command}`);

            // 🚀 處理全新的自然語言對話與工具調用模式
            if (command === 'CHAT_MESSAGE') {
                
                // 1. 設定系統靈魂 (System Instruction)
                // 讓大腦清楚自己的定位，並且知道現在畫面上的狀態是什麼
                const systemInstruction = `你是一個企業級 SaaS 系統的頂級 AI 代理人 (Agent)，名為 BrandDecoder。
你的任務是協助總編（使用者）操作系統介面、修改發文參數，或執行生圖發文等任務。
【當前畫面狀態參數】：
${JSON.stringify(currentMissionState || {}, null, 2)}

【最高行動守則】：
1. 判斷使用者的意圖。如果可以透過呼叫 Tool (工具) 來完成，請務必精準輸出 Function Call。
2. 你可以一次連續呼叫多個工具（例如：先 update_mission_params 修改設定，再 execute_funnel_action 發包執行，或呼叫 navigate_to_step 切換步驟）。
3. 如果使用者的話只是純聊天、詢問建議，或者不需要動用工具，請用專業、幽默、高效率的繁體中文直接回答。

【上傳檔案與調整素材指引】：
如果使用者詢問如何上傳檔案、場景參考圖、人物照、配件圖、附件，或者提及「我要附加上傳檔」、「要上傳照片」、「想修改背景」等，請主動調用工具 \`navigate_to_step(step='visual')\` 將右側切換至素材上傳頁面，並在文字回覆中引導使用者直接點擊右側下方的「上傳場景圖」、「上傳人物照」、「上傳配件圖」或「上傳社群附加圖」按鈕進行選檔上傳。不要虛擬出不存在於當前頁面的上傳按鈕。`;

                // 2. 封裝前端傳來的武器庫 (Tools Schema) 符合 Google GenAI 格式
                const formattedTools = tools && tools.length > 0 
                    ? [{ functionDeclarations: tools }] 
                    : undefined;

                // 3. 呼叫大腦進行思考 (使用您指定的 AI_MODEL_TEXT：gemini-3-flash-preview)
                const response = await ai.models.generateContent({
                    model: MODELS.AI_MODEL_TEXT,
                    contents: message,
                    config: {
                        systemInstruction: systemInstruction,
                        tools: formattedTools,
                        temperature: 0.1 // 降低溫度以確保工具調用的絕對精準度
                    }
                });

                // 🚀 抓取本次大腦思考消耗的 Token 總數
                const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

                let functionCalls = [];
                let replyText = "";

                // 4. 解析大腦的回傳結果 (可能會同時有文字和 Function Calls)
                if (response.candidates && response.candidates[0].content.parts) {
                    const parts = response.candidates[0].content.parts;
                    
                    for (const part of parts) {
                        if (part.functionCall) {
                            functionCalls.push({
                                name: part.functionCall.name,
                                args: part.functionCall.args
                            });
                            console.log(`⚡ [Agent API] 大腦決定調用工具: ${part.functionCall.name}`, part.functionCall.args);
                        } else if (part.text) {
                            replyText += part.text;
                        }
                    }
                }

                // 如果大腦調用了工具，但沒給文字，我們補上一句預設回覆
                if (functionCalls.length > 0 && !replyText) {
                    replyText = "收到指令，已為您自動化執行介面操作！";
                }

                // 🚀 呼叫後端計費模組扣款 (將 Token 消耗記錄進資料庫)
                let billingResult = null;
                if (billingService && billingService.chargeAndLog && tokensUsed > 0) {
                    try {
                        billingResult = await billingService.chargeAndLog({ 
                            uid: tenantId, 
                            actionType: 'AGENT_THINKING', 
                            multiplier: 1, 
                            referenceId: `agent_${Date.now()}`, 
                            metrics: { geminiTokensUsed: tokensUsed }, 
                            req 
                        });
                    } catch (billingErr) {
                        console.warn("⚠️ 紀錄 Token 消耗失敗 (不阻擋主流程):", billingErr.message);
                    }
                }

                return res.status(200).json({
                    success: true,
                    agentState: {
                        reply: replyText,
                        functionCalls: functionCalls
                    },
                    tokensUsed: tokensUsed, // 將 Token 消耗量回傳給前端
                    chargedPoints: billingResult ? billingResult.cost : 0,
                    newBalance: billingResult ? billingResult.newBalance : undefined
                });
            }

            // ⚠️ 防呆：如果是未知的指令
            return res.status(400).json({ success: false, message: '無法識別的 Agent 系統指令' });

        } catch (error) {
            console.error('[Agent API] 大腦連線失敗:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ==========================================
    // 📂 任務列表 API (供首頁或漏斗載入歷史任務)
    // ==========================================
    async getTaskList(req, res) {
        try {
            const { tenantId } = req.params;
            if (!tenantId) {
                return res.status(400).json({ success: false, message: '缺少 tenantId 參數' });
            }

            // 🛡️ 雙重保險寫法 (記憶體排序法)：
            const snapshot = await db.collection('tasks')
                .where('tenantId', '==', tenantId)
                .get();

            let tasks = [];
            snapshot.forEach(doc => {
                tasks.push({ id: doc.id, ...doc.data() });
            });

            // 記憶體內排序：优先 updatedAt（與 Firestore Timestamp / ISO 相容），最新的在上面
            tasks.sort((a, b) => {
                const tb = taskTimeMs(b.updatedAt) || taskTimeMs(b.createdAt);
                const ta = taskTimeMs(a.updatedAt) || taskTimeMs(a.createdAt);
                return tb - ta;
            });
            tasks = tasks.slice(0, 50);

            return res.status(200).json({ success: true, tasks });

        } catch (error) {
            console.error("[Agent API] 獲取任務列表失敗:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ==========================================
    // 🚀 ✨ V10 漏斗專用：正式建立空任務
    // ==========================================
    async createAgentTask(req, res) {
        try {
            const { tenantId, missionContext, currentStatus } = req.body;
            
            if (!tenantId || !missionContext || !missionContext.topic) {
                return res.status(400).json({ 
                    success: false, 
                    message: '缺少必要參數 (tenantId 或 missionContext.topic)' 
                });
            }

            // 🆔 生成專屬身分證字號：task_租戶ID_時間戳
            const timestamp = Date.now();
            const taskId = `task_${tenantId}_${timestamp}`;

            // 💾 呼叫 Firestore Service 寫入資料庫
            if (typeof dbCreateAgentTask === 'function') {
                await dbCreateAgentTask(
                    taskId, 
                    tenantId, 
                    missionContext, 
                    currentStatus || 'DRAFTING'
                );
            } else {
                 // 如果 firestore.service.js 忘記寫，這裡給一個緊急備案，直接用 db 寫入
                 console.warn("⚠️ [Agent API] 尚未從 firestore.service 載入 createAgentTask，啟動本地備案寫入。");
                 const taskRef = db.collection('tasks').doc(taskId);
                 await taskRef.set({
                     taskId: taskId,
                     tenantId: tenantId,
                     missionContext: missionContext,
                     currentStatus: currentStatus || 'DRAFTING',
                     agentData: {},
                     createdAt: new Date().toISOString(),
                     updatedAt: new Date().toISOString()
                 });
            }

            // ✅ 回傳成功訊息與 taskId 給前端
            return res.status(200).json({
                success: true,
                taskId: taskId,
                message: '任務建檔成功'
            });

        } catch (error) {
            console.error('💥 [Agent API] createAgentTask 錯誤:', error);
            return res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }

    // ==========================================
    // 🗑️ ✨ [新增] 刪除指定任務
    // ==========================================
    async deleteAgentTask(req, res) {
        try {
            const { taskId } = req.params;
            
            if (!taskId) {
                return res.status(400).json({ success: false, message: '缺少 taskId 參數' });
            }

            console.log(`[Agent API] 收到刪除任務請求: ${taskId}`);

            // 執行 Firestore 刪除操作
            await db.collection('tasks').doc(taskId).delete();

            return res.status(200).json({
                success: true,
                message: `任務 ${taskId} 已成功刪除`
            });

        } catch (error) {
            console.error('💥 [Agent API] 刪除任務失敗:', error);
            return res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
}

module.exports = new AgentController();