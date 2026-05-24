// agent/tools/imageTool.js
const aiService = require('../../services/ai.service');

// 🚀 [新增] 輔助函數：將圖片 URL 下載並轉換為 Gemini 看得懂的 Base64
async function fetchImageUrlToBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return { 
            data: Buffer.from(arrayBuffer).toString('base64'), 
            mimeType: response.headers.get('content-type') || 'image/jpeg' 
        };
    } catch (error) {
        console.warn(`[Tool: ImageTool] 圖片轉碼失敗 (跳過此參考圖): ${url}`, error.message);
        return null;
    }
}

exports.execute = async (taskId, missionContext, finalPanels) => {
    console.log(`[Tool: ImageTool] 收到大腦指令，準備進行真實 AI 影像合成。任務 ID: ${taskId}`);

    try {
        const isComicMode = missionContext.universe === 'COMIC';
        const stylePrefix = missionContext.style || "";
        const presentationMode = missionContext.presentationMode || 'CLASSIC';
        const actualCount = finalPanels.length;

        let baseImagePrompt = "";
        let cleanImageOptions = { 
            ratio: missionContext.ratio || "9:16",
            resolution: missionContext.resolution || "1K",
            negativePrompt: "" 
        };

        // 🚀 [修正] 處理角色/場景參考圖：把 URL 轉換為真實 Base64 像素資料
        let processedRefs = [];
        const imageOptions = missionContext.image_options || missionContext.payload?.image_options || {};

        if (imageOptions.referenceImages) {
            const rawRefs = imageOptions.referenceImages;
            const sceneRefs = rawRefs.filter(img => img.type === 'scene' || !img.type).slice(0, 1);
            const charRefs = rawRefs.filter(img => img.type === 'character').slice(0, 3);
            const accessoryRefs = rawRefs.filter(img => img.type === 'accessory' || img.type === 'object').slice(0, 3);
            const allRefsToProcess = [...sceneRefs, ...charRefs, ...accessoryRefs];

            for (let img of allRefsToProcess) {
                // 如果前端傳來的是 URL
                if (img.imageUrl && !img.data) {
                    console.log(`[Tool: ImageTool] 正在讀取參考圖: ${img.name || '未命名'} (${img.type})`);
                    const converted = await fetchImageUrlToBase64(img.imageUrl);
                    if (converted) {
                        processedRefs.push({ ...img, data: converted.data, mimeType: converted.mimeType });
                    }
                } 
                // 如果前端已經轉好 data (例如上傳的場景圖)
                else if (img.data) {
                    processedRefs.push(img);
                }
            }
            if (processedRefs.length > 0) {
                cleanImageOptions.referenceImages = processedRefs;
                console.log(`[Tool: ImageTool] 已成功掛載 ${processedRefs.length} 張參考圖。`);
            }
        }

        // 🎨 1. 處理漫畫色系與基礎 Prompt (強力約束版)
        if (isComicMode) {
            const colorPositive = missionContext.colorMode === 'BW' 
                ? "[STYLE: STRICTLY PURE BLACK AND WHITE MANGA]. Use high contrast ink, screentone, and greyscale ONLY. ABSOLUTELY NO COLOR. NO RGB." 
                : "[STYLE: FULL COLOR MANGA]. Vibrant and rich colors.";
            const colorNegative = missionContext.colorMode === 'BW' 
                ? "color, colorful, colored, polychromatic, rgb, blue, red, yellow, green" 
                : "monochrome, b&w, greyscale, black and white";
            
            cleanImageOptions.negativePrompt = colorNegative;
            baseImagePrompt = `${stylePrefix}\n\n${colorPositive}\n[LANGUAGE RULE]: MUST use Traditional Chinese text. ABSOLUTELY NO Japanese Hiragana/Katakana/Kanji. NO English.\n`;
        } else {
            baseImagePrompt = `${stylePrefix}\n A high-quality photograph.\n`;
        }

        // 🌟 [核心修復 1] 注入角色長相基因！
        // 從任務資料中提取 extracted_features (兼顧不同層級的防呆抓取)
        const extractedFeatures = missionContext.extracted_features || missionContext.payload?.extracted_features || {};
        if (extractedFeatures.lockedCharacterPrompt) {
            baseImagePrompt += `\n[CHARACTER VISUALS]: ${extractedFeatures.lockedCharacterPrompt}\n`;
            console.log(`[Tool: ImageTool] 🧬 已注入角色基因特徵。`);
        }

        // 🌟 [核心修復 2] 注入分類參考指示！
        const activeSceneRefs = processedRefs.filter(img => img.type === 'scene' || !img.type);
        const activeCharRefs = processedRefs.filter(img => img.type === 'character');
        const activeAccessoryRefs = processedRefs.filter(img => img.type === 'accessory' || img.type === 'object');

        if (activeCharRefs.length > 0) {
            baseImagePrompt += `\n[CHARACTER REFERENCE]: MUST strictly use the provided Character Reference images to maintain facial features, hair, and clothing consistency.\n`;
        }
        if (activeSceneRefs.length > 0) {
            baseImagePrompt += `\n[SCENE REFERENCE]: MUST use the provided Scene Reference image as the background setting/layout. Place the characters within this specific environment.\n`;
        }
        if (activeAccessoryRefs.length > 0) {
            baseImagePrompt += `\n[ACCESSORY REFERENCE]: Depict the accessory objects (like watch, book, coffee cup) accurately using the provided Accessory Reference images.\n`;
        }

        // 📐 2. 處理網格鎖定 (Grid Command)
        let currentImagePrompt = baseImagePrompt;
        if (isComicMode) {
            let gridCommand = "";
            if (actualCount === 1) gridCommand = "[CRITICAL LAYOUT]: Single panel, full canvas illustration. NO grid dividers.";
            else if (actualCount === 2) gridCommand = "[CRITICAL LAYOUT]: EXACTLY a 2-panel comic grid (split the canvas into exactly 2 frames). DO NOT draw 4 panels.";
            else if (actualCount === 3) gridCommand = "[CRITICAL LAYOUT]: EXACTLY a 3-panel comic grid.";
            else gridCommand = "[CRITICAL LAYOUT]: A standard 4-panel comic grid (Yonkoma).";

            currentImagePrompt += `\n${gridCommand}\n[SCENE DETAILS]:\n`;

            // ✍️ 3. 注入對白與角色
            finalPanels.forEach((panel, idx) => {
                let charNames = missionContext.characters && missionContext.characters.length > 0 
                    ? missionContext.characters.map(c => typeof c === 'object' ? c.name : c).join(' and ') 
                    : "The characters";

                if (presentationMode === 'CINEMATIC') {
                    currentImagePrompt += `Panel ${idx + 1}: ${charNames} are doing: ${panel.action_zh || panel.action_en}. [CINEMATIC POSTER MODE]: NO text, NO speech bubbles. Purely visual storytelling.\n`;
                } else {
                    currentImagePrompt += `Panel ${idx + 1}: ${charNames} are doing: ${panel.action_zh || panel.action_en}. Draw a comic speech bubble containing exactly this Traditional Chinese text: '${panel.dialogue}'.\n`;
                }
            });
        } else {
            const visualDesc = finalPanels[0]?.action_zh || finalPanels[0]?.action_en || "Beautiful scene";
            currentImagePrompt += `\nScene: ${visualDesc}`;
        }

        console.log(`[Tool: ImageTool] 最終送出的生圖 Prompt: \n${currentImagePrompt}`);

        // ⚡ 4. 呼叫真實生圖 API
        const finalImageUrl = await aiService.generateImage(currentImagePrompt, taskId, cleanImageOptions);

        return [{ panel_number: "ALL", promptUsed: currentImagePrompt, finalUrl: finalImageUrl }];

    } catch (error) {
        console.error(`[Tool: ImageTool] 發生致命錯誤:`, error);
        throw new Error(`影像合成工具異常: ${error.message}`);
    }
};