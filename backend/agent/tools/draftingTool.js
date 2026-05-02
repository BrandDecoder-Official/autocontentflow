// agent/tools/draftingTool.js
const aiService = require('../../services/ai.service');

/**
 * 🛠️ 第一把瑞士刀 (實戰版)：草稿生成工具 (Drafting Tool)
 */
exports.execute = async (missionContext) => {
    console.log(`[Tool: DraftingTool] 收到大腦指令，準備撰寫草稿。主題: ${missionContext.topic}`);

    try {
        const topic = missionContext.topic?.trim() || "未指定主題";
        const styleDNA = missionContext.style?.trim() || "";
        const isComicMode = missionContext.isComicMode === true || missionContext.universe === 'COMIC';
        
        // 預設 4 格漫畫 (前端會傳過來)
        const targetPanelCount = missionContext.panelCount ? parseInt(missionContext.panelCount) : 4; 
        
        // 🚀 [新增] 動態計算最佳對白字數上限
        let wordLimit = 9;
        if (targetPanelCount === 1) wordLimit = 20;
        else if (targetPanelCount === 2) wordLimit = 15;
        else if (targetPanelCount === 3) wordLimit = 12;

        // 組合登場角色資訊
        const charList = missionContext.characters || []; 
        let charContext = charList.length > 0 
            ? charList.slice(0, 4).map(c => {
                const name = typeof c === 'object' ? c.name : c;
                const persona = typeof c === 'object' ? c.persona : '';
                return `- ${name} (${persona})`;
            }).join('\n') 
            : "";

        let promptText = "";

        if (isComicMode) {
            promptText = `
            請寫一個「${targetPanelCount} 格連載漫畫」腳本。主題：${topic}
            強制登場角色設定:\n${charContext}
            【視覺DNA】${styleDNA}
            
            【🚨分鏡字數鐵律】每一格 dialogue 絕對不准超過 ${wordLimit} 個中文字（含標點符號）！
            【🚨格數鐵律】你必須，且只能輸出剛好 ${targetPanelCount} 格的分鏡，絕對不可多也不可少！
            
            請務必只輸出純 JSON，格式如下：
            {
              "post_title": "標題",
              "post_caption": "內文 (不可包含任何 #標籤)",
              "hashtags": ["標籤1", "標籤2", "標籤3"],
              "panels": [
                { "panel_number": 1, "action_en": "畫面描述(英)", "action_zh": "畫面描述(中)", "speaker_en": "說話者", "speaker_zh": "說話者", "dialogue": "對白(${wordLimit}字內)", "sound_effect": "狀聲詞" }
              ]
            }`;
        } else {
            promptText = `寫一個逼真攝影貼文。主題：${topic}\n【視覺DNA】${styleDNA}\n只輸出純 JSON：{ "post_title": "標題", "post_caption": "內文 (不可包含任何 #標籤)", "hashtags": ["標籤1", "標籤2"], "visual_prompt": "英文攝影指令" }`;
        }

        console.log(`[Tool: DraftingTool] 正在呼叫 Gemini API 進行創作...`);
        
        const aiResponse = await aiService.generateTextGemini(promptText);
        
        let jsonText = aiResponse.text.substring(aiResponse.text.indexOf('{'), aiResponse.text.lastIndexOf('}') + 1);
        const draftContent = JSON.parse(jsonText);

        console.log(`[Tool: DraftingTool] 草稿生成完畢 (消耗 ${aiResponse.tokens || '未知'} Tokens)`);
        
       // 🚀 新的：連同帳單一起回傳給大腦
        return { 
            content: draftContent, 
            usage: aiResponse.usage 
        };

    } catch (error) {
        console.error(`[Tool: DraftingTool] 發生致命錯誤:`, error);
        throw new Error(`草稿生成工具異常: ${error.message}`);
    }
};