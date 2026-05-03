// config/env.config.js
require('dotenv').config();

const requiredEnvs = ['GEMINI_API_KEY', 'TG_BOT_TOKEN', 'TG_ADMIN_CHAT_ID'];
requiredEnvs.forEach((env) => {
    if (!process.env[env]) {
        console.warn(`⚠️ 警告: 尚未設定環境變數 ${env}`);
    }
});

/** FB / IG Graph 共用 Page Access Token — 僅來自 .env / 程序環境（勿再寫死在程式内） */
const META_PAGE_ACCESS_TOKEN =
    process.env.PAGE_ACCESS_TOKEN ||
    process.env.FB_PAGE_TOKEN ||
    process.env.META_PAGE_ACCESS_TOKEN ||
    '';

/** Threads 發佈 — 僅來自環境變數 */
const THREADS_ACCESS_TOKEN =
    process.env.THREADS_TOKEN ||
    process.env.THREADS_ACCESS_TOKEN ||
    '';

if (!META_PAGE_ACCESS_TOKEN) {
    console.warn('⚠️ 警告: 未設定 PAGE_ACCESS_TOKEN / FB_PAGE_TOKEN（Meta 發佈將無法使用）');
}
if (!THREADS_ACCESS_TOKEN) {
    console.warn('⚠️ 警告: 未設定 THREADS_TOKEN（Threads 發佈將無法使用）');
}

module.exports = {
    // 🛡️ 這裡加上了 'lllcnd' 終極防護，Vertex AI 絕對不會再迷路了
    PROJECT_ID: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'lllcnd',
    LOCATION: process.env.LOCATION || 'asia-east1', 

    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    TG_BOT_TOKEN: process.env.TG_BOT_TOKEN,
    TG_ADMIN_CHAT_ID: process.env.TG_ADMIN_CHAT_ID,

    FB_PAGE_ID: process.env.FB_PAGE_ID || '',
    FB_PAGE_TOKEN: META_PAGE_ACCESS_TOKEN,
    PAGE_ACCESS_TOKEN: META_PAGE_ACCESS_TOKEN,
    IG_USER_ID: process.env.IG_USER_ID || '',
    THREADS_TOKEN: THREADS_ACCESS_TOKEN,
    
    // 備用圖床與儲存桶
    IMGBB_API_KEY: 'fb632e13958ef6XXXXXXXX', 

    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'bd-autocontentflow-media' ,
    // 👇🌟 新增：超級管理員與戰情室專屬變數
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS || 'brand.decoderai@gmail.com',
    CRON_SECRET: process.env.CRON_SECRET || 'my-super-secret-cron-key'
};