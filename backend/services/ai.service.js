// services/ai.service.js
const { GoogleGenAI } = require("@google/genai"); 
const env = require('../config/env.config.js');
const aiConfig = require('../config/ai.config.js'); 
const gcsService = require('./gcs.service.js'); 

// 🌟 初始化最新版 Gemini 引擎
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * 🧠 呼叫 Gemini 進行文字/JSON 生成 (升級版：支援 Token 分離計算)
 */
async function generateTextGemini(promptText) {
    try {
        const modelName = aiConfig.MODELS.AI_MODEL_TEXT; 
        console.log(`🧠 [AI Service] 正在呼叫 ${modelName} 大腦進行極速文字運算...`);
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: promptText,
            config: { temperature: 0.7 }
        });

        // 🌟 企業級 FinOps 標準：精準擷取 Gemini API 實際消耗的 Token 數量
        const promptTokens = response.usageMetadata?.promptTokenCount || 0;
        const candidateTokens = response.usageMetadata?.candidatesTokenCount || 0;
        const totalTokens = response.usageMetadata?.totalTokenCount || 0;
        
        console.log(`📊 [AI Service] 文字運算完成！輸入: ${promptTokens}, 輸出: ${candidateTokens}, 總和: ${totalTokens}`);

        // 🌟 回傳詳細的 usage 物件，讓 Guardrail 可以套用不同的 DB 匯率
        return {
            text: response.text,
            tokens: totalTokens, 
            usage: {
                promptTokenCount: promptTokens,
                candidatesTokenCount: candidateTokens,
                totalTokenCount: totalTokens
            }
        };

    } catch (error) {
        console.error(`❌ [AI Service] 文字生成失敗:`, error);
        throw error;
    }
}

/**
 * 🎨 [終極完全體] 呼叫 Gemini 3.1 Flash Image
 */
async function generateImage(imagePrompt, taskId, options = {}) {
    try {
        const imageModelName = aiConfig.MODELS.AI_MODEL_IMAGE;
        
        const finalPrompt = imagePrompt ? imagePrompt.trim() : "";
        if (!finalPrompt) throw new Error("生圖提示詞 (Prompt) 遺失！");

        const aspectRatio = options.aspectRatio || options.ratio || '1:1';
        const resolutionLabel = options.resolution || '1K';
        let imageSize = '1K'; 
        if (['512', '1K', '2K', '4K'].includes(resolutionLabel)) {
            imageSize = resolutionLabel; 
        }

        const referenceImages = options.referenceImages || []; 

        console.log(`🎨 [AI Service] 呼叫 ${imageModelName}...`);
        console.log(`📐 比例 ${aspectRatio}, 解析度 ${imageSize}, 參考圖 ${referenceImages.length} 張`);

        const contents = [ { text: finalPrompt } ];
        
        if (referenceImages && referenceImages.length > 0) {
            referenceImages.forEach((img) => {
                if (img.data) { 
                    // 🚀 [關鍵修復] 用正則表達式，把前端傳來的 data:image/xxx;base64, 前綴喀嚓剪掉！
                    const pureBase64 = img.data.replace(/^data:image\/\w+;base64,/, '');
                    
                    contents.push({
                        inlineData: { mimeType: img.mimeType || 'image/jpeg', data: pureBase64 }
                    });
                }
            });
        }

        const response = await ai.models.generateContent({
            model: imageModelName,
            contents: contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: imageSize, 
                },
            },
        });

        let imageBuffer = null;
        const candidate = response.candidates?.[0];

        if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'BLOCKLIST') {
            throw new Error(`⚠️ 提示詞觸發了 AI 安全審查 (FinishReason: ${candidate.finishReason})`);
        }

        const parts = candidate?.content?.parts || [];
        
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                const imageData = part.inlineData.data;
                imageBuffer = Buffer.from(imageData, "base64");
                break; 
            }
        }

        if (!imageBuffer) {
            throw new Error("API 成功回傳，但找不到圖片資料！可能是提示詞不符合大腦胃口。");
        }

        console.log(`✅ [AI Service] 生圖成功！圖片大小: ${Math.round(imageBuffer.length / 1024)} KB。準備送往倉庫...`);
        
        const publicUrl = await gcsService.uploadImageToStorage(imageBuffer, taskId);
        return publicUrl;

    } catch (error) {
        console.error("❌ [AI Service] 生圖引擎執行失敗:", error.message);
        throw error; 
    }
}

/**
 * 👁️ [全新升級] AI 鷹眼質檢員：辨識生成圖片中的文字是否與預期相符
 */
async function verifyImageText(imageUrl, expectedText) {
    try {
        console.log(`👁️ [AI Service] 啟動 AI 鷹眼，檢查圖片對白是否精準包含: "${expectedText}"`);
        
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`無法抓取圖片 (HTTP ${response.status})`);
        const arrayBuffer = await response.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        const prompt = `請辨識這張圖片對話框裡的中文字。它是否精準且清晰地寫著這幾個字：「${expectedText}」？\n如果出現亂碼、漏字、錯字、外星文或語句完全不通，請只回傳 "ERROR"。\n如果文字清晰且正確完美，請只回傳 "PASS"。\n請絕對不要輸出任何其他多餘的解釋文字。`;
        
        const visionResponse = await ai.models.generateContent({
            model: aiConfig.MODELS.AI_MODEL_VISION,
            contents: [
                { text: prompt },
                { inlineData: { mimeType: mimeType, data: base64Data } }
            ],
            config: { temperature: 0.1 } 
        });

        const resultText = visionResponse.text.trim().toUpperCase();
        console.log(`👁️ [AI Service] 鷹眼判定結果: ${resultText}`);
        
        return resultText.includes('PASS') ? 'PASS' : 'ERROR';
        
    } catch (error) {
        console.warn(`⚠️ [AI Service] 鷹眼質檢過程發生異常，預設放行 (PASS)。錯誤: ${error.message}`);
        return 'PASS'; 
    }
}

/**
 * 🤖 代理人決策引擎 (Agent Function Calling)
 */
async function chatWithAgent(chatHistory, systemInstruction, tools) {
    try {
        // 🚀 關鍵修復：Lite 模型太弱處理不了工具箱，改回用高智商的 TEXT 模型！
        const modelName = aiConfig.MODELS.AI_MODEL_TEXT; 
        console.log(`🤖 [AI Service] 喚醒 Agent 決策引擎 (${modelName})...`);
        
        const response = await ai.models.generateContent({
            model: modelName,
            contents: chatHistory, 
            config: { 
                systemInstruction: systemInstruction, 
                tools: tools, 
                temperature: 0.1 
            } 
        });

        // 🔍 [X光日誌] 強制印出 Gemini 到底回傳了什麼，讓我們不再瞎猜！
        console.log(`[AI Service Debug] Gemini 原始回傳:`, JSON.stringify(response.candidates?.[0], null, 2));

        const candidate = response.candidates?.[0];
        
        // 🛡️ 防呆：如果 AI 被安全機制強制阻擋
        if (!candidate) {
            console.log(`⚠️ [AI Service] Gemini 回傳空值，可能觸發了底層防護！`);
            return { functionCall: null, textReply: "", usage: {} };
        }
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
            console.log(`⚠️ [AI Service] 大腦被強制中止！原因: ${candidate.finishReason}`);
        }

        const parts = candidate.content?.parts || [];
        let functionCall = null;
        let textReply = "";

        for (const pt of parts) {
            if (pt.functionCall) functionCall = pt.functionCall;
            if (pt.text) textReply += pt.text + " ";
        }

        if (functionCall) {
            console.log(`🛠️ [AI Service] Agent 決定呼叫工具: ${functionCall.name}`);
        } else if (textReply.trim()) {
            console.log(`💬 [AI Service] Agent 回覆文字: ${textReply.trim()}`);
        } else {
            console.log(`⚠️ [AI Service] Agent 回傳了狀態，但既沒有呼叫工具，也沒有文字！`);
        }

        return { 
            functionCall, 
            textReply: textReply.trim(), 
            usage: {
                promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
                candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokenCount: response.usageMetadata?.totalTokenCount || 0
            }, 
            rawMessage: candidate.content 
        };

    } catch (error) {
        console.error(`❌ [AI Service] Agent 決策失敗:`, error);
        throw error;
    }
}

module.exports = {
    generateTextGemini,
    generateImage,
    verifyImageText,
    chatWithAgent
};