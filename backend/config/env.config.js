// config/env.config.js
require('dotenv').config();

const requiredEnvs = ['GEMINI_API_KEY', 'TG_BOT_TOKEN', 'TG_ADMIN_CHAT_ID'];
requiredEnvs.forEach((env) => {
    if (!process.env[env]) {
        console.warn(`⚠️ 警告: 尚未設定環境變數 ${env}`);
    }
});

module.exports = {
    // 🛡️ 這裡加上了 'lllcnd' 終極防護，Vertex AI 絕對不會再迷路了
    PROJECT_ID: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'lllcnd',
    LOCATION: process.env.LOCATION || 'asia-east1', 

    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TG_BOT_TOKEN: process.env.TG_BOT_TOKEN,
    TG_ADMIN_CHAT_ID: process.env.TG_ADMIN_CHAT_ID, 
    
    //FB_PAGE_TOKEN: process.env.FB_PAGE_TOKEN,
    //IG_USER_ID: process.env.IG_USER_ID,
    //THREADS_TOKEN: process.env.THREADS_TOKEN,

    // 🚀 Meta 生態系 (總編，請依照下方格式填入你的金鑰)
    // ⚠️ 注意：前後都要有引號，結尾要有逗號
    FB_PAGE_ID: '757950400744695',    // 👈 填入你的門牌號碼
    FB_PAGE_TOKEN: 'EAAiWsrJrH9kBRBZAdsrXPqlRTxlyICZCo5pwusXxdfQikZAkJfTz3tPR52JFmv1hwC0RfBbmR6kKugXoncITrr4zRuZBtgjZAxXuEMN200wExjh7EZBsjCdeAZAeZBoCiRlekv7uoGEwtKPlSwtig3HeYFBhuPYPd4RwPvvrm2yCg072JQ5o2pa4xxxad0Mp5VNJA9x242AYI1J93XZBCjucZA', // 👈 填入那串長長的金鑰
    IG_USER_ID: '17841466353046590', // 👈 填入 IG 的 ID
    THREADS_TOKEN: 'THAAMMD5n4QFxBUVNnd3VVdDg5RE4tTzhUSS0xZAzZAFbzc1d09sU3NPeHJrazlVN0pWWTBoQUY1MWtGaE82T0wwN1VITkdLOXpzclJLVW9kaXNZATENiX01JbmVUUWdGb1VlRW9yaEd0bTNiWTJYcmJJWlRnVUp6M3EwZADk4OTBnc1lpOGY4WVlBSTZAPdUZALSFEZD', // 👈 填入 Threads 金鑰
    
    // 備用圖床與儲存桶
    IMGBB_API_KEY: 'fb632e13958ef6XXXXXXXX', 

    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'bd-autocontentflow-media' ,
    // 👇🌟 新增：超級管理員與戰情室專屬變數
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS || 'brand.decoderai@gmail.com',
    CRON_SECRET: process.env.CRON_SECRET || 'my-super-secret-cron-key'
};