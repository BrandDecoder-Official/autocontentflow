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

/**
 * 透過 Meta Graph API 將 Google Place (名稱+座標) 轉換/解析為對應的 Facebook Place ID
 */
async function resolveGooglePlaceToFacebookPlaceId(name, lat, lng, token) {
    if (!token) return null;
    try {
        const url = `https://graph.facebook.com/v25.0/search?type=place&q=${encodeURIComponent(name)}&center=${lat},${lng}&distance=1000&fields=id,name,location&access_token=${token}&limit=3`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.data && data.data.length > 0) {
            // 優先模糊匹配名稱
            const match = data.data.find(item => 
                item.name.toLowerCase().includes(name.toLowerCase()) || 
                name.toLowerCase().includes(item.name.toLowerCase())
            );
            if (match) {
                return String(match.id);
            }
            return String(data.data[0].id);
        }
    } catch (err) {
        console.warn("⚠️ 轉換 Google Place 失敗:", err.message);
    }
    return null;
}

/**
 * 透過 Meta Pages Search API 依名稱模糊解析對應的 Facebook Page ID (地標)
 */
async function resolveGooglePageIdByName(name, token) {
    if (!token) return null;
    try {
        const url = `https://graph.facebook.com/v25.0/pages/search?q=${encodeURIComponent(name)}&fields=id,name,location&access_token=${token}&limit=3`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.data && data.data.length > 0) {
            return String(data.data[0].id);
        }
    } catch (err) {
        console.warn("⚠️ 轉換 Google Page 失敗:", err.message);
    }
    return null;
}

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
                if (data.isActive !== false) {
                    let charType = data.type || '';
                    // 🚀 智慧相容：若資料庫無 type 欄位，基於特徵句進行即時自動判斷與非同步補正
                    if (!charType && data.aiExtractedFeatures) {
                        const feats = String(data.aiExtractedFeatures).toLowerCase();
                        if (feats.includes('photo') || feats.includes('photograph') || feats.includes('portrait') || feats.includes('real-life')) {
                            charType = 'REALISTIC';
                        } else if (feats.includes('drawing') || feats.includes('anime') || feats.includes('cartoon') || feats.includes('sketch') || feats.includes('illustration') || feats.includes('comic') || feats.includes('2d')) {
                            charType = 'COMIC';
                        }
                        
                        if (charType) {
                            db.collection('system_characters').doc(doc.id).update({ type: charType })
                                .then(() => console.log(`[Migration] 已成功補正角色 [${data.name}] 類型為 ${charType}`))
                                .catch(e => console.error(`[Migration] 補正角色失敗:`, e));
                        }
                    }
                    characters.push({ id: doc.id, ...data, type: charType || 'COMIC' });
                }
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

            // 💸 以 Firestore global_pricing 為售價真相（actions.retailPoints），並用 pricing.config 補齊成本模型等
            let pricingData = { ...PRICING };
            try {
                const gpSnap = await db.collection('system_configs').doc('global_pricing').get();
                if (gpSnap.exists) {
                    const g = gpSnap.data();
                    pricingData = {
                        ...PRICING,
                        actions: g.actions || {},
                        exchangeRate: g.exchangeRate,
                        globalProfitMultiplier: g.globalProfitMultiplier,
                        token_rates: g.token_rates
                    };
                }
            } catch (pe) {
                console.warn('[System API] global_pricing 讀取失敗，僅使用 pricing.config', pe.message);
            }

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

            // 🌟 修正為單一來源 'tenants' 集合
            const userDoc = await db.collection('tenants').doc(tenantId).get();
            
            if (!userDoc.exists) {
                return res.status(404).json({ success: false, message: "找不到該租戶資料" });
            }

            const userData = userDoc.data();
            const calculatedTier = userData.tier || (userData.totalPoints > 10000 ? 'APEX' : (userData.totalPoints > 3000 ? 'PRO' : 'FREE'));
            
            return res.status(200).json({
                success: true,
                tenant: {
                    totalPoints: userData.totalPoints || 0,
                    tier: calculatedTier
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
            const { name, persona, imageBase64, mimeType, tenantId, type } = req.body;

            if (!name || !imageBase64 || !tenantId) {
                return res.status(400).json({ success: false, message: '❌ 請提供角色名字、大頭照與用戶驗證！' });
            }

            const currentCharsSnap = await db.collection('system_characters').where('tenantId', '==', tenantId).get();
            if (currentCharsSnap.size >= 10) {
                return res.status(400).json({ success: false, message: '❌ 您的角色庫已滿 (上限 10 個)，請先刪除舊角色後再新增。' });
            }

            console.log(`👁️ 正在為 [${tenantId}] 的角色 [${name}] 建檔，啟動 ${MODELS.AI_MODEL_TEXT} 特徵與風格判定...`);

            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const gcsFilename = `characters/${tenantId}/${Date.now()}_${name}.jpeg`; 
            const file = bucket.file(gcsFilename);

            await file.save(buffer, { contentType: mimeType || 'image/jpeg' });
            const publicImageUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFilename}`;

            const response = await visionAi.models.generateContent({
                model: MODELS.AI_MODEL_TEXT,
                contents: [
                    { text: `You are a visual design expert. Analyze the provided image of a character/person and output a JSON object containing:
1. "features": A concise 1-sentence English description of the core physical traits (gender, age, hairstyle, clothing, facial features, accessories). Do not describe the background.
2. "styleType": Must be either "REALISTIC" (if it is a real-life photograph/photo portrait) or "COMIC" (if it is a 2D anime, cartoon, drawing, painting, sketch, illustration, or 3D character render).

Format your output exactly as JSON:
{
  "features": "...",
  "styleType": "REALISTIC"
}` },
                    { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } }
                ]
            });

            const aiResponseText = response.text.trim();
            let aiExtractedFeatures = "";
            let detectedType = (type && type !== 'AUTO') ? type : "";

            try {
                const jsonText = aiResponseText.replace(/```json/gi, "").replace(/```/g, "").trim();
                const parsed = JSON.parse(jsonText);
                aiExtractedFeatures = parsed.features || "";
                if (parsed.styleType === 'REALISTIC' || parsed.styleType === 'COMIC') {
                    detectedType = parsed.styleType;
                }
            } catch (jsonErr) {
                console.warn("⚠️ 語意分析 JSON 解析失敗，使用備用 Regex:", jsonErr.message);
                aiExtractedFeatures = aiResponseText;
            }

            // 🔍 如果仍未判定出類型，進行關鍵字備用 Regex 匹配
            if (detectedType !== 'REALISTIC' && detectedType !== 'COMIC') {
                const textLower = aiResponseText.toLowerCase();
                if (textLower.includes('realistic') || textLower.includes('photograph') || textLower.includes('photo') || textLower.includes('real-life')) {
                    detectedType = 'REALISTIC';
                } else if (textLower.includes('comic') || textLower.includes('anime') || textLower.includes('cartoon') || textLower.includes('drawing') || textLower.includes('illustration') || textLower.includes('sketch') || textLower.includes('render')) {
                    detectedType = 'COMIC';
                } else {
                    // 最終安全 fallback
                    detectedType = 'REALISTIC';
                }
            }

            console.log(`✅ ${MODELS.AI_MODEL_TEXT} 特徵與風格判定完成. 風格: ${detectedType}, 特徵: ${aiExtractedFeatures}`);

            const charRef = db.collection('system_characters').doc();
            await charRef.set({
                name: name,
                persona: persona || '',
                type: detectedType, // 🚀 寫入 AI 判斷之風格宇宙
                aiExtractedFeatures: aiExtractedFeatures,
                imageUrl: publicImageUrl,
                gcsFilename: gcsFilename, 
                tenantId: tenantId,
                isActive: true,
                sortOrder: 99,
                createdAt: new Date().toISOString()
            });

            let billingResult;
            try {
                billingResult = await billingService.chargeAndLog({
                    uid: tenantId,
                    actionType: 'CREATE_CHARACTER',
                    multiplier: 1,
                    referenceId: charRef.id,
                    req
                });
            } catch (billErr) {
                console.error('❌ 角色建檔計費失敗，回滾資料與圖檔:', billErr.message);
                try { await charRef.delete(); } catch (e) { /* ignore */ }
                try { await bucket.file(gcsFilename).delete(); } catch (e) { /* ignore */ }
                const code = (billErr.message && String(billErr.message).includes('算力不足')) ? 402 : 500;
                return res.status(code).json({ success: false, message: billErr.message || '算力扣抵失敗' });
            }

            return res.status(200).json({
                success: true,
                message: `🎉 已為 [${name}] 建立好專屬檔案，並鎖定視覺基因！`,
                chargedPoints: billingResult.cost
            });

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

            let billingResult;
            try {
                billingResult = await billingService.chargeAndLog({
                    uid: tenantId,
                    actionType: 'CREATE_PERSONA',
                    multiplier: 1,
                    referenceId: personaRef.id,
                    req
                });
            } catch (billErr) {
                console.error('❌ 人設建檔計費失敗，回滾資料:', billErr.message);
                try { await personaRef.delete(); } catch (e) { /* ignore */ }
                const code = (billErr.message && String(billErr.message).includes('算力不足')) ? 402 : 500;
                return res.status(code).json({ success: false, message: billErr.message || '算力扣抵失敗' });
            }

            console.log(`✅ 品牌人設庫資料已建立: [${tenantId}] ${name}`);
            return res.status(200).json({
                success: true,
                message: '🎉 品牌人設已寫入神經網路！',
                chargedPoints: billingResult.cost
            });

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

    // ==========================================
    // 📍 API 6：搜尋打卡地標 (Meta API + Gemini 視覺/語意模擬)
    // ==========================================
    async searchLocations(req, res) {
        try {
            const query = req.query.query?.trim() || "";
            if (!query) {
                return res.status(200).json({ success: true, data: [] });
            }

            const lat = req.query.lat ? parseFloat(req.query.lat) : null;
            const lng = req.query.lng ? parseFloat(req.query.lng) : null;

            const envConfig = require('../config/env.config');
            const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || envConfig.GOOGLE_MAPS_API_KEY;
            const token = envConfig.FB_PAGE_TOKEN;
            let results = [];

            // 1. 優先使用 Google Places API (Text Search)
            if (googleMapsKey) {
                try {
                    let googleUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleMapsKey}&language=zh-TW`;
                    if (lat && lng) {
                        googleUrl += `&location=${lat},${lng}&radius=10000`;
                    }
                    const gRes = await fetch(googleUrl);
                    const gData = await gRes.json();
                    if (gData && gData.results && gData.results.length > 0) {
                        const rawResults = gData.results.slice(0, 8);
                        const resolvedResults = await Promise.all(rawResults.map(async item => {
                            const itemLat = item.geometry?.location?.lat;
                            const itemLng = item.geometry?.location?.lng;
                            let fbId = null;
                            if (itemLat && itemLng) {
                                fbId = await resolveGooglePlaceToFacebookPlaceId(item.name, itemLat, itemLng, token);
                            }
                            if (!fbId) {
                                fbId = await resolveGooglePageIdByName(item.name, token);
                            }
                            if (fbId && /^\d+$/.test(fbId)) {
                                return {
                                    id: fbId,
                                    name: String(item.name),
                                    address: item.formatted_address || "台灣地區",
                                    latitude: itemLat || 0.0,
                                    longitude: itemLng || 0.0
                                };
                            }
                            return null;
                        }));
                        results = resolvedResults.filter(Boolean);
                    }
                } catch (gErr) {
                    console.warn("⚠️ Google Places API 搜尋失敗，嘗試切換至 Meta API:", gErr.message);
                }
            }

            // 2. 備援使用 Meta Graph API
            if (results.length === 0 && token) {
                try {
                    let searchUrl = `https://graph.facebook.com/v25.0/pages/search?q=${encodeURIComponent(query)}&fields=id,name,location&access_token=${token}&limit=10`;
                    if (lat && lng) {
                        searchUrl = `https://graph.facebook.com/v25.0/search?type=place&q=${encodeURIComponent(query)}&center=${lat},${lng}&distance=10000&fields=id,name,location&access_token=${token}&limit=10`;
                    }
                    const apiRes = await fetch(searchUrl);
                    const apiData = await apiRes.json();
                    
                    let list = apiData?.data || [];
                    // 若 type=place 失敗或查無資料，降級使用 pages/search
                    if (list.length === 0 && lat && lng) {
                        const fallbackUrl = `https://graph.facebook.com/v25.0/pages/search?q=${encodeURIComponent(query)}&fields=id,name,location&access_token=${token}&limit=10`;
                        const fallbackRes = await fetch(fallbackUrl);
                        const fallbackData = await fallbackRes.json();
                        list = fallbackData?.data || [];
                    }

                    if (list.length > 0) {
                        results = list.map(item => ({
                            id: String(item.id),
                            name: String(item.name),
                            address: item.location?.street || item.location?.city || "台灣地區",
                            latitude: item.location?.latitude || 0.0,
                            longitude: item.location?.longitude || 0.0
                        }));
                    }
                } catch (apiErr) {
                    console.warn("⚠️ Meta API Location Search 失敗:", apiErr.message);
                }
            }

            // 3. 🚨 拔除 Gemini AI 模擬（假的台灣地標），若無資料直接回傳空列表，確保真實性
            return res.status(200).json({ success: true, data: results });

        } catch (error) {
            console.error("🔥 [搜尋地標] 失敗:", error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new SystemController();