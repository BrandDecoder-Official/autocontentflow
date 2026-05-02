// agent/orchestrator.js
const aiService = require('../services/ai.service');
const guardrailService = require('../services/guardrail.service');
const draftingTool = require('./tools/draftingTool');
const imageTool = require('./tools/imageTool');
const publishTool = require('./tools/publishTool');
const { SYSTEM_INSTRUCTION, AGENT_TOOLS } = require('./agent_config');

exports.processTask = async (taskState, action, payload) => {
    // 🚀 [相容性修復] 確保 action 和 payload 無論從參數還是從 state 都能抓到
    const currentAction = action || taskState.action;
    const currentPayload = payload || taskState.payload || taskState.missionContext;
    
    console.log(`\n[Orchestrator] 🚀 啟動決策引擎 | 動作: [${currentAction}] | 任務狀態: ${taskState.currentStatus}`);

    let newState = { ...taskState };
    const tenantId = newState.tenantId;

    if (!newState.agentData) newState.agentData = {};
    if (!newState.agentData.chatHistory) newState.agentData.chatHistory = [];
    if (!newState.memory) newState.memory = [];

    // 翻譯指令給 Agent
    let userPrompt = "";
    if (currentAction === 'START_NEW_MISSION') {
        newState.missionContext = currentPayload; // 確保 Context 被存入
        userPrompt = `[系統指令] 總編發起了新任務！主題：「${currentPayload.topic || '無'}」。請立刻呼叫 'generate_or_revise_draft' 工具產出草稿，禁止回覆純文字。`;
    } else if (currentAction === 'APPROVE_DRAFT') {
        newState.agentData.draftContent.post_caption = currentPayload.editedCaption;
        newState.agentData.draftContent.panels = currentPayload.editedPanels;
        userPrompt = `[系統指令] 總編已核准草稿。請立刻呼叫 'generate_images' 工具合成影像。`;
    } else if (currentAction === 'APPROVE_PUBLISH') {
        userPrompt = `[系統指令] 總編已核准發佈。請立刻呼叫 'publish_to_social' 工具。`;
    } else if (currentAction === 'CHAT') {
        userPrompt = currentPayload.message; 
    }

    if (!userPrompt) {
        console.warn("[Orchestrator] ⚠️ 警告：收到的 Action 無法解析，大腦停止思考。");
        return newState;
    }

    newState.agentData.chatHistory.push({ role: 'user', parts: [{ text: userPrompt }] });

    try {
        const agentResponse = await aiService.chatWithAgent(newState.agentData.chatHistory, SYSTEM_INSTRUCTION, AGENT_TOOLS);

        if (agentResponse.rawMessage) newState.agentData.chatHistory.push(agentResponse.rawMessage);

        if (agentResponse.functionCall) {
            const call = agentResponse.functionCall;
            console.log(`[Orchestrator] 🛠️ Agent 決定執行工具: ${call.name}`);

            if (call.name === 'generate_or_revise_draft') {
                await guardrailService.preCheck(tenantId, 0);
                const draftResult = await draftingTool.execute(newState.missionContext);
                const draftContent = draftResult.content || draftResult;
                const draftUsage = draftResult.usage || { promptTokenCount: 0, candidatesTokenCount: 0 };
                
                newState.lastCost = await guardrailService.chargeTokens({
                    tenantId, taskId: newState.taskId, actionType: 'GENERATE_DRAFT',
                    inputTokens: draftUsage.promptTokenCount, outputTokens: draftUsage.candidatesTokenCount
                });
                
                newState.agentData.draftContent = draftContent;
                newState.currentStatus = 'AWAITING_APPROVAL';
                newState.memory.push({ time: new Date().toISOString(), action: "AGENT_ACTION", message: "草稿產出完畢。" });

            } else if (call.name === 'generate_images') {
                await guardrailService.preCheck(tenantId, 0);
                const finalPanels = newState.agentData.draftContent.panels || [];
                const generatedImages = await imageTool.execute(newState.taskId, newState.missionContext, finalPanels);
                
                newState.lastCost = await guardrailService.chargeTokens({ tenantId, taskId: newState.taskId, actionType: 'GENERATE_IMAGE' });
                
                newState.agentData.generatedImages = generatedImages;
                newState.currentStatus = 'IMAGES_GENERATED';
                newState.memory.push({ time: new Date().toISOString(), action: "AGENT_ACTION", message: "影像合成完畢。" });

            } else if (call.name === 'publish_to_social') {
                await guardrailService.preCheck(tenantId, 0);
                const publishResults = await publishTool.execute(newState.missionContext.platforms, newState.agentData.draftContent.post_caption, newState.agentData.generatedImages);
                
                newState.lastCost = await guardrailService.chargeTokens({ tenantId, taskId: newState.taskId, actionType: 'PUBLISH_POST' });
                
                newState.agentData.publishUrls = publishResults;
                newState.currentStatus = 'COMPLETED'; 
                newState.memory.push({ time: new Date().toISOString(), action: "AGENT_ACTION", message: "發佈完畢。" });
            }

            // ⚠️ 反饋工具執行結果給 AI 記憶
            newState.agentData.chatHistory.push({
                role: 'user', 
                parts: [{ functionResponse: { name: call.name, response: { status: "OK", message: "工具執行完成" } } }]
            });

        } else if (agentResponse.textReply) {
            console.log(`[Orchestrator] 💬 Agent 選擇純文字回覆。`);
            newState.lastCost = await guardrailService.chargeTokens({
                tenantId: tenantId, taskId: newState.taskId, actionType: 'AGENT_CHAT_REPLY', 
                inputTokens: agentResponse.usage?.promptTokenCount || 0, outputTokens: agentResponse.usage?.candidatesTokenCount || 0
            });
            newState.memory.push({ time: new Date().toISOString(), action: "AGENT_REPLY", message: agentResponse.textReply });
        }

        return newState;

    } catch (error) {
        console.error(`[Orchestrator Error] ❌ 執行失敗:`, error.message);
        newState.currentStatus = 'ERROR';
        newState.memory.push({ time: new Date().toISOString(), action: "ERROR", message: error.message });
        return newState;
    }
};