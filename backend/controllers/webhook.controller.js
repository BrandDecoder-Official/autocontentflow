// controllers/webhook.controller.js

// 🌟 1. 頂部乾淨整潔的模組引入
const firestoreService = require('../services/firestore.service.js');
const aiService = require('../services/ai.service.js');
const telegramService = require('../services/telegram.service.js');
const socialService = require('../services/social.service.js');

const db = firestoreService.db || firestoreService;

async function handleTelegramWebhook(req, res) {
    if (!db || !aiService || !telegramService) return res.status(200).send('OK');

    try {
        const update = req.body;
        if (!update || !update.callback_query) return res.status(200).send('OK');

        const callbackQuery = update.callback_query;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data; 

        // 隱藏使用者剛按下的鍵盤
        await telegramService.removeInlineKeyboard(chatId, messageId);

        const parts = data.split('_');
        const action = parts[0]; 
        const taskId = parts[1];

        // ❌ 動作：取消任務
        if (action === 'cancel') {
            await firestoreService.updateTaskStatus(taskId, 'CANCELLED');
            await telegramService.sendMessage(chatId, `❌ 任務 \`${taskId}\` 已取消作廢。`);
            return res.status(200).send('OK');
        }

        // 🎨 動作 1：核准發包 (執行生圖！)
        if (action === 'publish') {
            try { await telegramService.bot.answerCallbackQuery(callbackQuery.id); } catch(e){}

            await telegramService.sendMessage(chatId, "⏳ 收到核准！大腦正在極速生圖中（呼叫最新 Gemini 3.1 引擎），大約需要 15~20 秒，請稍候...");
            await firestoreService.updateTaskStatus(taskId, 'GENERATING_IMAGE');

            const taskData = await firestoreService.getTask(taskId);
            let originalPrompt = taskData.master_image_prompt;
            const postDraft = taskData.social_post_draft || "你的內容已生成！";
            const imageOptions = taskData.image_options || { aspectRatio: '1:1', resolution: '2K', referenceImages: [] };

            // 處理角色參考圖的強制指令
            if (imageOptions.referenceImages && imageOptions.referenceImages.length > 0) {
                originalPrompt += `\n\n[CRITICAL]: Use the provided reference images to accurately depict the character's facial features, hair, and clothing. The generated character MUST visually match the reference.`;
            }

            try {
                // 呼叫生圖引擎
                const imageUrl = await aiService.generateImage(originalPrompt, taskId, imageOptions);

                await firestoreService.updateTaskStatus(taskId, 'IMAGE_READY', { 
                    generated_image_url: imageUrl 
                });

                await telegramService.sendPhoto(chatId, imageUrl, postDraft);

                // ==========================================
                // 🌟 發射社群按鈕
                // ==========================================
                const platform = taskData.payload?.platform || 'FB_IG';
                const postSocialKeyboard = {
                    inline_keyboard: [
                        [{ text: `🚀 確認無誤，一鍵發布至 ${platform}！`, callback_data: `postSocial_${taskId}` }],
                        [{ text: '🔄 換個姿勢，重新生圖', callback_data: `publish_${taskId}` }]
                    ]
                };
                await telegramService.sendMessage(chatId, `🎯 圖文皆已就緒！\n目標平台：${platform}\n請問是否要正式發射至社群？`, postSocialKeyboard);

            } catch (error) {
                console.error(`[Webhook] 任務 ${taskId} 生圖失敗，準備重寫 Prompt:`, error.message);
                
                await telegramService.sendMessage(chatId, "⚠️ 報告總編：原提示詞疑似觸發 AI 安全審查被退件。系統已啟動防呆機制，正在請大腦自動改寫安全的指令...");

                const rewritePrompt = `以下這個生圖提示詞被 API 安全審查拒絕了。請幫我重新改寫一個「絕對安全、不含敏感詞彙（例如過度暴力、真實人名等）」的版本，但必須保留原本的動漫風格與對白設定。請直接回傳新的英文提示詞，不要任何開場白。\n\n原提示詞：\n${originalPrompt}`;
                
                const safePrompt = await aiService.generateTextGemini(rewritePrompt);
                
                await firestoreService.updateTaskStatus(taskId, 'WAITING_REVIEW', { 
                    master_image_prompt: safePrompt.trim() 
                });

                const reviewMsg = `🔄 <b>大腦已自動重寫提示詞</b>\n\n為避開審查，大腦修改了指令如下：\n<code>${safePrompt.trim()}</code>\n\n請總編再次核准發包！`;
                const keyboard = telegramService.getReviewKeyboard(taskId);
                await telegramService.sendMessage(chatId, reviewMsg, keyboard);
            }
            return res.status(200).send('OK');
        }

        // ==========================================
        // 🚀 動作 2：一鍵發射至社群 (Post Social)
        // ==========================================
        if (action === 'postSocial') {
            await telegramService.sendMessage(chatId, "🚀 收到發布指令！工廠管線已開啟，正在將圖文發射至 Meta 宇宙...");
            await firestoreService.updateTaskStatus(taskId, 'PUBLISHING');

            const taskData = await firestoreService.getTask(taskId);
            const imageUrl = taskData.generated_image_url;
            const caption = taskData.social_post_draft;
            const platform = taskData.payload?.platform || 'FB_IG';

            if (!imageUrl || !caption) {
                await telegramService.sendMessage(chatId, "❌ 發布失敗：找不到圖片網址或貼文內容，可能任務已失效。");
                return res.status(200).send('OK');
            }

            try {
                let resultMsg = "✅ **[發布成功戰報]**\n━━━━━━━━━━━━━━━\n";

                if (platform === 'FB_IG' || platform === 'FB') {
                    await socialService.publishToFacebookAPI(imageUrl, caption);
                    resultMsg += "📘 Facebook: 發射成功！\n";
                }
                
                if (platform === 'FB_IG' || platform === 'IG') {
                    await socialService.publishToInstagramAPI(imageUrl, caption);
                    resultMsg += "📸 Instagram: 發射成功！\n";
                }

                if (platform === 'THREADS') {
                    await socialService.publishToThreadsAPI(imageUrl, caption);
                    resultMsg += "🧵 Threads: 發射成功！\n";
                }

                resultMsg += "━━━━━━━━━━━━━━━\n🎉 報告總編，任務圓滿達成！";

                await firestoreService.updateTaskStatus(taskId, 'PUBLISHED', { 
                    publishedAt: new Date().toISOString() 
                });

                await telegramService.sendMessage(chatId, resultMsg);

            } catch (error) {
                console.error("❌ 社群發布失敗:", error);
                await telegramService.sendMessage(chatId, `❌ 發布至社群時發生嚴重錯誤:\n${error.message}\n\n請檢查 Meta Token 是否過期或權限不足。`);
                await firestoreService.updateTaskStatus(taskId, 'PUBLISH_FAILED');
            }
            return res.status(200).send('OK');
        }

        // ✍️ 動作：編輯指令 (預留)
        if (action === 'edit') {
            await telegramService.sendMessage(chatId, `✍️ 請直接輸入您想修改的指令。(⚠️ 開發中...)`);
            return res.status(200).send('OK');
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('❌ [Webhook Controller] 發生錯誤:', error);
        return res.status(200).send('OK');
    }
}

module.exports = {
    handleTelegramWebhook
};