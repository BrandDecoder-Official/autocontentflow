// controllers/admin.controller.js
const { db } = require('../services/firestore.service');
const { OAuth2Client } = require('google-auth-library');

const { GOOGLE_CLIENT_ID, ALLOWED_EMAILS, CRON_SECRET } = require('../config/env.config');

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// ==========================================
// 🛡️ 核心驗證：上帝視角防護罩
// ==========================================
async function verifySuperAdmin(credential) {
    if (!credential) throw new Error("缺少驗證憑證");
    
    const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    
    const rawEmail = payload.email.toLowerCase();
    const [namePart, domain] = rawEmail.split('@');
    const normalizedLoginEmail = `${namePart.replace(/\./g, '')}@${domain}`;
    
    const adminEnvString = ALLOWED_EMAILS || 'branddecoderai@gmail.com'; 
    const allowedList = adminEnvString.split(',').map(e => {
        const parts = e.trim().toLowerCase().split('@');
        if(parts.length === 2) return `${parts[0].replace(/\./g, '')}@${parts[1]}`;
        return e.trim().toLowerCase();
    });
    
    if (!allowedList.includes(normalizedLoginEmail)) {
        throw new Error(`⚠️ 存取被拒：[${payload.email}] 不在授權名單內。`);
    }
    
    return payload;
}

// ==========================================
// 💰 功能一：手動幫客戶加值算力 (含 Log)
// ==========================================
async function manualTopUp(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('未授權的請求');
        const idToken = authHeader.split('Bearer ')[1];
        const adminData = await verifySuperAdmin(idToken);

        const { targetTenantId, amount, note } = req.body;
        if (!targetTenantId || !amount) throw new Error("缺少必要參數");

        const addPoints = parseInt(amount, 10);

        await db.runTransaction(async (transaction) => {
            const tenantRef = db.collection('tenants').doc(targetTenantId);
            const tenantDoc = await transaction.get(tenantRef);

            if (!tenantDoc.exists) throw new Error("找不到該客戶帳號");
            const currentPoints = tenantDoc.data().totalPoints || 0;
            const newPoints = currentPoints + addPoints;

            transaction.update(tenantRef, { totalPoints: newPoints });

            const logRef = db.collection('transactions').doc();
            transaction.set(logRef, {
                tenantId: targetTenantId,
                type: 'SYSTEM_TOP_UP',
                amount: 0, 
                balanceAfter: newPoints,
                description: `👑 系統管理員手動加值: ${note || '無備註'}`,
                metrics: { addedPoints: addPoints, operator: adminData.email },
                createdAt: new Date().toISOString() 
            });
        });

        return res.status(200).json({ success: true, message: `成功為 ${targetTenantId} 加值 ${addPoints} 點！` });
    } catch (error) {
        console.error('💥 手動加值失敗:', error);
        return res.status(403).json({ success: false, message: error.message });
    }
}

// ==========================================
// 📊 功能二：每日結算引擎
// ==========================================
async function runDailyAggregation(req, res) {
    try {
        const cronSecret = req.headers['x-cron-secret'];
        if (cronSecret !== (process.env.CRON_SECRET || 'my-super-secret-cron-key')) {
            throw new Error("無效的排程呼叫");
        }

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const yesterdayStartStr = yesterday.toISOString();
        const yesterdayEndStr = yesterdayEnd.toISOString();
        const dateString = yesterdayStartStr.split('T')[0];

        const snapshot = await db.collection('transactions')
            .where('createdAt', '>=', yesterdayStartStr)
            .where('createdAt', '<=', yesterdayEndStr)
            .get();

        let totalTokens = 0;
        let totalPointsConsumed = 0;
        let actionCounts = { GENERATE_DRAFT: 0, GENERATE_IMAGE: 0, PUBLISH_POST: 0, SYSTEM_TOP_UP: 0 };

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.metrics && data.metrics.geminiTokensUsed) totalTokens += data.metrics.geminiTokensUsed;
            if (data.amount > 0) totalPointsConsumed += data.amount;
            if (data.type && actionCounts[data.type] !== undefined) actionCounts[data.type] += 1;
        });

        await db.collection('systemStats').doc(dateString).set({
            date: dateString,
            totalTokensUsed: totalTokens,
            totalPointsConsumed: totalPointsConsumed,
            actionCounts: actionCounts,
            transactionCount: snapshot.size,
            createdAt: new Date().toISOString()
        });

        return res.status(200).json({ success: true, message: `${dateString} 結算完成！`, stats: { totalTokens, totalPointsConsumed } });
    } catch (error) {
        console.error('💥 結算排程失敗:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ==========================================
// 📈 功能三：獲取戰情室儀表板數據
// ==========================================
async function getDashboardData(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('未授權的請求');
        const idToken = authHeader.split('Bearer ')[1];
        await verifySuperAdmin(idToken); 

        const statsSnapshot = await db.collection('systemStats')
            .orderBy('date', 'desc')
            .limit(7)
            .get();
            
        const stats = [];
        statsSnapshot.forEach(doc => stats.push(doc.data()));

        const tenantsSnapshot = await db.collection('tenants')
            .orderBy('lastLoginAt', 'desc')
            .get();
            
        const tenants = [];
        tenantsSnapshot.forEach(doc => {
            const data = doc.data();
            
            let safeLoginTime = null;
            if (data.lastLoginAt) {
                if (typeof data.lastLoginAt.toDate === 'function') {
                    safeLoginTime = data.lastLoginAt.toDate().toISOString();
                } else {
                    safeLoginTime = new Date(data.lastLoginAt).toISOString();
                }
            }

            tenants.push({
                uid: doc.id,
                email: data.email || '未知',
                name: data.name || '未命名', 
                role: data.role || 'USER',          
                totalPoints: data.totalPoints || 0,
                status: data.status || 'UNKNOWN',
                lastLoginAt: safeLoginTime
            });
        });

        return res.status(200).json({ success: true, data: { stats, tenants } });
    } catch (error) {
        console.error('💥 獲取戰情數據失敗:', error);
        return res.status(403).json({ success: false, message: error.message });
    }
}

// ==========================================
// 💰 戰情室專用：取得全站動態定價與毛利設定
// ==========================================
async function getPricingConfig(req, res) {
    try {
        // 從 Firestore 撈取您剛剛手動改好的 global_pricing
        const doc = await db.collection('system_configs').doc('global_pricing').get();
        
        if (!doc.exists) {
            return res.status(404).json({ success: false, message: '找不到計費設定' });
        }
        res.status(200).json({ success: true, data: doc.data() });
    } catch (error) { 
        console.error('讀取 Admin 價目表失敗:', error);
        res.status(500).json({ success: false, message: error.message }); 
    }
}

// ==========================================
// 💾 戰情室專用：儲存修改後的定價設定
// ==========================================
async function updatePricingConfig(req, res) {
    try {
        const updatedConfig = req.body;
        // 使用 merge: true 確保不會覆蓋掉其他沒傳過來的欄位
        await db.collection('system_configs').doc('global_pricing').set(updatedConfig, { merge: true });
        
        res.status(200).json({ success: true, message: '定價更新成功' });
    } catch (error) { 
        console.error('更新 Admin 價目表失敗:', error);
        res.status(500).json({ success: false, message: error.message }); 
    }
}

// ==========================================
// 🔓 功能四：審核放行與停權
// ==========================================
async function updateTenantStatus(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('未授權的請求');
        const idToken = authHeader.split('Bearer ')[1];
        const adminData = await verifySuperAdmin(idToken);

        const { targetTenantId, newStatus } = req.body;
        if (!targetTenantId || !newStatus) throw new Error("缺少必要參數");

        await db.collection('tenants').doc(targetTenantId).update({
            status: newStatus,
            updatedAt: new Date().toISOString()
        });

        const logRef = db.collection('transactions').doc();
        await logRef.set({
            tenantId: targetTenantId,
            type: 'SYSTEM_STATUS_CHANGE',
            amount: 0, 
            balanceAfter: null, 
            description: `👑 系統管理員將帳號狀態更改為: ${newStatus}`,
            metrics: { operator: adminData.email },
            createdAt: new Date().toISOString() 
        });

        return res.status(200).json({ success: true, message: `已成功將客戶狀態更新為 ${newStatus}` });
    } catch (error) {
        console.error('💥 更新客戶狀態失敗:', error);
        return res.status(403).json({ success: false, message: error.message });
    }
}

// ==========================================
// 📜 功能五：獲取系統查帳日誌 (支援 Email 篩選)
// ==========================================
async function getAdminLogsData(req, res) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error('未授權的請求');
        const idToken = authHeader.split('Bearer ')[1];
        await verifySuperAdmin(idToken);

        // 接收前端傳來的參數，把 tenantId 改收 email
        const { email, type, startDate, endDate, limitCount = 50 } = req.query;

        let query = db.collection('transactions').orderBy('createdAt', 'desc');

        // 💡 如果有用 Email 搜尋，先去反查 tenantId
        if (email) {
            const tenantSnap = await db.collection('tenants')
                .where('email', '==', email.trim())
                .limit(1)
                .get();
            
            if (tenantSnap.empty) {
                // 找不到這個 Email，直接回傳空紀錄
                return res.status(200).json({ success: true, data: [] });
            }
            const targetTenantId = tenantSnap.docs[0].id;
            query = query.where('tenantId', '==', targetTenantId);
        }

        // 套用其他篩選器
        if (type) query = query.where('type', '==', type);
        if (startDate) query = query.where('createdAt', '>=', startDate);
        if (endDate) {
            const endOfDay = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
            query = query.where('createdAt', '<=', endOfDay);
        }

        query = query.limit(parseInt(limitCount, 10));

        const snapshot = await query.get();
        const logs = [];
        snapshot.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() });
        });

        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error('💥 獲取日誌失敗:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// 🌟 修正：把所有函數正確導出
module.exports = {
    manualTopUp,
    runDailyAggregation,
    getDashboardData,
    updateTenantStatus,
    getAdminLogsData,
    getPricingConfig,      // <- 補上這個
    updatePricingConfig    // <- 補上這個
};