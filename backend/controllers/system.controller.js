// controllers/system.controller.js
const { db } = require('../services/firestore.service');
const { GoogleGenAI } = require('@google/genai');
const { Storage } = require('@google-cloud/storage');
const { GCS_BUCKET_NAME } = require('../config/env.config'); 
const { MODELS } = require('../config/ai.config');        

// 🌟 核心升級：直接引入實體計費設定檔 (Config as Code，徹底捨棄 DB 讀取)
const { PRICING } = require('../config/pricing.config'); 
// 備註：若您原本的 billingService 還有其他用途可保留，若無則可移除。這裡我們先保留以防萬一。
const billingService = require('../services/billingService'); 

// 🌟 初始化 
const visionAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET_NAME);

class SystemController {
    
    // ==========================================
    // 🚀 API 1：抓取前端 UI 動態選項 (升級版：直接掛載 Config 報價單)
    // ==========================================
    async getUiOptions(req, res) {
        try {
            console.log(`[System API] 正在抓取前端 UI 動態選項與財務報價...`);
            const tenantId = req.query.tenantId || req.body.tenantId;

            const stylesPromise = db.collection('system_styles').where('isActive', '==', true).get();
            const motionsPromise = db.collection('system_motions').where('isActive', '==', true).get();
            
            let charsPromise = Promise.resolve({ forEach: () => {} }); 
            let personasPromise = Promise.resolve({ forEach: () => {} }); 

            if (tenantId) {
                charsPromise = db.collection('system_characters')
                    .where('tenantId', '==', tenantId) 
                    .get();
                
                personasPromise = db.collection('system_personas')
                    .where('tenantId', '==', tenantId)
                    .get();
            }

            const [stylesSnap, motionsSnap, charsSnap, personasSnap] = await Promise.all([
                stylesPromise, motionsPromise, charsPromise, personasPromise
            ]);

            const styles = [];
            stylesSnap.forEach(doc => styles.push({ id: doc.id, ...doc.data() }));

            const motions = [];
            motionsSnap.forEach(doc => motions.push({ id: doc.id, ...doc.data() }));

            const characters = [];
            charsSnap.forEach(doc => {
                const data = doc.data();
                if (data.isActive !== false) characters.push({ id: doc.id, ...data });
            });

            const personas = [];
            personasSnap.forEach(doc => {
                const data = doc.data();
                if (data.isActive !== false) personas.push({ id: doc.id, ...data });
            });

            styles.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            motions.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            characters.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            personas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // 💸 V10 核心：直接從 pricing.config.js 載入全站動態報價單 (0 成本，極速)
            const pricingData = PRICING;

            // 一次打包丟給前端！
            res.status(200).json({
                success: true,
                data: { 
                    styles, 
                    motions, 
                    characters, 
                    personas,
                    pricing: pricingData // 👈 前端收到這包，就能執行零延遲的防呆與預估
                }
            });

        } catch (error) {
            console.error(`[System API] 讀取 UI 選項失敗:`, error);
            res.status(500).json({ success: false, message: "讀取選項失敗" });
        }
    }

    // ==========================================
    // 💰 API 1.5：抓取動態計費表 (提供給純讀取財務的需求，保留向下相容)
    // ==========================================
    async getSystemPricing(req, res) {
        try {
            console.log(`[System API] 正在回傳最新動態計費表...`);
            // 同樣直接回傳 config 內容
            res.status(200).json({
                success: true,
                data: { actions: PRICING }
            });
        } catch (error) {
            console.error(`[System API] 抓取動態計費表失敗:`, error);
            res.status(500).json({ success: false, message: "讀取價目表失敗" });
        }
    }

    // ==========================================
    // 🏦 API 1.8：全域錢包與租戶狀態同步 (新增)
    // 💡 功能說明：供前端 triggerWalletSync 呼叫，取得最新算力餘額
    // ==========================================
    async getTenantConfig(req, res) {
        try {
            const tenantId = req.query.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: "缺少 tenantId" });

            // 假設您的使用者餘額存在 'users' 集合中 (若為 tenants 請自行調整)
            const userDoc = await db.collection('users').doc(tenantId).get();
            
            if (!userDoc.exists) {
                return res.status(404).json({ success: false, message: "找不到該租戶資料" });
            }

            const userData = userDoc.data();
            
            return res.status(200).json({
                success: true,
                tenant: {
                    totalPoints: userData.totalPoints || 0
                }
            });
        } catch (error) {
            console.error(`[System API] 抓取租戶狀態失敗:`, error);
            res.status(500).json({ success: false, message: "讀取租戶狀態失敗" });
        }
    }

    // ==========================================
    // 📸 API 2：建立專屬角色
    // ==========================================
    async createCharacter(req, res) {
        try {
            const { name, persona, imageBase64, mimeType, tenantId } = req.body;

            if (!name || !imageBase64 || !tenantId) {
                return res.status(400).json({ success: false, message: '❌ 請提供角色名字、大頭照與用戶驗證！' });
            }

            const currentCharsSnap = await db.collection('system_characters').where('tenantId', '==', tenantId).get();
            if (currentCharsSnap.size >= 10) {
                return res.status(400).json({ success: false, message: '❌ 您的角色庫已滿 (上限 10 個)，請先刪除舊角色後再新增。' });
            }

            console.log(`👁️ 正在為 [${tenantId}] 的角色 [${name}] 建檔，啟動 ${MODELS.AI_MODEL_TEXT} 特徵分析...`);

            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const gcsFilename = `characters/${tenantId}/${Date.now()}_${name}.jpeg`; 
            const file = bucket.file(gcsFilename);

            await file.save(buffer, { contentType: mimeType || 'image/jpeg' });
            const publicImageUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFilename}`;

            const response = await visionAi.models.generateContent({
                model: MODELS.AI_MODEL_TEXT,
                contents: [
                    { text: `Extract the core physical traits of the person/character in this image. Focus on: gender, age range, hairstyle, facial hair, distinct facial features, and any highly visible accessories (like glasses, hats) or iconic clothing. Output in 1 concise English sentence. Do not describe the background.` },
                    { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } }
                ]
            });

            const aiExtractedFeatures = response.text.trim();
            console.log(`✅ ${MODELS.AI_MODEL_TEXT} 特徵萃取完成: ${aiExtractedFeatures}`);

            const charRef = db.collection('system_characters').doc();
            await charRef.set({
                name: name,
                persona: persona || '',
                aiExtractedFeatures: aiExtractedFeatures,
                imageUrl: publicImageUrl,
                gcsFilename: gcsFilename, 
                tenantId: tenantId,
                isActive: true,
                sortOrder: 99,
                createdAt: new Date().toISOString()
            });

            return res.status(200).json({ success: true, message: `🎉 已為 [${name}] 建立好專屬檔案，並鎖定視覺基因！` });

        } catch (error) {
            console.error('❌ 建立角色失敗:', error.message);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ==========================================
    // 🗑️ API 3：刪除角色
    // ==========================================
    async deleteCharacter(req, res) {
        try {
            const { charId, tenantId } = req.body;

            if (!charId || !tenantId) {
                return res.status(400).json({ success: false, message: '❌ 刪除失敗：參數不完整！' });
            }

            const docRef = db.collection('system_characters').doc(charId);
            const docSnap = await docRef.get();

            if (!docSnap.exists || docSnap.data().tenantId !== tenantId) {
                return res.status(403).json({ success: false, message: '❌ 刪除失敗：無權限或找不到該角色！' });
            }

            const charData = docSnap.data();

            if (charData.gcsFilename) {
                try {
                    await bucket.file(charData.gcsFilename).delete();
                    console.log(`✅ 雲端圖片已清理: ${charData.gcsFilename}`);
                } catch (gcsError) {
                    console.error(`⚠️ 雲端圖片刪除失敗 (可能已遺失，繼續刪除資料庫):`, gcsError.message);
                }
            }

            await docRef.delete();
            console.log(`✅ 角色庫資料已刪除: ${charId}`);

            return res.status(200).json({ success: true, message: '✅ 角色已永久刪除！' });

        } catch (error) {
            console.error('❌ 刪除角色發生錯誤:', error.message);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ==========================================
    // 🚀 API 4：建立品牌人設
    // ==========================================
    async createPersona(req, res) {
        try {
            const { tenantId, icon, name, desc, taboos } = req.body;

            if (!tenantId || !name || !desc) {
                return res.status(400).json({ success: false, message: '❌ 參數不完整：需提供人設名稱與語氣特徵！' });
            }

            const currentPersonasSnap = await db.collection('system_personas').where('tenantId', '==', tenantId).get();
            if (currentPersonasSnap.size >= 10) {
                return res.status(400).json({ success: false, message: '❌ 您的品牌人設庫已滿 (上限 10 組)，請先刪除舊人設後再新增。' });
            }

            const personaRef = db.collection('system_personas').doc();
            await personaRef.set({
                tenantId: tenantId,
                icon: icon || '🤖',
                name: name,
                desc: desc,
                taboos: taboos || '',
                isActive: true,
                createdAt: new Date().toISOString()
            });

            console.log(`✅ 品牌人設庫資料已建立: [${tenantId}] ${name}`);
            return res.status(200).json({ success: true, message: '🎉 品牌人設已寫入神經網路！' });

        } catch (error) {
            console.error('❌ 建立品牌人設失敗:', error.message);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ==========================================
    // 🗑️ API 5：刪除品牌人設
    // ==========================================
    async deletePersona(req, res) {
        try {
            const { personaId, tenantId } = req.body;

            if (!personaId || !tenantId) {
                return res.status(400).json({ success: false, message: '❌ 刪除失敗：參數不完整！' });
            }

            const docRef = db.collection('system_personas').doc(personaId);
            const docSnap = await docRef.get();

            if (!docSnap.exists || docSnap.data().tenantId !== tenantId) {
                return res.status(403).json({ success: false, message: '❌ 刪除失敗：無權限或找不到該人設！' });
            }

            await docRef.delete();
            console.log(`✅ 品牌人設已刪除: ${personaId}`);

            return res.status(200).json({ success: true, message: '✅ 品牌人設已永久刪除！' });

        } catch (error) {
            console.error('❌ 刪除品牌人設發生錯誤:', error.message);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new SystemController();