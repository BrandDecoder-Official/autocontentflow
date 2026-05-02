// services/billing.service.js
const firestoreService = require('./firestore.service');
const db = firestoreService.db || firestoreService;
const { PRICING } = require('../config/pricing.config');

/**
 * 📊 從資料庫抓取最新的定價設定 (上帝視角 - V10 完全體)
 */
async function getDynamicPricing() {
    try {
        const doc = await db.collection('system_configs').doc('global_pricing').get();
        if (!doc.exists) throw new Error("資料庫中找不到定價設定 (global_pricing)");
        
        const dbPricing = doc.data();
        
        // 📦 打包完整的財務設定
        const pricingConfig = {
            exchangeRate: dbPricing.exchangeRate || 10,
            globalProfitMultiplier: dbPricing.globalProfitMultiplier || 4,
            token_rates: dbPricing.token_rates || { input_divisor: 100, output_divisor: 50 },
            actions: {}
        };

        // 遍歷所有動作，建立一個純淨的售價地圖
        if (dbPricing.actions) {
            for (const [action, data] of Object.entries(dbPricing.actions)) {
                pricingConfig.actions[action] = {
                    name: data.name || action,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    retailPoints: data.retailPoints || 0,
                    platformMap: data.platformMap || null,
                    isDynamic: data.isDynamic || false
                };
            }
        }
        return pricingConfig;
    } catch (error) {
        console.error("❌ 讀取資料庫定價失敗:", error);
        // Fallback 防崩潰設定
        return { 
            exchangeRate: 10, globalProfitMultiplier: 4, 
            token_rates: { input_divisor: 100, output_divisor: 50 }, 
            actions: {} 
        };
    }
}

/**
 * 核心計費與日誌寫入引擎 (V10: 支援底價 + Token 動態疊加計費)
 * @param {string} uid - 用戶 ID
 * @param {string} actionType - 動作類型 (如 GENERATE_IMAGE, GENERATE_DRAFT)
 * @param {number} multiplier - 執行次數倍數 (如生 4 張圖就傳 4)
 * @param {object} payload - 額外參數 (如 { platforms: ['FB', 'IG'] })
 * @param {string} referenceId - 關聯的 TaskId
 * @param {object} metrics - 消耗指標 (如 { geminiTokensUsed: 1500, inTokens: 1000, outTokens: 500 })
 */
async function chargeAndLog({ uid, actionType, multiplier = 1, payload = {}, referenceId, metrics = {}, req }) {
    
    // 1. 取得最新價目表
    const pricingTable = await getDynamicPricing();
    
    // 如果是單純的大腦對話扣點 (前端 Agent 聊天)，可以直接傳入 TOKEN_USAGE，不需要定義在 actions 裡
    const isPureTokenBilling = (actionType === 'TOKEN_USAGE');
    let configData = isPureTokenBilling ? { name: "大腦對話思考", isActive: true, retailPoints: 0 } : pricingTable.actions[actionType];

    // global_pricing 未配置時，角色／人設建檔費 fallback 至 pricing.config.js BASE_FEES
    if (!configData && !isPureTokenBilling) {
        const feePts = PRICING.BASE_FEES[actionType];
        if (feePts != null) {
            const labels = {
                CREATE_CHARACTER: '建立專屬角色（視覺基因）',
                CREATE_PERSONA: '訓練品牌人設'
            };
            configData = {
                name: labels[actionType] || actionType,
                isActive: true,
                retailPoints: feePts
            };
        }
    }

    if (!configData) throw new Error(`系統錯誤：未知的計費動作 [${actionType}]`);
    if (!configData.isActive) throw new Error(`功能 [${configData.name}] 維護中`);

    // 2. 🌟 執行「5/4/3」與「底價」精算邏輯
    let baseCostPoints = 0;
    let finalDescription = configData.name;

    if (actionType === 'PUBLISH_POST' && configData.platformMap && payload.platforms) {
        // 如果是發文，依平台累加 (如 FB: 5, IG: 4)
        const selectedPlatforms = Array.isArray(payload.platforms) ? payload.platforms : [];
        selectedPlatforms.forEach(p => {
            baseCostPoints += (configData.platformMap[p] || 0);
        });
        finalDescription = `社群發布 (${selectedPlatforms.join(', ')})`;
    } else {
        // 一般動作讀取 retailPoints，並乘上執行次數 (如生圖 4 張 -> retailPoints * 4)
        baseCostPoints = (configData.retailPoints || 0) * multiplier;
    }

    // 3. 🧠 動態 Token 算力疊加
    let tokenCostPoints = 0;
    if (metrics && (metrics.inTokens || metrics.outTokens || metrics.geminiTokensUsed)) {
        // 若無明確區分輸入輸出，則用粗略 8/2 法則估算
        const inTokens = metrics.inTokens || (metrics.geminiTokensUsed ? metrics.geminiTokensUsed * 0.8 : 0);
        const outTokens = metrics.outTokens || (metrics.geminiTokensUsed ? metrics.geminiTokensUsed * 0.2 : 0);
        
        // 套用 DB 的除數計算法
        const inCost = inTokens / pricingTable.token_rates.input_divisor;
        const outCost = outTokens / pricingTable.token_rates.output_divisor;
        
        tokenCostPoints = Math.ceil(inCost + outCost);
        
        if (tokenCostPoints > 0) {
            finalDescription += ` (含 Token 算力: ${tokenCostPoints}點)`;
        }
    }

    const totalCostPoints = baseCostPoints + tokenCostPoints;
    
    // 如果是 0 元免費動作，直接 return 成功，不寫資料庫省資源
    //if (totalCostPoints === 0) {
    //    return { success: true, cost: 0, newBalance: 'N/A' };
    //}

    // 4. 進入 Firestore Transaction 確保原子性 (防多重併發扣款)
    return await db.runTransaction(async (transaction) => {
        const tenantRef = db.collection('tenants').doc(uid);
        const tDoc = await transaction.get(tenantRef);

        if (!tDoc.exists) throw new Error("找不到用戶錢包資料");

        const currentBalance = tDoc.data().totalPoints || 0;

        if (currentBalance < totalCostPoints) {
            throw new Error(`算力不足！需 ${totalCostPoints} 點，餘額 ${currentBalance} 點`);
        }

        const newBalance = currentBalance - totalCostPoints;

        // 更新餘額
        transaction.update(tenantRef, { 
            totalPoints: newBalance,
            updatedAt: new Date().toISOString()
        });

        // 寫入帳單流水
        const logRef = db.collection('transactions').doc();
        transaction.set(logRef, {
            tenantId: uid,
            taskId: referenceId || 'N/A',
            type: actionType,
            description: finalDescription,
            amount: totalCostPoints, // 總花費 (底價 + Token動態)
            baseAmount: baseCostPoints,
            tokenAmount: tokenCostPoints,
            balanceAfter: newBalance,
            metrics: metrics,
            clientIp: req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : 'SYSTEM',
            createdAt: new Date().toISOString()
        });

        return { success: true, cost: totalCostPoints, newBalance };
    });
}

module.exports = { getDynamicPricing, chargeAndLog };