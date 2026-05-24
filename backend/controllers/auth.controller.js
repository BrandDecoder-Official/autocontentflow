// controllers/auth.controller.js
const { OAuth2Client } = require('google-auth-library');
// 替換成您自己的 Google Client ID
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); 

// 🛡️ 安全載入外部模組
let db, telegramService;
try {
    const firestoreModule = require('../services/firestore.service');
    db = firestoreModule.db || firestoreModule;
} catch (error) { console.error("💥 Firestore 載入失敗:", error); }

try {
    telegramService = require('../services/telegram.service');
} catch (error) { console.error("💥 Telegram 模組載入失敗:", error); }


async function verifyLogin(req, res) {
    try {
        const { credential } = req.body;
        if (!credential) throw new Error("缺少登入憑證");

        // 1. 安全驗證 Google Token (絕對不能只在前端解碼，會被駭客偽造！)
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const uid = payload.sub; // 這就是永遠不變的 Google UID
        const email = payload.email;
        const name = payload.name;

        // 2. 查詢 Firestore 租戶資料庫
        const tenantRef = db.collection('tenants').doc(uid);
        const docSnap = await tenantRef.get();

        if (!docSnap.exists) {
            // 🆕 新用戶：建立資料，狀態設為 PENDING (待審核)
            await tenantRef.set({
                email: email,
                name: name,
                status: 'PENDING', // ⚠️ 鎖定狀態
                totalPoints: 0,    // 審核通過後 Super Admin 再發放點數
                totalComputeUsed: 0, // 與 Guardrail / 儀表板累計一致，便於多租戶報表
                role: 'USER',
                createdAt: new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // 🚨 發送 Telegram 警報給總編 (Super Admin)
            if (telegramService && process.env.TG_ADMIN_CHAT_ID) {
                const alertMsg = `🚨 **[SaaS 新租戶申請]**\n\n👤 姓名：${name}\n✉️ Email：${email}\n🆔 UID：${uid}\n\n⚠️ 狀態：待審核 (PENDING)\n👉 總編，請至 Firestore 審核並配發點數後，將狀態改為 'ACTIVE' 以開通權限。`;
                try {
                    await telegramService.sendMessage(process.env.TG_ADMIN_CHAT_ID, alertMsg);
                    console.log(`✅ 已發送新租戶通知至 Telegram`);
                } catch (tgError) {
                    console.error(`❌ Telegram 通知發送失敗:`, tgError.message);
                }
            }

            return res.status(200).json({ success: true, status: 'PENDING', message: '帳號已記錄，等待管理員審核開通！' });
        }

        const tenantData = docSnap.data();

        // 3. 檢查帳號狀態
        if (tenantData.status === 'PENDING') {
            // ⏳ 審核中
            return res.status(200).json({ success: true, status: 'PENDING', message: '您的帳號正在審核中，請稍候或聯繫管理員。' });
        } else if (tenantData.status === 'ACTIVE') {
            // ✅ 已開通：更新最後登入時間並放行
            await tenantRef.update({ lastLoginAt: new Date().toISOString() });
            return res.status(200).json({ 
                success: true, 
                status: 'ACTIVE', 
                uid: uid,
                totalPoints: tenantData.totalPoints,
                tier: tenantData.tier || (tenantData.totalPoints > 10000 ? 'APEX' : (tenantData.totalPoints > 3000 ? 'PRO' : 'FREE'))
            });
        } else {
            // ❌ 被停權或其他狀態
            return res.status(403).json({ success: false, message: '帳號異常或已被停權，請聯繫客服。' });
        }

    } catch (error) {
        console.error('❌ 登入驗證失敗:', error);
        return res.status(401).json({ success: false, message: '登入驗證失敗' });
    }
}

module.exports = { verifyLogin };