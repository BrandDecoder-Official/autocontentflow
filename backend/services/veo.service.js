const { GoogleGenAI } = require("@google/genai");
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// 1. 初始化 Google Gen AI SDK (會自動去抓環境變數裡的 GEMINI_API_KEY)
const ai = new GoogleGenAI({});

// 2. 初始化雲端硬碟
const storage = new Storage();
const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;

class VeoService {
    
    /**
     * 🎬 路線二：頭尾幀插值運算 (Veo 3.1)
     * @param {string} taskId 任務 ID
     * @param {string} prompt 動作提示詞 (例如: "老K驚訝地轉頭")
     * @param {string} firstImageBase64 頭幀的 Base64 字串 (不含 data:image/jpeg;base64,)
     * @param {string} lastImageBase64 尾幀的 Base64 字串
     */
    async generateInterpolationVideo(taskId, prompt, firstImageBase64, lastImageBase64) {
        console.log(`[Veo 導演] 任務 ${taskId} 啟動：頭尾幀插值管線 (Veo 3.1)...`);

        try {
            // 🌟 依照官方文件格式準備頭尾幀
            const firstImage = {
                imageBytes: firstImageBase64,
                mimeType: "image/jpeg" 
            };
            
            const lastImage = {
                imageBytes: lastImageBase64,
                mimeType: "image/jpeg"
            };

            console.log(`[Veo 導演] 正在將任務發包給 Veo 3.1 引擎...`);
            
            // 🌟 呼叫官方 generateVideos API
            let operation = await ai.models.generateVideos({
                model: "veo-3.1-generate-preview",
                prompt: prompt,
                image: firstImage, // 頭幀
                config: {
                    lastFrame: lastImage, // 尾幀
                    aspectRatio: "9:16",  // 直向影片 (符合短影音需求)
                    resolution: "1080p"   // 高畫質
                }
            });

            // 🌟 輪詢等待影片完成 (Polling)
            while (!operation.done) {
                console.log(`[Veo 導演] 任務 ${taskId} 運算中... 等待 10 秒...`);
                await new Promise((resolve) => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({
                    operation: operation,
                });
            }

            console.log(`[Veo 導演] 任務 ${taskId} 運算完成！準備下載...`);

            // 🌟 下載影片到 Cloud Run 的暫存資料夾 (/tmp)
            const tempFilePath = path.join('/tmp', `${taskId}_veo.mp4`);
            await ai.files.download({
                file: operation.response.generatedVideos[0].video,
                downloadPath: tempFilePath,
            });

            // 🌟 將暫存檔上傳至 Google Cloud Storage
            if (!bucketName) throw new Error("尚未設定 GOOGLE_CLOUD_STORAGE_BUCKET 環境變數");
            
            const bucket = storage.bucket(bucketName);
            const gcsFileName = `tasks/${taskId}/veo_final.mp4`;
            const file = bucket.file(gcsFileName);

            console.log(`[Veo 導演] 正在將影片轉存至 Storage: ${gcsFileName}...`);
            await file.save(fs.readFileSync(tempFilePath), {
                contentType: 'video/mp4',
                metadata: { cacheControl: 'public, max-age=31536000' }
            });

            // 清理 Cloud Run 記憶體暫存
            fs.unlinkSync(tempFilePath);

            // 回傳正式公開網址
            const finalUrl = `https://storage.googleapis.com/${bucketName}/${gcsFileName}`;
            console.log(`[Veo 導演] 🎉 影片正式產出：${finalUrl}`);
            
            return finalUrl;

        } catch (error) {
            console.error("[Veo 導演] 影片生成失敗:", error);
            throw error;
        }
    }
}

module.exports = new VeoService();