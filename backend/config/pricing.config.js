// config/pricing.config.js

/**
 * ==========================================
 * 📌 核心設定：pricing.config.js
 * 💡 功能說明：全站統一的財務、計費與成本核算模組。
 * 🚀 架構精神：Config as Code。所有與錢有關的數字全在這裡，絕不散落於 UI 代碼中。
 * ==========================================
 */

// 💱 基礎匯率與平台設定
const USD_TO_TWD = 32;       // 美金對台幣匯率
const TWD_TO_POINTS = 100;   // 1 台幣 = 100 點算力 (V10 新模式)

const PRICING = {
    // 🌟 原始成本區 (Google 官網定價，轉換為每 1K Tokens 或 單張 方便計算)
    COSTS_USD: {
        // 💬 AI_MODEL_TALK (gemini-3.1-flash-lite) -> 負責日常對話/小任務
        TALK_INPUT_PER_1K: 0.00025,  
        TALK_OUTPUT_PER_1K: 0.0015,  
        
        // 📝 AI_MODEL_TEXT (gemini-3.1-flash) -> 負責產出劇本草稿 (高智商)
        TEXT_INPUT_PER_1K: 0.0005,   
        TEXT_OUTPUT_PER_1K: 0.003,   
        
        // 🎨 AI_MODEL_IMAGE (gemini-3.1-flash-image) -> 官方依「輸出／解析度」計價之單張美金參考值
        // 見 https://ai.google.dev/gemini-api/docs/pricing （Image output / Gemini 3.1 Flash Image 等）
        IMAGE_PER_GEN: {
            "0.5K": 0.045,
            "1K": 0.067,
            "2K": 0.101,
            "4K": 0.151
        },

        // 🗄️ 資料庫寫入成本 (保留)
        DB_WRITE_PER_OP: 0.00000036
    },

    // 🎯 毛利率倍率控制器
    MARGINS: {
        TALK: 4,    // 聊天對話：4倍毛利
        TEXT: 5,    // 劇本草稿：5倍毛利
        IMAGE: 3    // 影像合成：3倍毛利
    },

    // 💸 基礎節點手續費 (買路財：即使 Token 消耗極少，也要收的保底「算力點數」)
    BASE_FEES: {
        CREATE_PERSONA: 500,   // 訓練人設建檔費 (約5元)
        CREATE_CHARACTER: 800, // 萃取視覺基因建檔費 (約8元)
        GENERATE_DRAFT: 200,   // 發想草稿起步價 (約2元，加上 Token 費用為總價)
        PUBLISH_PER_PLATFORM: 10 // 🚀 每個平台發送費 (約0.1元，防禦惡意洗版並建立勞務價值)
    },

    // 🎁 系統初始化防線
    INITIAL_FREE_POINTS: 3000 // 配合 1:100 模式，送新用戶 30 台幣的算力
};

const IMAGE_GEN_PRICING_BASE_KEY = '1K';

/** 對齊 API 的 imageSize：512 → 0.5K，其餘未知值 fallback 1K */
function normalizeImageResolutionKey(label) {
    const r = String(label || IMAGE_GEN_PRICING_BASE_KEY).trim().toUpperCase();
    if (r === '512') return '0.5K';
    const table = PRICING.COSTS_USD.IMAGE_PER_GEN;
    if (Object.prototype.hasOwnProperty.call(table, r)) return r;
    return IMAGE_GEN_PRICING_BASE_KEY;
}

/**
 * 相對於 1K 的官方單張成本倍率；扣點時 effectiveMultiplier = 張數 × 本值（再 × DB 的 GENERATE_IMAGE retailPoints）
 */
function getImageGenBillingMultiplier(resolutionLabel) {
    const key = normalizeImageResolutionKey(resolutionLabel);
    const table = PRICING.COSTS_USD.IMAGE_PER_GEN;
    const base = table[IMAGE_GEN_PRICING_BASE_KEY];
    const c = table[key] ?? base;
    return base > 0 ? c / base : 1;
}

// ==========================================
// 🛠️ 算力自動換算引擎 (供後端 Controller 直接呼叫)
// ==========================================
const Calculator = {
    
    /**
     * 計算 Token 消耗應扣除的算力 (基礎費 + Token變動費)
     * @param {string} modelType - 'TALK' 或 'TEXT'
     * @param {number} inputTokens - 輸入的 Token 數
     * @param {number} outputTokens - 輸出的 Token 數
     * @param {string} baseFeeKey - 選填，PRICING.BASE_FEES 中的 Key
     */
    calculateTokenPoints: (modelType, inputTokens, outputTokens, baseFeeKey = null) => {
        let inputCostPer1K = 0; let outputCostPer1K = 0; let margin = 1;

        if (modelType === 'TALK') {
            inputCostPer1K = PRICING.COSTS_USD.TALK_INPUT_PER_1K;
            outputCostPer1K = PRICING.COSTS_USD.TALK_OUTPUT_PER_1K;
            margin = PRICING.MARGINS.TALK;
        } else if (modelType === 'TEXT') {
            inputCostPer1K = PRICING.COSTS_USD.TEXT_INPUT_PER_1K;
            outputCostPer1K = PRICING.COSTS_USD.TEXT_OUTPUT_PER_1K;
            margin = PRICING.MARGINS.TEXT;
        } else {
            return 0; // 未知模型防呆
        }

        // 1. 算美金成本
        const inputCostUsd = (inputTokens / 1000) * inputCostPer1K;
        const outputCostUsd = (outputTokens / 1000) * outputCostPer1K;
        const totalCostUsd = inputCostUsd + outputCostUsd;

        // 2. 轉台幣並乘上毛利
        const priceTwd = totalCostUsd * USD_TO_TWD * margin;
        
        // 3. 轉算力點數 (無條件進位)
        let finalPoints = Math.ceil(priceTwd * TWD_TO_POINTS);

        // 4. 如果有指定基礎手續費，則疊加上去
        if (baseFeeKey && PRICING.BASE_FEES[baseFeeKey]) {
            finalPoints += PRICING.BASE_FEES[baseFeeKey];
        }

        return finalPoints;
    },

    /**
     * 計算生圖應扣除的算力 (依據解析度與張數)
     * @param {string} resolution - '0.5K', '1K', '2K', '4K'
     * @param {number} imageCount - 產出的圖片張數
     */
    calculateImagePoints: (resolution = '1K', imageCount = 1) => {
        const key = normalizeImageResolutionKey(resolution);
        const costPerImageUsd = PRICING.COSTS_USD.IMAGE_PER_GEN[key] || PRICING.COSTS_USD.IMAGE_PER_GEN['1K'];
        const totalCostUsd = costPerImageUsd * imageCount;
        const priceTwd = totalCostUsd * USD_TO_TWD * PRICING.MARGINS.IMAGE;
        
        return Math.ceil(priceTwd * TWD_TO_POINTS);
    }
};

module.exports = {
    PRICING,
    Calculator,
    USD_TO_TWD,
    TWD_TO_POINTS,
    normalizeImageResolutionKey,
    getImageGenBillingMultiplier,
};