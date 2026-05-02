// services/draft.realistic.service.js

/**
 * ==========================================
 * 📷 真實宇宙專屬大腦 (Realistic Universe)
 * 💡 V1 最終打通版：支援 1+9 模式、專業攝影指令封裝、角色特徵鎖定
 * ==========================================
 */
async function processDraft(req, res, payloadRaw, tools) {
    const { 
        db, aiService, billingService, 
        verifyTenant, fetchImageUrlToBase64, 
        analyzeAndLockFeatures, sendClientTelegram 
    } = tools;

    try {
        const tenantId = payloadRaw.tenantId; 
        await verifyTenant(tenantId, 0); 
        
        const mission = payloadRaw.missionContext || payloadRaw;
        const topic = mission.topic?.trim() || "未命名任務";
        const styleName = mission.style?.trim() || ""; // 寫實模式名稱 (如: 人物優先)
        const colorModeName = mission.colorMode?.trim() || ""; // 攝影濾鏡名稱 (如: 徠卡風格)
        const taskId = payloadRaw.taskId || mission.currentTaskId || db.collection('tasks').doc().id;

        // 🌟 1. 素材盤點：整合背景圖 (Scene) 與 9 張附加圖 (Attachment)
        const rawRefs = payloadRaw.image_options?.referenceImages || [];
        const sceneFiles = mission.sceneFiles || []; 
        const attachmentFiles = mission.attachmentFiles || []; 

        const normalizedSceneRefs = sceneFiles.map(f => ({
            type: 'scene',
            name: f.name || 'realistic_bg_ref',
            imageUrl: f.imageUrl || f.dataUrl || ''
        }));
        const allReferenceImages = [...rawRefs, ...normalizedSceneRefs];

        // 🌟 2. 專業攝影強化：從 DB 撈取模式與濾鏡的正反向咒語
        let realisticEnhancePrompt = "";
        let dbNegativePrompt = "";
        let dbStylePrompt = ""; 
        
        const stylesSnap = await db.collection('system_styles').get();
        let modePrompt = ""; 
        let filterPrompt = "";
        
        stylesSnap.forEach(doc => {
            const d = doc.data();
            // 匹配寫實合成模式
            if (d.category === 'REALISTIC_MODE' && d.name === styleName) {
                modePrompt = d.promptPrefix || "";
                dbStylePrompt += modePrompt + " ";
            }
            // 匹配攝影濾鏡
            if (d.category === 'REALISTIC_FILTER' && d.name === colorModeName) {
                filterPrompt = d.promptPrefix || "";
                dbStylePrompt += filterPrompt + " ";
            }
            // 疊加負向咒語
            if ((d.name === styleName || d.name === colorModeName) && d.negativePrompt) {
                dbNegativePrompt += d.negativePrompt + ", ";
            }
        });
        
        realisticEnhancePrompt = `【商業攝影對焦模式】：${modePrompt || '預設對焦'}\n【專業攝影濾鏡氛圍】：${filterPrompt || '自然光影'}\n`;

        const charList = mission.characters || []; 
        let charContext = charList.length > 0 ? charList.slice(0, 4).map(c => `- ${c.name} (${c.persona || ''})`).join('\n') : "無特定角色，採通用寫實模特兒";

        // 🌟 3. 免洗筷模式：將圖片轉 Base64 供 AI 分析特徵 (不存入 DB)
        const tempRefsForAI = [];
        for (let img of allReferenceImages) {
            const url = img.imageUrl || img.dataUrl;
            if (url && url.startsWith('http')) {
                const converted = await fetchImageUrlToBase64(url);
                if (converted) tempRefsForAI.push({ ...img, data: converted.data, mimeType: converted.mimeType });
            } else if (url && url.startsWith('data:')) {
                const base64Data = url.split(',')[1];
                const mimeType = url.split(';')[0].split(':')[1];
                tempRefsForAI.push({ ...img, data: base64Data, mimeType });
            }
        }

        // 🌟 4. 分析並鎖定寫實角色特徵 (例如：鎖定美女長相基因)
        const extractedFeatures = await analyzeAndLockFeatures(charList, tempRefsForAI);

        // 🌟 5. 撰寫寫實策略指令
        let writingStrategyInstruction = "";
        let jsonOutputStructure = "";
        const formattingRules = `\n【🚨排版與視覺呈現鐵律】\n1. 總字數控制：嚴格遵守長度節奏。\n2. 拒絕文字牆：連續不換行不可超過 50 個中文字！\n3. 強制斷行：使用換行字元 (\\n) 或空行 (\\n\\n) 切割段落。`;

        if (payloadRaw.isIndependentPost && mission.platforms && mission.platforms.length > 0) {
            writingStrategyInstruction = `【🚨多平台獨立適配鐵律】針對以下平台分別撰寫專屬商業文案：\n`;
            mission.platforms.forEach(p => {
                const strat = payloadRaw.platformStrategies?.[p] || {};
                writingStrategyInstruction += `- [${p}]: 開場「${strat.hookType || '預設'}」，長度「${strat.contentLength || '適中'}」。\n`;
            });
            writingStrategyInstruction += formattingRules;
            const platformsStr = mission.platforms.map(p => `"${p}": "專屬寫實內文(包含 \\n)"`).join(', ');
            const tagsStr = mission.platforms.map(p => `"${p}": ["標籤1", "標籤2"]`).join(', ');
            jsonOutputStructure = `"captions": { ${platformsStr} },\n  "hashtags": { ${tagsStr} },`;
        } else {
            writingStrategyInstruction = `【📝文案戰術】開場：「${mission.hookType || '預設'}」，長度節奏：「${mission.contentLength || '適中'}」。\n${formattingRules}`;
            jsonOutputStructure = `"captions": { "UNIFIED": "全平台寫實通用內文(包含 \\n)" },\n  "hashtags": { "UNIFIED": ["標籤1", "標籤2"] },`;
        }

        const promptText = `
            你是一位專業的商業攝影指導與社群行銷專家。
            請為主題：『${topic}』 策劃一組極具質感的寫實攝影圖文。
            發言人設：${mission.persona || '預設'}
            【🚨強制登場真人角色外觀描述】：\n${charContext}
            【🚨攝影風格技術參數】：\n${realisticEnhancePrompt}
            
            請將上述的對焦模式、濾鏡氛圍與角色長相基因，完美揉合進 visual_prompt 指令中。
            ${writingStrategyInstruction}
            
            請務必只輸出純 JSON，格式如下：
            { 
              "post_title": "標題", 
              ${jsonOutputStructure} 
              "visual_prompt": "一段極其詳細的英文攝影描述，包含燈光、構圖、模特兒姿態與環境細節" 
            }`;

        // 🌟 6. 呼叫 AI 大腦生成企劃
        const aiResponse = await aiService.generateTextGemini(promptText);
        
        // 🌟 7. 防爆破 JSON 解析裝甲
        let draftContent;
        try {
            const rawText = aiResponse.text || "";
            const startIndex = rawText.indexOf('{');
            const endIndex = rawText.lastIndexOf('}');
            if (startIndex === -1 || endIndex === -1) {
                throw new Error(`AI 未回傳 JSON 格式。AI 原文回覆：「${rawText.substring(0, 50)}...」`);
            }
            let jsonText = rawText.substring(startIndex, endIndex + 1);
            draftContent = JSON.parse(jsonText);
        } catch (parseError) {
            throw new Error(`寫實腳本解析失敗: ${parseError.message}`);
        }

        // 🌟 8. 資料庫極淨入庫 (包含 1張背景 + 9張附加圖)
        const imageOptionsToSave = {
            ratio: String(mission.ratio || "9:16"),
            resolution: String(mission.resolution || "1K"),
            style: String(styleName),
            colorMode: String(colorModeName),
            dbStylePrompt: String(dbStylePrompt.trim()),
            dbNegativePrompt: String(dbNegativePrompt),
            referenceImages: allReferenceImages.map(img => ({
                type: String(img.type || "scene"),
                name: String(img.name || ""),
                imageUrl: String(img.imageUrl || img.dataUrl || "")
            })),
            // 🚀 關鍵：將 9 張附加圖路徑存入，供發包生圖 API 使用
            attachmentFiles: attachmentFiles.map(img => ({
                name: String(img.name || ""),
                imageUrl: String(img.imageUrl || img.dataUrl || "")
            }))
        };

        const safePayload = JSON.parse(JSON.stringify(payloadRaw)); 
        if(safePayload.image_options) delete safePayload.image_options;
        if(safePayload.missionContext?.image_options) delete safePayload.missionContext.image_options;

        const finalDocData = {
            taskId, tenantId, status: 'DRAFTING', 
            payload: safePayload,             
            draftContent, extracted_features: extractedFeatures,
            image_options: imageOptionsToSave,
            createdAt: new Date().toISOString()
        };

        // 🌟 9. 執行入庫
        await db.collection('tasks').doc(taskId).set(JSON.parse(JSON.stringify(finalDocData)));

        // 🌟 10. 計費與通知
        if (billingService && billingService.chargeAndLog) {
            await billingService.chargeAndLog({ uid: tenantId, actionType: 'GENERATE_DRAFT', multiplier: 1, referenceId: taskId, metrics: { geminiTokensUsed: aiResponse.tokens }, req });
        }
        await sendClientTelegram(payloadRaw.tgConfig, `📷 <b>攝影企劃產出完畢！</b>\n任務主題：${topic}`);

        return res.status(200).json({ success: true, taskId, draftContent, isComicMode: false });

    } catch (error) { 
        console.error("🔥 [寫實大腦] 生成草稿崩潰: ", error);
        return res.status(500).json({ success: false, message: error.message }); 
    }
}

module.exports = { processDraft };