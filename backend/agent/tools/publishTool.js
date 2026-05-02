// agent/tools/publishTool.js
const socialService = require('../../services/social.service');

/**
 * 🛠️ 第三把瑞士刀 (實戰版)：社群發佈工具 (Publishing Tool)
 * 職責：呼叫真實的 Facebook / Instagram / Threads API 進行發佈。
 */
exports.execute = async (platforms, caption, images) => {
    console.log(`[Tool: PublishTool] 收到發佈指令，準備派發至平台：${platforms.join(', ')}`);

    try {
        // 取得圖片網址清單
        const imageUrls = images.map(img => img.finalUrl).filter(Boolean);
        
        if (imageUrls.length === 0) throw new Error("無效的圖片網址，無法發佈。");

        const results = [];

        // 🚀 根據總編選擇的平台，逐一呼叫真實的 Social Service
        if (platforms.includes('FB')) {
            console.log(`[Tool: PublishTool] 正在發佈至 Facebook...`);
            await socialService.publishToFacebookAPI(imageUrls, caption);
            results.push({ platform: "FB", status: "SUCCESS" });
        }

        if (platforms.includes('IG')) {
            console.log(`[Tool: PublishTool] 正在發佈至 Instagram...`);
            await socialService.publishToInstagramAPI(imageUrls, caption);
            results.push({ platform: "IG", status: "SUCCESS" });
        }

        if (platforms.includes('THREADS')) {
            console.log(`[Tool: PublishTool] 正在發佈至 Threads...`);
            await socialService.publishToThreadsAPI(imageUrls, caption);
            results.push({ platform: "THREADS", status: "SUCCESS" });
        }

        console.log(`[Tool: PublishTool] 所有平台發佈程序執行完畢。`);
        return results;

    } catch (error) {
        console.error(`[Tool: PublishTool] 發生致命錯誤:`, error);
        throw new Error(`社群發佈工具異常: ${error.message}`);
    }
};