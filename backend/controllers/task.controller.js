// controllers/task.controller.js
let db, aiService, telegramService, socialService, firestoreService, billingService;

const { GoogleGenAI } = require('@google/genai');
const { PROJECT_ID } = require('../config/env.config.js');
const aiConfig = require('../config/ai.config.js');

const visionAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ==========================================
// 🛡️ 模組安全載入區 (雙重保險)
// ==========================================
try { firestoreService = require('../services/firestore.service'); db = firestoreService.db || firestoreService; } catch (e) { console.error("💥 DB 模組載入失敗:", e); }
try { aiService = require('../services/ai.service'); } catch (e) { console.error("💥 AI 模組載入失敗:", e); }
try { telegramService = require('../services/telegram.service'); } catch (e) { console.error("💥 Telegram 模組載入失敗:", e); }
try { socialService = require('../services/social.service'); } catch (e) { console.error("💥 Social 模組載入失敗:", e); }
try { billingService = require('../services/billingService'); } catch (e) { console.error("💥 計費模組載入失敗:", e); }
const { getImageGenBillingMultiplier, PRICING } = require('../config/pricing.config.js');
const { resolvePlatformsFromTask, resolveImageUrlsFromTask } = require('../utils/publishResolve.js');

// 🚀 雙軌大腦防禦性載入
let comicDraftService, realisticDraftService;
try { comicDraftService = require('../services/draft.comic.service'); } catch (e) { console.warn("⚠️ 尚未建立動漫大腦服務"); }
try { realisticDraftService = require('../services/draft.realistic.service'); } catch (e) { console.warn("⚠️ 尚未建立寫實大腦服務"); }

let storage;
try { 
    const { Storage } = require('@google-cloud/storage'); 
    storage = new Storage({ projectId: PROJECT_ID }); 
} catch (e) { 
    console.warn("⚠️ 未偵測到 @google-cloud/storage"); 
}

// ==========================================
// 🚨 全域共用 Helper 函數 (保留給依賴注入使用)
// ==========================================

async function sendErrorAlert(moduleName, error, context, actionTaken) {
    try {
        if (!telegramService) return;
        const timeStr = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
        const alertMsg = `🚨 **[系統異常警報]**\n⏰ 時間：${timeStr}\n🛠️ 模組：${moduleName}\n📌 狀況：${context}\n❌ 錯誤：${error.message || String(error)}\n🔄 處置：${actionTaken}`;
        await telegramService.sendMessage(process.env.TG_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID, alertMsg);
    } catch (e) { console.error("發送 Telegram 警報本身發生錯誤:", e); }
}

async function sendClientTelegram(tgConfig, message) {
    try {
        if (tgConfig && tgConfig.botToken && tgConfig.chatId && telegramService) {
            await telegramService.sendDynamicMessage(tgConfig.botToken, tgConfig.chatId, message);
        }
    } catch (e) { 
        console.error("發送客戶端 TG 通知失敗:", e); 
    }
}

async function verifyTenant(tenantId, requiredPoints = 0) {
    if (!tenantId) throw new Error("缺少 Tenant ID");
    const tenantRef = db.collection('tenants').doc(tenantId);
    const docSnap = await tenantRef.get();
    if (!docSnap.exists) throw new Error("找不到租戶資料");
    const tenantData = docSnap.data();
    if (tenantData.status !== 'ACTIVE') throw new Error("帳號停權中");
    if (tenantData.totalPoints < requiredPoints) throw new Error(`點數不足！需要 ${requiredPoints} 點。`);
    return { tenantRef, tenantData };
}

async function fetchImageUrlToBase64(url) {
    try {
        if (typeof url === 'string' && url.startsWith('data:image')) {
            const headerEnd = url.indexOf(',');
            if (headerEnd === -1) throw new Error('Malformed data URL');
            const header = url.slice(0, headerEnd);
            const data = url.slice(headerEnd + 1);
            const mimeMatch = header.match(/^data:(image\/[^;]+)/i);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            if (!/;base64/i.test(header)) throw new Error('Expected base64 data URL');
            return { data, mimeType };
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return { data: Buffer.from(arrayBuffer).toString('base64'), mimeType: response.headers.get('content-type') || 'image/jpeg' };
    } catch (error) {
        await sendErrorAlert('圖片轉換', error, `URL: ${url}`, '跳過');
        return null;
    }
}

async function uploadBase64ToStorage(base64String, filename) {
    try {
        if (!storage) throw new Error("GCP Storage 模組未載入");
        const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const bucketName = `${PROJECT_ID}.appspot.com`; 
        const file = storage.bucket(bucketName).file(`user_uploads/${filename}.jpg`);
        await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
        return { url: `https://storage.googleapis.com/${bucketName}/user_uploads/${filename}.jpg`, bytes: buffer.length };
    } catch (error) {
        await sendErrorAlert('雲端上傳', error, `檔案: ${filename}`, '退回使用 Base64');
        return { url: base64String, bytes: 0 }; 
    }
}

async function analyzeAndLockFeatures(characters, referenceImages) {
    let lockedCharacterPrompt = ""; let lockedScenePrompt = "";
    if (characters && characters.length > 0) {
        const characterPromises = characters.map(async (char) => {
            const charImg = referenceImages.find(img => img.type === 'character' && img.name === char.name);
            let aiExtractedFeatures = "";
            if (charImg) {
                try {
                    const response = await visionAi.models.generateContent({
                        model: aiConfig.MODELS.AI_MODEL_VISION,
                        contents: [{ text: "Extract core physical traits... in 1 concise English sentence." }, { inlineData: { data: charImg.data, mimeType: charImg.mimeType || 'image/jpeg' } }]
                    });
                    aiExtractedFeatures = response.text.trim();
                } catch (error) { await sendErrorAlert('特徵提取', error, `角色: ${char.name}`, '跳過'); }
            }
            const finalPersona = [char.persona ? `User defined trait: ${char.persona}.` : "", aiExtractedFeatures].filter(Boolean).join(" ");
            return `Character '${char.name}' MUST strictly look like: ${finalPersona}.`;
        });
        lockedCharacterPrompt = (await Promise.all(characterPromises)).join("\n");
    }
    return { lockedCharacterPrompt, lockedScenePrompt };
}

/**
 * ==========================================
 * 🚦 API 1 總入口：草稿生成調度員 (Dispatcher)
 * ==========================================
 */
async function generateDraft(req, res) {
    try {
        const payloadRaw = req.body || {};
        const mission = payloadRaw.missionContext || payloadRaw;
        const universe = mission.universe || 'COMIC';

        // 🧰 打包工具箱 (依賴注入)
        const tools = {
            db, 
            aiService, 
            billingService,
            verifyTenant, 
            fetchImageUrlToBase64, 
            analyzeAndLockFeatures, 
            sendClientTelegram,
            sendErrorAlert
        };

        // 🛣️ 物理分流
        if (universe === 'REALISTIC') {
            if (!realisticDraftService) throw new Error("🚧 真實宇宙大腦尚未佈署，請稍候！");
            console.log("🚀 [調度員] 進入真實宇宙通道");
            return await realisticDraftService.processDraft(req, res, payloadRaw, tools);
        } else {
            if (!comicDraftService) throw new Error("🚧 動漫宇宙大腦尚未佈署，請稍候！");
            console.log("🚀 [調度員] 進入動漫宇宙通道");
            return await comicDraftService.processDraft(req, res, payloadRaw, tools);
        }
    } catch (error) {
        console.error("🔥 [調度員] 任務分流失敗: ", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * ==========================================
 * 🎨 API 2：發包生圖 (V15 基因鏈完美接合版)
 * ==========================================
 */
async function generateImageFromDraft(req, res) {
    try {
        const { taskId, tenantId, editedCaption, editedPanels, incomingImages, plannedImageCount, tgConfig } = req.body;
        let imagesToProcess = (incomingImages?.length > 0)
            ? incomingImages.slice(0, 10)
            : [{ processType: 'AI_SYNTHESIS', originalUrl: '' }];

        await verifyTenant(tenantId, 0);
        const docRef = db.collection('tasks').doc(taskId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) throw new Error("找不到任務");

        const taskData = docSnap.data();
        const mission = taskData.missionContext || taskData.payload?.missionContext || taskData.payload || {};
        const isComicMode = mission.universe === 'COMIC';
        const presentationMode = mission.presentationMode || 'CLASSIC';

        // 寫實模式：前端 plannedImageCount 可對應多張 AI 合成；漫畫維持單次呼叫多格（避免 panel slice 錯位）
        if ((!incomingImages || incomingImages.length === 0) && plannedImageCount && !isComicMode) {
            const n = Math.min(10, Math.max(1, parseInt(plannedImageCount, 10) || 1));
            if (n > 1) {
                imagesToProcess = Array.from({ length: n }, () => ({ processType: 'AI_SYNTHESIS', originalUrl: '' }));
            }
        }
        const aiCount = imagesToProcess.filter(img => img.processType === 'AI_SYNTHESIS').length; 
        
        let mergedPanels = [];
        if (isComicMode && taskData.draftContent.panels) {
            mergedPanels = taskData.draftContent.panels.map(dbP => {
                const ep = editedPanels?.find(p => p.panel_number === dbP.panel_number);
                return { ...dbP, dialogue: ep ? ep.dialogue : dbP.dialogue };
            }).sort((a, b) => a.panel_number - b.panel_number);
        }

        // 🚀 抓取 DB 中的負向防呆咒語
        const dbNegativePrompt = taskData.image_options.dbNegativePrompt || "";

        // 🚀【關鍵修復】分離場景圖、角色圖與配件圖，確保三方都能送到大腦，並限制上限！
        const storedReferences = taskData.image_options.referenceImages || [];
        const sceneRefs = storedReferences.filter(img => img.type === 'scene' || !img.type).slice(0, 1);
        const charRefs = storedReferences.filter(img => img.type === 'character').slice(0, 3);
        const accessoryRefs = storedReferences.filter(img => img.type === 'accessory' || img.type === 'object').slice(0, 3);

        const aiReferences = [];
        const allRefsToProcess = [...sceneRefs, ...charRefs, ...accessoryRefs];
        
        for (let img of allRefsToProcess) {
            if (img.imageUrl) {
                const converted = await fetchImageUrlToBase64(img.imageUrl);
                if (converted) {
                    aiReferences.push({ type: img.type, mimeType: converted.mimeType, data: converted.data });
                }
            } else if (img.dataUrl || img.data) {
                // 容錯：如果存的是原生 Base64
                const rawData = img.dataUrl || img.data;
                aiReferences.push({ type: img.type, mimeType: img.mimeType || 'image/jpeg', data: rawData });
            }
        }

        let cleanImageOptions = { 
            ...taskData.image_options, 
            negativePrompt: [
                taskData.image_options.negativePrompt || "", 
                dbNegativePrompt, 
                "watermark, signature, text, words, artist name, copyright, trademark, literal eyeballs popping out"
            ].filter(Boolean).join(", "), 
            referenceImages: aiReferences // 🚀 這裡現在包含了場景與角色的完整基因鏈！
        };
        
        let baseImagePrompt = "";
        if (isComicMode) {
            const stylePrefix = taskData.image_options.dbStylePrompt || taskData.image_options.style || "";
            const colorPositive = mission.colorMode === 'BW' ? "[COLOR: PURE BLACK AND WHITE] Monochrome manga, greyscale, screentone. " : "[COLOR: FULL] Vibrant color manga. ";
            const colorNegative = mission.colorMode === 'BW' ? "color, colored, colorful" : "monochrome, b&w, greyscale";
            
            cleanImageOptions.negativePrompt = [cleanImageOptions.negativePrompt, colorNegative].filter(Boolean).join(", ");
            baseImagePrompt = `${stylePrefix}\n\n${colorPositive}\n`;

            if (taskData.extracted_features?.lockedCharacterPrompt) {
                baseImagePrompt += `${taskData.extracted_features.lockedCharacterPrompt}\n\n`;
            }

            // 🚀 強制要求 AI 看圖畫人
            if (charRefs.length > 0) {
                baseImagePrompt += `[CHARACTER REFERENCE]: MUST strictly use the provided Character Reference images to maintain facial features, hair, and clothing consistency.\n\n`;
            }

            if (sceneRefs.length > 0) {
                baseImagePrompt += `[SCENE REFERENCE]: Use it for background layout and setting. If it contains people, preserve their faces and identity; do not substitute different characters.\n\n`;
            }

            if (accessoryRefs.length > 0) {
                baseImagePrompt += `[ACCESSORY REFERENCE]: Depict the accessory objects (such as watch, book, coffee cup) accurately using the provided Accessory Reference images, integrating them naturally into the scene.\n\n`;
            }
        } else {
            baseImagePrompt = taskData.draftContent.visual_prompt || `A high-quality photograph. Scene: ${mission.topic}.`;
            
            if (taskData.extracted_features?.lockedCharacterPrompt) {
                baseImagePrompt += `\n\n${taskData.extracted_features.lockedCharacterPrompt}\n\n`;
            }
            // 🚀 強制要求 AI 看圖畫人
            if (charRefs.length > 0) {
                baseImagePrompt += `[CHARACTER REFERENCE]: MUST strictly maintain facial features and identity from the provided Character Reference images.\n\n`;
            }

            if (sceneRefs.length > 0) {
                baseImagePrompt += `[REFERENCE IMAGE]: Use for environment, lighting, and composition. If it shows a person, depict the same individual—same face, apparent age, and build—not a different person.\n\n`;
            }

            if (accessoryRefs.length > 0) {
                baseImagePrompt += `[ACCESSORY REFERENCE]: Depict the accessory objects (like watch, book, coffee cup) accurately using the provided Accessory Reference images.\n\n`;
            }
        }

        await docRef.update({ social_post_draft: editedCaption, status: 'PROCESSING_IMAGES' });

        const finalImagesArray = [];
        let totalUploadedBytes = 0;

        for (let i = 0; i < imagesToProcess.length; i++) {
            let processedImg = { imageId: `img_${String(i + 1).padStart(2, '0')}`, processType: imagesToProcess[i].processType, finalUrl: '', status: 'PENDING', qaStatus: 'PASS' };

            if (imagesToProcess[i].processType === 'ORIGINAL') {
                try {
                    const uploadRes = await uploadBase64ToStorage(imagesToProcess[i].originalUrl, `${taskId}_${processedImg.imageId}`);
                    processedImg.finalUrl = uploadRes.url; 
                    totalUploadedBytes += uploadRes.bytes; 
                    processedImg.status = 'COMPLETED';
                } catch (upErr) { processedImg.status = 'FAILED'; }
            } 
            else {
                let currentImagePrompt = baseImagePrompt;
                let chunkExpectedText = ""; 
                
                if (isComicMode) {
                    const chunkPanels = mergedPanels.slice(i * 4, (i + 1) * 4);
                    const actualCount = chunkPanels.length;
                    
                    let gridCommand = "";
                    if (actualCount === 1) gridCommand = "[CRITICAL LAYOUT]: Single panel, full canvas illustration. NO grid dividers.";
                    else if (actualCount === 2) gridCommand = "[CRITICAL LAYOUT]: EXACTLY a 2-panel comic grid. DO NOT draw 4 panels.";
                    else if (actualCount === 3) gridCommand = "[CRITICAL LAYOUT]: EXACTLY a 3-panel comic grid.";
                    else gridCommand = "[CRITICAL LAYOUT]: A standard 4-panel comic grid (Yonkoma).";

                    currentImagePrompt += `\n${gridCommand}\n[SCENE DETAILS]:\n`;
                    
                    chunkPanels.forEach((panel, idx) => {
                        let charNameStr = mission.characters?.[0]?.name || "character";
                        if (presentationMode === 'CINEMATIC') {
                            currentImagePrompt += `Panel ${idx + 1}: ${charNameStr} is doing: ${panel.action_en}. [CINEMATIC POSTER MODE]: NO text, NO speech bubbles.\n`;
                        } else {
                            currentImagePrompt += `Panel ${idx + 1}: ${charNameStr} is doing: ${panel.action_en}. Draw dialogue bubble and write exact Chinese text '${panel.dialogue}'.\n`;
                            chunkExpectedText += panel.dialogue + " ";
                        }
                    });
                }
                
                try {
                    processedImg.finalUrl = await aiService.generateImage(currentImagePrompt, taskId, cleanImageOptions);
                    processedImg.status = 'COMPLETED';

                    if (isComicMode && presentationMode === 'CLASSIC' && chunkExpectedText.trim().length > 0) {
                        processedImg.qaStatus = await aiService.verifyImageText(processedImg.finalUrl, chunkExpectedText.trim());
                    } else {
                        processedImg.qaStatus = 'PASS';
                    }
                } catch (imgError) {
                    await sendErrorAlert('生圖 API (失敗)', imgError, `任務 ID: ${taskId}`, '跳過此圖片');
                    processedImg.status = 'FAILED';
                }
            }
            finalImagesArray.push(processedImg);
        }

        let billingResult = null;
        if (billingService && billingService.chargeAndLog) {
            if (aiCount > 0) {
                const resolutionForBilling = taskData.image_options?.resolution || mission.resolution || '1K';
                const resWeight = getImageGenBillingMultiplier(resolutionForBilling);
                const imageBillingMultiplier = aiCount * resWeight;
                billingResult = await billingService.chargeAndLog({
                    uid: tenantId,
                    actionType: 'GENERATE_IMAGE',
                    multiplier: imageBillingMultiplier,
                    referenceId: taskId,
                    metrics: {
                        aiImageCount: aiCount,
                        imageResolution: resolutionForBilling,
                        resolutionBillingWeight: resWeight,
                    },
                    req,
                });
            }
            if (totalUploadedBytes > 0) await billingService.chargeAndLog({ uid: tenantId, actionType: 'UPLOAD_IMAGE', multiplier: 1, referenceId: taskId, metrics: { storageBytesUploaded: totalUploadedBytes }, req });
        }

        const validImages = finalImagesArray.filter(img => img.status === 'COMPLETED');
        const defaultUrl = validImages.length > 0 ? validImages[0].finalUrl : '';

        await docRef.update({ status: 'IMAGE_READY', images: finalImagesArray, imageCount: finalImagesArray.length, generated_image_url: defaultUrl });
        const taskDocumentPersistedAt = new Date().toISOString();
        await sendClientTelegram(tgConfig, `🎨 <b>生圖發包完成！</b>\n合成已完畢，請至系統檢查最終圖文。`);
        
        return res.status(200).json({
            success: true,
            images: validImages,
            persistence: { taskDocumentSaved: true, persistedAt: taskDocumentPersistedAt },
            chargedPoints: billingResult ? billingResult.cost : 0,
            newBalance: billingResult ? billingResult.newBalance : undefined
        });

    } catch (error) { 
        await sendErrorAlert('生圖 API', error, `任務 ID: ${req.body.taskId}`, '回傳 500');
        return res.status(500).json({ success: false, message: error.message }); 
    }
}

// ==========================================
// ✨ API：AI 魔法濃縮引擎
// ==========================================
async function compressComicPanels(req, res) {
    try {
        const { tenantId, taskId, panels } = req.body;
        await verifyTenant(tenantId, 0);
        
        const docRef = db.collection('tasks').doc(taskId);
        const promptText = `你是一個漫畫編輯。請將劇本「濃縮」成「完美的 4 格漫畫」！【鐵律】每格對白不超過 9 個字。原始劇本:\n${JSON.stringify(panels)}\n請輸出純 JSON 陣列。`;
        const aiResponse = await aiService.generateTextGemini(promptText);
        let jsonText = aiResponse.text.substring(aiResponse.text.indexOf('['), aiResponse.text.lastIndexOf(']') + 1);
        const compressedPanels = JSON.parse(jsonText);

        await docRef.update({ "draftContent.panels": compressedPanels });
        return res.status(200).json({ success: true, panels: compressedPanels });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ==========================================
// 🚀 API 3：一鍵發佈與排程
// ==========================================
async function publishTask(req, res) {
    try {
        const { taskId, tenantId, scheduledAt, finalCaption, multiCaptions, isIndependentPost } = req.body;
        const docRef = db.collection('tasks').doc(taskId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) throw new Error("找不到任務");
        if (tenantId) await verifyTenant(tenantId, 0);

        const taskData = docSnap.data();
        const captionBase = finalCaption || taskData.social_post_final || taskData.social_post_draft;
        const platforms = resolvePlatformsFromTask(taskData);
        const rawHadPlatforms =
            (Array.isArray(taskData.payload?.platforms) && taskData.payload.platforms.length > 0) ||
            (Array.isArray(taskData.missionContext?.platforms) && taskData.missionContext.platforms.length > 0);

        if (platforms.length === 0) {
            throw new Error(rawHadPlatforms ? '中斷：平台代碼無法辨識（請使用 FB / IG / THREADS）' : '中斷：未選擇平台！');
        }

        const imageUrlsToPublish = resolveImageUrlsFromTask(taskData, req.body);
        if (imageUrlsToPublish.length === 0) throw new Error('中斷：沒有可發佈的圖片網址（請確認已生圖或附件已上傳）。');

        let billingResult = null;
        if (tenantId && billingService && billingService.chargeAndLog) {
            billingResult = await billingService.chargeAndLog({ uid: tenantId, actionType: 'PUBLISH_POST', multiplier: 1, referenceId: taskId, req });
        }

        if (scheduledAt) {
            await docRef.update({
                status: 'SCHEDULED',
                scheduledAt,
                social_post_final: captionBase,
                updatedAt: new Date().toISOString(),
            });
            return res.status(200).json({ 
                success: true, 
                message: "已寫入排程！",
                chargedPoints: billingResult ? billingResult.cost : 0,
                newBalance: billingResult ? billingResult.newBalance : undefined
            });
        }

        await docRef.update({ status: 'PUBLISHING' });

        let apiCalls = 0;
        for (const plat of platforms) {
            const caption =
                isIndependentPost && multiCaptions && typeof multiCaptions === 'object' && multiCaptions[plat]
                    ? multiCaptions[plat]
                    : captionBase;
            if (plat === 'FB') {
                await socialService.publishToFacebookAPI(imageUrlsToPublish, caption);
                apiCalls++;
            } else if (plat === 'IG') {
                await socialService.publishToInstagramAPI(imageUrlsToPublish, caption);
                apiCalls++;
            } else if (plat === 'THREADS') {
                await socialService.publishToThreadsAPI(imageUrlsToPublish, caption);
                apiCalls++;
            }
        }
        if (apiCalls === 0) throw new Error('中斷：沒有任何平台完成 Meta 發佈呼叫（請檢查平台設定）。');

        await docRef.update({
            status: 'PUBLISHED',
            social_post_final: captionBase,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        await sendClientTelegram(taskData.payload?.tgConfig, `🚀 <b>發佈成功！</b>\n您的貼文已成功投遞至 ${platforms.join(', ')}。`);

        return res.status(200).json({ 
            success: true, 
            message: "發布成功！",
            chargedPoints: billingResult ? billingResult.cost : 0,
            newBalance: billingResult ? billingResult.newBalance : undefined
        });
    } catch (error) {
        try {
            await db.collection('tasks').doc(req.body.taskId).update({
                status: 'PUBLISH_FAILED',
                errorMsg: error.message,
                updatedAt: new Date().toISOString(),
            });
        } catch (e) {
            /* ignore */
        }
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ==========================================
// 📜 API：獲取歷史卷宗與算力帳單
// ==========================================
async function getAuditLogs(req, res) {
    try {
        const tenantId = req.query.tenantId;
        if (!tenantId) {
            return res.status(400).json({ success: false, message: "缺少 tenantId 參數" });
        }
        
        const tenantRef = db.collection('tenants').doc(tenantId);

        const snapshot = await db.collection('transactions')
            .where('tenantId', 'in', [tenantId, tenantRef])
            .get();
            
        let logs = []; 
        snapshot.forEach(doc => { 
            logs.push({ id: doc.id, ...doc.data() }); 
        });
        
        logs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        logs = logs.slice(0, 50);
        
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.error("讀取 Audit Logs 失敗:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ==========================================
// 🔍 API：AI 參考圖多模態分析與創意情境推薦
// ==========================================
async function analyzeReferences(req, res) {
    try {
        const { tenantId, referenceImages, universe, characters } = req.body;
        const costPts = PRICING?.BASE_FEES?.ANALYZE_REFERENCES || 10;
        const { tenantRef, tenantData } = await verifyTenant(tenantId, costPts);

        if (!referenceImages || referenceImages.length === 0) {
            throw new Error("沒有提供任何參考圖可供分析！");
        }

        const aiReferences = [];
        for (let img of referenceImages) {
            const url = img.imageUrl || img.dataUrl || img.data;
            if (!url) continue;
            
            if (url.startsWith('http')) {
                const converted = await fetchImageUrlToBase64(url);
                if (converted) {
                    aiReferences.push({ type: img.type, mimeType: converted.mimeType, data: converted.data });
                }
            } else if (url.startsWith('data:')) {
                const rawData = url.split(',')[1];
                const mimeType = url.split(';')[0].split(':')[1];
                aiReferences.push({ type: img.type, mimeType, data: rawData });
            }
        }

        if (aiReferences.length === 0) {
            throw new Error("圖片載入或轉碼失敗。");
        }

        let characterContext = "";
        if (characters && characters.length > 0) {
            characterContext = `\n此外，使用者已在角色基因庫中選定以下人物角色，你【必須】在產生的 Prompt 視覺描述（約 50-80 字）中明確提及這些角色的名字並描述他們的行動/互動，將他們合理且自然地融入情境中：\n` +
                characters.map(c => `- 姓名: ${c.name}\n  特徵/人設: ${c.persona || '無'}`).join('\n');
        }

        const systemPrompt = `你是一個創意行銷導演與視覺設計師。
請分析上傳的參考圖片（可能包含場景、角色或隨身配件），並為即將生成的社群貼文（如FB/IG）推薦 3 個不同的創意發想情境（例如：焦點在配件的時尚風、焦點在人物神態的職場風、或者是故事感強烈的日常風）。
請務必將這些場景、人物與配件自然地融合。${characterContext}
請精準輸出 JSON 格式，不要有 markdown code block 或其他雜質，語言必須是繁體中文：
{
  "options": [
    {
      "title": "情境 A 標題 (如：都會休閒風)",
      "description": "簡短的情境視覺描述，說明這個情境的視覺重點與氛圍。",
      "prompt": "要套用的 Prompt 主題描述 (包含角色、背景與配件的互動，約 50-80 字)"
    },
    {
      "title": "情境 B 標題",
      "description": "...",
      "prompt": "..."
    },
    {
      "title": "情境 C 標題",
      "description": "...",
      "prompt": "..."
    }
  ]
}`;

        const contents = [ { text: systemPrompt } ];
        aiReferences.forEach((img) => {
            contents.push({
                inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data }
            });
        });

        const aiResponse = await visionAi.models.generateContent({
            model: aiConfig.MODELS.AI_MODEL_VISION,
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.7
            }
        });

        let jsonText = aiResponse.text || "";
        const startIndex = jsonText.indexOf('{');
        const endIndex = jsonText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
            jsonText = jsonText.substring(startIndex, endIndex + 1);
        }
        
        const result = JSON.parse(jsonText);

        let billingResult = null;
        if (billingService && billingService.chargeAndLog) {
            const tokensUsed = aiResponse.usageMetadata?.totalTokenCount || 0;
            billingResult = await billingService.chargeAndLog({
                uid: tenantId,
                actionType: 'ANALYZE_REFERENCES',
                multiplier: 1,
                referenceId: `analyze_${Date.now()}`,
                metrics: { 
                    imageCount: aiReferences.length,
                    geminiTokensUsed: tokensUsed,
                    inTokens: aiResponse.usageMetadata?.promptTokenCount || 0,
                    outTokens: aiResponse.usageMetadata?.candidatesTokenCount || 0
                },
                req
            });
        }

        return res.status(200).json({
            success: true,
            options: result.options || [],
            chargedPoints: billingResult ? billingResult.cost : costPts,
            newBalance: billingResult ? billingResult.newBalance : (tenantData.totalPoints - costPts)
        });

    } catch (error) {
        console.error("💥 analyzeReferences 失敗:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    generateDraft,
    generateImageFromDraft,
    compressComicPanels,
    publishTask,
    getAuditLogs,
    analyzeReferences
};