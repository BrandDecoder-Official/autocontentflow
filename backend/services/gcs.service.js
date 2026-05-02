// services/gcs.service.js
const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env.config');

// 初始化 Storage 客戶端 (Cloud Run 環境會自動認證)
const storage = new Storage({ projectId: env.PROJECT_ID });
const bucket = storage.bucket(env.GCS_BUCKET_NAME);

/**
 * 📤 將生圖的二進位資料上傳至 GCS，並取得公開網址
 * @param {Buffer} imageBuffer - 圖片的二進位 Buffer
 * @param {string} taskId - 任務 ID (用於分類路徑)
 * @returns {Promise<string>} - 圖片的公開 URL
 */
async function uploadImageToStorage(imageBuffer, taskId) {
    try {
        console.log(`📦 [GCS Service] 準備上傳任務 ${taskId} 的圖片到倉庫...`);

        // 1. 生成獨一無二的檔名 (資料夾結構: tasks/任務ID/圖片名)
        const fileName = `tasks/${taskId}/generated_${uuidv4()}.png`;
        const file = bucket.file(fileName);

        // 2. 開始上傳 (設定檔案類型為 PNG)
        await file.save(imageBuffer, {
            contentType: 'image/png',
            resumable: false, 
            metadata: {
                cacheControl: 'public, max-age=31536000', // 允許快取
            }
        });

        // 3. 確保單一檔案設為公開讀取 (讓 Telegram 能抓到圖)
        //await file.makePublic();

        // 4. 組合並回傳公開網址
        const publicUrl = `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${fileName}`;
        console.log(`✅ [GCS Service] 圖片上傳成功！網址: ${publicUrl}`);
        
        return publicUrl;

    } catch (error) {
        console.error("❌ [GCS Service] 上傳失敗:", error);
        throw new Error(`倉庫上傳失敗: ${error.message}`);
    }
}

module.exports = {
    uploadImageToStorage
};