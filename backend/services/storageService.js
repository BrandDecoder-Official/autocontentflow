// backend/src/services/storageService.js
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const uuid = require('uuid');

// 初始化 GCS 客戶端 (Firebase 環境下會自動抓取憑證)
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || 'your-project-id.appspot.com';
const bucket = storage.bucket(bucketName);

/**
 * 將 Base64 圖片上傳至 Cloud Storage
 * @param {string} base64Data - 圖片 Base64 (不含 header)
 * @param {string} mimeType - 例如 'image/jpeg'
 * @param {string} folder - 儲存資料夾 (例如 'tasks/task_123/ref_images')
 * @returns {Promise<Object>} 回傳檔案網址與精準 Bytes 大小
 */
async function uploadBase64ToGCS(base64Data, mimeType, folder) {
    return new Promise((resolve, reject) => {
        // 1. 將 Base64 轉為 Buffer
        const buffer = Buffer.from(base64Data, 'base64');
        const fileExtension = mimeType.split('/')[1] || 'jpg';
        const fileName = `${folder}/${uuid.v4()}.${fileExtension}`;
        const file = bucket.file(fileName);

        // 2. 建立寫入流
        const stream = file.createWriteStream({
            metadata: { contentType: mimeType },
            resumable: false // 小型圖片不需要斷點續傳
        });

        stream.on('error', (err) => reject(err));

        stream.on('finish', async () => {
            // 3. 設定檔案權限為公開讀取 (若您的應用需要私有，此處可改為產生 Signed URL)
            try {
                await file.makePublic();
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                
                resolve({
                    url: publicUrl,
                    fileName: fileName,
                    sizeBytes: buffer.length // 這是極度精準的 DB 費與儲存費計算基礎
                });
            } catch (err) {
                reject(err);
            }
        });

        stream.end(buffer);
    });
}

module.exports = { uploadBase64ToGCS };