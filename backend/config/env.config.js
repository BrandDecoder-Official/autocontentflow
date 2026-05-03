// config/env.config.js
require('dotenv').config();

const requiredEnvs = ['GEMINI_API_KEY'];
requiredEnvs.forEach((env) => {
    if (!process.env[env]) {
        console.warn(`⚠️ 警告: 尚未設定環境變數 ${env}`);
    }
});
if (!process.env.TG_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ 警告: 尚未設定 TG_BOT_TOKEN 或 TELEGRAM_BOT_TOKEN');
}
if (!process.env.TG_ADMIN_CHAT_ID && !process.env.TELEGRAM_CHAT_ID) {
    console.warn('⚠️ 警告: 尚未設定 TG_ADMIN_CHAT_ID 或 TELEGRAM_CHAT_ID');
}

/** 暫時單租戶：Meta / Threads 預設寫在本檔；若設了環境變數則優先覆寫。多租戶時改由 DB 讀取即可移除此備援。 */
const META_PAGE_ACCESS_TOKEN =
    process.env.PAGE_ACCESS_TOKEN ||
    process.env.FB_PAGE_TOKEN ||
    process.env.META_PAGE_ACCESS_TOKEN ||
    'EAAiWsrJrH9kBRbTWyi0YH5VthcZAFF6LHm2FHsLiZCUnYu8K4mqAfh6XZBaFJjsxQYZBQAFIgTPok0PkdDHPFF9PX47HXjIvkJhajJCMqINq4Ln5jcZAzWOSdqIJg0eGAWQvPEqIxnYaLxZAfDk26dBzpAtAs09IgAWhyZCHoe20Q6uYdlLiJrcrJp0cZAM9zCDYXW6w1dCdyJI2Oplil9wu1LZBrbCj3a9OyXAzvlAtosCr9u2SqTaENZBlRJOKDVugfSLP1KZBwsvTbKjmreP51I7MB5lZA30NUqUCBwZDZD';

const THREADS_ACCESS_TOKEN =
    process.env.THREADS_TOKEN ||
    process.env.THREADS_ACCESS_TOKEN ||
    'THAAMMD5n4QFxBUVNnd3VVdDg5RE4tTzhUSS0xZAzZAFbzc1d09sU3NPeHJrazlVN0pWWTBoQUY1MWtGaE82T0wwN1VITkdLOXpzclJLVW9kaXNZATENiX01JbmVUUWdGb1VlRW9yaEd0bTNiWTJYcmJJWlRnVUp6M3EwZADk4OTBnc1lpOGY4WVlBSTZAPdUZALSFEZD';

module.exports = {
    // 🛡️ 這裡加上了 'lllcnd' 終極防護，Vertex AI 絕對不會再迷路了
    PROJECT_ID:
        process.env.GCP_PROJECT_ID ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.PROJECT_ID ||
        'lllcnd',
    LOCATION: process.env.LOCATION || 'asia-east1', 

    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TG_BOT_TOKEN: process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    TG_ADMIN_CHAT_ID: process.env.TG_ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID,

    FB_PAGE_ID: process.env.FB_PAGE_ID || '757950400744695',
    FB_PAGE_TOKEN: META_PAGE_ACCESS_TOKEN,
    PAGE_ACCESS_TOKEN: META_PAGE_ACCESS_TOKEN,
    IG_USER_ID: process.env.IG_USER_ID || '17841466353046590',
    THREADS_TOKEN: THREADS_ACCESS_TOKEN,
    
    // 備用圖床與儲存桶
    IMGBB_API_KEY: 'fb632e13958ef6XXXXXXXX', 

    GCS_BUCKET_NAME:
        process.env.GCS_BUCKET_NAME ||
        process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
        'bd-autocontentflow-media',
    // 👇🌟 新增：超級管理員與戰情室專屬變數
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS || 'brand.decoderai@gmail.com',
    CRON_SECRET: process.env.CRON_SECRET || 'my-super-secret-cron-key'
};