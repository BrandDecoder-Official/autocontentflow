// ==========================================
// 🎮 總指揮官：影音生成控制器 (video.controller.js)
// 專職：接收前端請求、調度 TTS 與 Veo 引擎、處理資料庫與通知
// ==========================================
const db = require('../services/firestore.service');
const veoService = require('../services/veo.service');
const ttsService = require('../services/tts.service'); // 稍後實作
const telegramService = require('../services/telegram.service');

const videoController = {

    // ==========================================
    // 🎬 路線一：生成有聲動態漫畫
    // ==========================================
    async generateMangaVideo(req, res) {
        try {
            const { taskId, voiceProfile } = req.body; 
            console.log(`[Video Controller] 啟動動態漫畫管線，任務 ID: ${taskId}`);

            let comicPanels, scriptData;

            // 🧪 總編專屬：無資料庫測試通道
            if (taskId === "test_mock") {
                console.log("[Video Controller] ⚠️ 進入無資料庫測試模式，使用模擬腳本...");
                // 給 4 張網路上隨機的圖片當作漫畫格
                comicPanels = [
                    "https://picsum.photos/seed/panel1/1080/1920",
                    "https://picsum.photos/seed/panel2/1080/1920",
                    "https://picsum.photos/seed/panel3/1080/1920",
                    "https://picsum.photos/seed/panel4/1080/1920"
                ];
                // 硬塞 4 句台詞給老 K 唸
                scriptData = [
                    { dialogue: "這茶罐是媽祖保佑過的喔！" },
                    { dialogue: "你看這包裝，多精美啊！" },
                    { dialogue: "經理，你說是不是？" },
                    { dialogue: "好啦好啦，今天算你便宜一點！" }
                ];
            } else {
                // 📦 這裡保留原來的真實資料庫連線邏輯，等之後串接用
                const docRef = db.collection('tasks').doc(taskId);
                const docSnap = await docRef.get();
                if (!docSnap.exists) throw new Error("找不到任務資料");
                const taskData = docSnap.data();
                comicPanels = taskData.generated_panels; 
                scriptData = taskData.draftContent.panels; 
            }

            if (!comicPanels || !scriptData) {
                throw new Error("缺少靜態漫畫圖或對白腳本！");
            }

            // 先回傳 200 解放前端
            res.status(200).json({ success: true, message: "🎥 動態漫畫已進入背景運算 (測試模式)..." });

            // 🌟 發包給聲優與大導演
            const audioTracks = await ttsService.generateBatchAudio(scriptData, voiceProfile);
            const finalVideoUrl = await veoService.generateAnimatedManga({
                taskId: taskId,
                comicPanels: comicPanels,
                audioTracks: audioTracks
            });

            console.log("🎉 測試影片生成成功：", finalVideoUrl);
            // await telegramService.sendVideo(...) // 如果您還沒設定 Telegram，這行可以先註解掉

        } catch (error) {
            console.error(`[Video Controller] 生成失敗:`, error);
        }
    },

   // ==========================================
    // 🎬 路線二：生成寫實插值影片 (Veo 3.1)
    // ==========================================
    async generateInterpolationVideo(req, res) {
        try {
            const { taskId, motionPrompt } = req.body;
            console.log(`[Video Controller] 啟動頭尾幀插值管線，任務 ID: ${taskId}`);

            // 先回傳 200 解放前端 (因為 Veo 3.1 運算要滿久的)
            res.status(200).json({ success: true, message: "🎥 Veo 3.1 插值運算已進入背景排程..." });

            let firstImageBase64, lastImageBase64, prompt;

            // 🧪 總編專屬：無資料庫測試通道
            if (taskId === "test_mock") {
                console.log("[Video Controller] ⚠️ 進入 Veo 測試模式，自動抓取網路圖片...");
                
                // 為了測試，我們讓伺服器自己去抓兩張隨機圖，並轉成 Base64
                const axios = require('axios');
                const fetchImageAsBase64 = async (url) => {
                    const response = await axios.get(url, { responseType: 'arraybuffer' });
                    return Buffer.from(response.data, 'binary').toString('base64');
                };

                // 抓兩張 1080x1920 的直式圖片當作頭尾幀
                firstImageBase64 = await fetchImageAsBase64("https://picsum.photos/seed/veo1/1080/1920");
                lastImageBase64 = await fetchImageAsBase64("https://picsum.photos/seed/veo2/1080/1920");
                prompt = "A cinematic, haunting video. The scene slowly transforms from the first frame to the second frame with a dramatic lighting change and smooth camera pan.";
                
            } else {
                // 📦 未來這裡會接上您的 Firestore，讀取前端 4-2-4 產出的真實圖片
                // ... (保留給下一步) ...
                throw new Error("目前只開放 test_mock 測試");
            }

            // 🌟 呼叫真正的大導演 (Veo 3.1)
            const veoService = require('../services/veo.service');
            const finalVideoUrl = await veoService.generateInterpolationVideo(
                taskId, 
                prompt, 
                firstImageBase64, 
                lastImageBase64
            );

            console.log("🎉 Veo 3.1 影片生成成功：", finalVideoUrl);
            
            // 如果您的 Telegram Bot 已經設定好，這行就能發送影片給您！
            // const telegramService = require('../services/telegram.service');
            // await telegramService.sendVideo(process.env.TELEGRAM_CHAT_ID, finalVideoUrl, "🎬 總編，Veo 3.1 產出的影片來了！");

        } catch (error) {
            console.error(`[Video Controller] Veo 運算崩潰:`, error);
        }
    }
};

module.exports = videoController;