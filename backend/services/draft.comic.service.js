// services/draft.comic.service.js

/**
 * ==========================================
 * 🎨 動漫宇宙專屬大腦 (Comic Universe)
 * 💡 V1 最終打通版：全邏輯保留、完整防呆、圖文素材全數入庫
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
        const styleName = mission.style?.trim() || "預設動漫"; 
        const colorModeName = mission.colorMode?.trim() || "Color"; 
        const targetPanelCount = mission.panelCount ? parseInt(mission.panelCount) : 4; 
        const taskId = payloadRaw.taskId || mission.currentTaskId || db.collection('tasks').doc().id;

        // 🌟 1. 抓取所有圖片素材：舊版 payload、新版背景圖(scene)、9張附加輪播圖(attachment)
        const rawRefs = payloadRaw.image_options?.referenceImages || [];
        const sceneFiles = mission.sceneFiles || []; 
        const attachmentFiles = mission.attachmentFiles || []; 
        
        const normalizedSceneRefs = sceneFiles.map(f => ({
            type: 'scene',
            name: f.name || 'reference_bg',
            imageUrl: f.imageUrl || f.dataUrl || ''
        }));
        const allReferenceImages = [...rawRefs, ...normalizedSceneRefs];

        // 🌟 2. 撈取資料庫風格咒語
        let dbStylePrompt = "";
        let dbNegativePrompt = "";
        const stylesSnap = await db.collection('system_styles').where('name', '==', styleName).get();
        if (!stylesSnap.empty) {
            const styleData = stylesSnap.docs[0].data();
            dbStylePrompt = styleData.promptPrefix || "";
            dbNegativePrompt = styleData.negativePrompt || "";
        }

        const charList = payloadRaw.characters || mission.characters || []; 
        let charContext = charList.length > 0 ? charList.slice(0, 4).map(c => `- ${c.name} (${c.persona || ''})`).join('\n') : "無特定角色";

        // 🌟 3. 處理提供給 AI 分析的免洗筷 Base64 圖片
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

        // 🌟 4. 萃取角色特徵並鎖定
        const extractedFeatures = await analyzeAndLockFeatures(charList, tempRefsForAI);

        // 🌟 5. 組合 AI 劇本 Prompt
        let writingStrategyInstruction = "";
        let jsonOutputStructure = "";
        const formattingRules = `\n【🚨排版與視覺呈現鐵律】\n1. 總字數控制：必須嚴格遵守長度節奏。\n2. 拒絕文字牆：連續不換行絕對不可超過 50 個中文字！\n3. 強制斷行：長句必須強制使用換行字元 (\\n) 或空行 (\\n\\n)。\n4. 角色外觀隔離鐵律：嚴禁在畫面指令中加入與人設相關的刻板印象。`;

        if (payloadRaw.isIndependentPost && mission.platforms && mission.platforms.length > 0) {
            writingStrategyInstruction = `【🚨多平台獨立適配鐵律】針對以下平台分別撰寫「專屬文案」與「專屬 Hashtag」：\n`;
            mission.platforms.forEach(p => {
                const strat = payloadRaw.platformStrategies?.[p] || {};
                writingStrategyInstruction += `- [${p}]: 開場戰術「${strat.hookType || '預設'}」，長度「${strat.contentLength || '適中'}」。\n`;
            });
            writingStrategyInstruction += formattingRules;
            const platformsStr = mission.platforms.map(p => `"${p}": "專屬內文(包含 \\n)"`).join(', ');
            const tagsStr = mission.platforms.map(p => `"${p}": ["標籤1", "標籤2"]`).join(', ');
            jsonOutputStructure = `"captions": { ${platformsStr} },\n  "hashtags": { ${tagsStr} },`;
        } else {
            writingStrategyInstruction = `【📝文案戰術】開場戰術：「${mission.hookType || '預設'}」，長度節奏：「${mission.contentLength || '適中'}」。\n${formattingRules}`;
            jsonOutputStructure = `"captions": { "UNIFIED": "全平台通用內文(包含 \\n)" },\n  "hashtags": { "UNIFIED": ["標籤1", "標籤2"] },`;
        }

        const promptText = `
            請寫一個「${targetPanelCount} 格連載漫畫」腳本。主題：${topic}
            發言人設：${mission.persona || '預設'}
            強制登場角色設定:\n${charContext}
            【視覺風格】${styleName}
            【色系模式】${colorModeName === 'BW' ? '黑白漫畫' : '彩色漫畫'}
            ${writingStrategyInstruction}
            【🚨分鏡字數鐵律】每一格 dialogue 絕對不准超過 15 個中文字！你必須輸出剛好 ${targetPanelCount} 格。
            請務必只輸出純 JSON，格式如下：
            { "post_title": "標題", ${jsonOutputStructure} "panels": [ { "panel_number": 1, "action_en": "畫面描述(英文)", "action_zh": "中文", "speaker_en": "英文", "speaker_zh": "中文", "dialogue": "對白(15字內)", "sound_effect": "狀聲詞" } ] }`;

        // 🌟 6. 呼叫 AI 大腦
        const aiResponse = await aiService.generateTextGemini(promptText);
        
        // 🌟 7. 防爆破 JSON 解析裝甲
        let draftContent;
        try {
            const rawText = aiResponse.text || "";
            const startIndex = rawText.indexOf('{');
            const endIndex = rawText.lastIndexOf('}');
            if (startIndex === -1 || endIndex === -1) {
                throw new Error(`AI 未回傳格式化資料，可能觸發安全審查。AI 原文回覆：「${rawText.substring(0, 50)}...」`);
            }
            let jsonText = rawText.substring(startIndex, endIndex + 1);
            draftContent = JSON.parse(jsonText);
        } catch (parseError) {
            throw new Error(`腳本解析失敗: ${parseError.message}`);
        }

        // 🌟 8. 資料庫極淨入庫準備
        const imageOptionsToSave = {
            ratio: String(mission.ratio || "9:16"),
            resolution: String(mission.resolution || "1K"),
            style: String(styleName),
            colorMode: String(colorModeName),
            dbStylePrompt: String(dbStylePrompt),
            dbNegativePrompt: String(dbNegativePrompt),
            referenceImages: allReferenceImages.map(img => ({
                type: String(img.type || "scene"),
                name: String(img.name || ""),
                imageUrl: String(img.imageUrl || img.dataUrl || "")
            })),
            attachmentFiles: attachmentFiles.map(img => ({
                name: String(img.name || ""),
                imageUrl: String(img.imageUrl || img.dataUrl || "")
            }))
        };

        // 清理殘留舊 payload
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

        // 🌟 9. 寫入任務卷宗
        await db.collection('tasks').doc(taskId).set(JSON.parse(JSON.stringify(finalDocData)));

        // 🌟 10. 計費與通知
        if (billingService && billingService.chargeAndLog) {
            await billingService.chargeAndLog({ uid: tenantId, actionType: 'GENERATE_DRAFT', multiplier: 1, referenceId: taskId, metrics: { geminiTokensUsed: aiResponse.tokens }, req });
        }
        await sendClientTelegram(payloadRaw.tgConfig, `🎨 <b>動漫草稿產出完畢！</b>\n任務主題：${topic}`);

        return res.status(200).json({ success: true, taskId, draftContent, isComicMode: true });

    } catch (error) {
        console.error("🔥 [動漫大腦] 生成草稿崩潰: ", error);
        return res.status(500).json({ success: false, message: error.message }); 
    }
}

module.exports = { processDraft };