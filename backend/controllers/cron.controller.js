// controllers/cron.controller.js
const firestoreService = require('../services/firestore.service');
const socialService = require('../services/social.service');
const telegramService = require('../services/telegram.service'); 
const env = require('../config/env.config.js');
const { resolvePlatformsFromTask, resolveImageUrlsFromTask } = require('../utils/publishResolve.js');

const db = firestoreService.db || firestoreService;

// 通關密語與管理員設定
const CRON_SECRET = process.env.CRON_SECRET || 'branddecoder-super-secret-cron-key';
const ADMIN_CHAT_ID = env.ADMIN_CHAT_ID || process.env.ADMIN_CHAT_ID;

/**
 * ==========================================
 * 📌 核心控制器：triggerCronJob
 * 💡 功能說明：接收 GCP Cloud Scheduler 的定時敲擊，尋找符合時間的排程任務並發射。
 * 🚀 架構精神：安全第一。必須驗證 CRON_SECRET 才能執行，防範外部惡意觸發大量發文。
 * ==========================================
 */
async function triggerCronJob(req, res) {
    console.log("⏰ [Cron Controller] 收到 GCP Scheduler 的巡邏請求...");

    // 🛡️ 1. 安全驗證：檢查通關密語
    const providedSecret = req.headers['x-cron-secret'] || req.query.secret || req.body.secret;
    if (providedSecret !== CRON_SECRET) {
        console.warn("🚨 [Cron Controller] 遭到未授權的排程觸發！");
        return res.status(403).json({ success: false, message: "Forbidden: Invalid Cron Secret" });
    }

    try {
        const now = new Date();
        const nowISO = now.toISOString();
        
        // 配合 UI 15分鐘的間距，這裡抓過去 15 分鐘內的任務，避免漏網之魚
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60000).toISOString();

        const snapshot = await db.collection('tasks')
            .where('status', '==', 'SCHEDULED')
            .where('scheduledAt', '<=', nowISO)
            .where('scheduledAt', '>=', fifteenMinsAgo)
            .get();

        if (snapshot.empty) {
            console.log("🟢 [Cron Controller] 目前無待發射任務。");
            return res.status(200).json({ success: true, message: "No pending tasks." });
        }

        console.log(`🚀 [Cron Controller] 發現 ${snapshot.size} 筆排程任務準備發射！`);

        const batchPromises = [];
        snapshot.forEach(doc => {
            const taskData = doc.data();
            batchPromises.push(executeScheduledTask(doc.id, taskData));
        });

        // 🛡️ 2. 平行處理：等待所有任務執行完畢 (使用 allSettled 避免單一任務失敗拖垮全域)
        const results = await Promise.allSettled(batchPromises);
        
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failCount = results.filter(r => r.status === 'rejected').length;

        return res.status(200).json({ 
            success: true, 
            message: `Cron job executed. Success: ${successCount}, Failed: ${failCount}`
        });

    } catch (error) {
        console.error("🚨 [Cron Controller] 巡邏發生嚴重錯誤:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * ==========================================
 * 📌 核心服務：executeScheduledTask
 * 💡 功能說明：執行單一任務的社群發布邏輯。
 * 🚀 架構精神：V10 標準化。僅採用 missionContext 結構，確保資料格式單一、穩定且高效。
 * ==========================================
 */
async function executeScheduledTask(taskId, taskData) {
    console.log(`[Cron Controller] 正在發射任務: ${taskId}`);
    const docRef = db.collection('tasks').doc(taskId);
    
    // 優先看任務是否有綁定特定的 TG ID，若無則發給總編
    const targetChatId = taskData.chatId || ADMIN_CHAT_ID;

    try {
        await docRef.update({ status: 'PUBLISHING' });

        // 1. 取得文案：優先取校稿後的 final，若無則取初稿 draft
        const captionToPublish = taskData.social_post_final || taskData.social_post_draft;
        
        // 2–3. 平台與圖片：與 publish API 同一套解析（含 payload.platforms、task.images、附件）
        const platforms = resolvePlatformsFromTask(taskData);
        const imageUrlsToPublish = resolveImageUrlsFromTask(taskData, {});

        // 🛡️ 發射前檢查：確保有平台且有圖，否則 Meta API 會噴錯
        if (platforms.length === 0 || imageUrlsToPublish.length === 0) {
            throw new Error("任務封包不完整：缺少平台設定或有效的圖片網址");
        }

        console.log(`[Cron Controller] 🚀 啟動多平台連發：共 ${imageUrlsToPublish.length} 張圖 -> [${platforms.join(', ')}]`);

        // 🚀 呼叫底層發送服務
        if (platforms.includes('FB')) await socialService.publishToFacebookAPI(imageUrlsToPublish, captionToPublish);
        if (platforms.includes('IG')) await socialService.publishToInstagramAPI(imageUrlsToPublish, captionToPublish);
        if (platforms.includes('THREADS')) await socialService.publishToThreadsAPI(imageUrlsToPublish, captionToPublish);

        // 更新狀態為已發布，並紀錄時間
        await docRef.update({ 
            status: 'PUBLISHED', 
            publishedAt: new Date().toISOString() 
        });
        
        console.log(`✅ [Cron Controller] 任務 ${taskId} 順利登陸！`);

        // 📱 傳送 Telegram 戰報
        if (targetChatId) {
            try {
                const previewImage = imageUrlsToPublish[0];
                const scheduledTimeStr = taskData.scheduledAt ? new Date(taskData.scheduledAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '立即發布';
                
                const successMessage = `🎉 <b>[任務發射成功]</b>\n━━━━━━━━━━━━━━━━━━\n📌 <b>編號：</b> <code>${taskId.slice(-6)}</code>\n🚀 <b>平台：</b> ${platforms.join(', ')}\n🖼️ <b>規格：</b> 1張主圖 + ${imageUrlsToPublish.length - 1}張附加圖\n🗓️ <b>排程：</b> ${scheduledTimeStr}\n✅ <b>狀態：</b> 已成功部署至社群`;
                
                await telegramService.sendPhoto(targetChatId, previewImage, successMessage);
            } catch (tgErr) {
                console.warn(`[Cron Controller] TG戰報發送失敗:`, tgErr.message);
            }
        }

        return true;

    } catch (error) {
        console.error(`❌ [Cron Controller] 任務 ${taskId} 發射崩潰:`, error);
        
        await docRef.update({ 
            status: 'PUBLISH_FAILED',
            errorMsg: error.message 
        });

        if (targetChatId) {
            const errorMessage = `🚨 <b>[任務發射失敗警報]</b>\n━━━━━━━━━━━━━━━━━━\n📌 <b>編號：</b> <code>${taskId.slice(-6)}</code>\n❌ <b>原因：</b> ${error.message}\n⚠️ <b>請進入後台檢查任務設定。</b>`;
            await telegramService.sendMessage(targetChatId, errorMessage).catch(() => {});
        }
        throw error;
    }
}

module.exports = { triggerCronJob };