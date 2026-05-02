// services/telegram.service.js
const TelegramBot = require('node-telegram-bot-api');
const env = require('../config/env.config.js');

// 初始化 TG Bot (專門給系統管理員/總編用的單例 Bot)
const token = env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

/**
 * 🛡️ 共用函數：安全 HTML 裝甲
 * 避免 AI 產生的 Markdown 或標籤搞壞 Telegram
 */
function sanitizeHtml(text) {
    if (!text) return "";
    let safeHtmlText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    safeHtmlText = safeHtmlText.replace(/</g, '&lt;').replace(/>/g, '&gt;')
                               .replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
    return safeHtmlText;
}

/**
 * 📤 發送文字訊息 (系統管理員專用)
 */
async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        const safeHtmlText = sanitizeHtml(text);
        const options = { parse_mode: 'HTML' }; 
        
        if (replyMarkup) {
            options.reply_markup = replyMarkup.reply_markup || replyMarkup;
        }
        
        return await bot.sendMessage(chatId, safeHtmlText, options);
    } catch (error) {
        console.error("❌ [Telegram Service] sendMessage 失敗:", error);
        throw error;
    }
}

/**
 * 🆕 ✈️ 發送多租戶文字訊息 (V10 商業版客戶專用通道)
 * @param {string} botToken - 客戶自訂的 Bot Token
 * @param {string} chatId - 客戶自訂的 Chat ID
 * @param {string} text - 訊息內容
 */
async function sendDynamicMessage(botToken, chatId, text) {
    try {
        if (!botToken || !chatId) return null;
        
        const safeHtmlText = sanitizeHtml(text);
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text: safeHtmlText, 
                parse_mode: 'HTML' 
            })
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.description || 'Telegram HTTP API 請求失敗');
        }
        return data;
    } catch (error) {
        console.error("❌ [Telegram Service] sendDynamicMessage 失敗:", error);
        // 如果客戶的 Token 填錯，我們不拋出錯誤中斷主程式，只在後端印出 log
        return null;
    }
}

/**
 * 🖼️ 發送圖片與圖說給總編 (系統管理員專用)
 */
async function sendPhoto(chatId, photoUrl, captionText = "") {
    try {
        const safeCaption = sanitizeHtml(captionText);
        return await bot.sendPhoto(chatId, photoUrl, { 
            caption: safeCaption, 
            parse_mode: 'HTML' 
        });
    } catch (error) {
        console.error("❌ [Telegram Service] sendPhoto 失敗:", error);
        throw error;
    }
}

/**
 * 🧹 移除訊息下方的按鈕
 */
async function removeInlineKeyboard(chatId, messageId) {
    try {
        return await bot.editMessageReplyMarkup(
            { inline_keyboard: [] }, 
            { chat_id: chatId, message_id: messageId }
        );
    } catch (error) {
        console.error("⚠️ [Telegram Service] 移除按鈕失敗 (可能已移除):", error.message);
    }
}

/**
 * ✅ 產生「任務審核」專用的按鈕
 */
function getReviewKeyboard(taskId) {
    return {
        inline_keyboard: [
            [
                { text: "✅ 核准發包 (生圖)", callback_data: `publish_${taskId}` },
                { text: "❌ 退回作廢", callback_data: `cancel_${taskId}` }
            ]
        ]
    };
}

/**
 * 📰 產生「RSS 新聞選擇」專用的按鈕
 */
function getNewsSelectionKeyboard(taskId, topNews) {
    const buttons = topNews.map((news, index) => {
        return { text: `${index + 1}️⃣`, callback_data: `news_${taskId}_${index}` };
    });
    return { inline_keyboard: [buttons] };
}

module.exports = {
    bot,
    sendMessage,
    sendDynamicMessage, // 🌟 V10 多租戶發送引擎
    sendPhoto,
    removeInlineKeyboard,
    getReviewKeyboard,
    getNewsSelectionKeyboard
};