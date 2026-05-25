// index.js
const functions = require('@google-cloud/functions-framework');
const express = require('express');
const app = express();

// ==========================================
// 🛡️ 啟動保護：捕獲錯誤但不關閉伺服器
// ==========================================
process.on('uncaughtException', (err) => {
    console.error('💥 [致命錯誤] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [致命錯誤] Unhandled Promise Rejection:', reason);
});

// ==========================================
// 📦 引入 Controller 模組
// ==========================================
const webhookController = require('./controllers/webhook.controller');
const taskController = require('./controllers/task.controller');
const systemController = require('./controllers/system.controller');
const authController = require('./controllers/auth.controller');
const adminController = require('./controllers/admin.controller');
const cronController = require('./controllers/cron.controller'); 
const agentController = require('./agent/agent.controller');
const rssController = require('./controllers/rss.controller'); // 🚀 [新增] 引入 RSS 控制器


// ==========================================
// ⚙️ Express 全域中間件設定
// ==========================================
// 允許接收巨大的 Base64 圖片陣列 (最高 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 原生 CORS 設定 (讓網頁可以順利呼叫 API)
app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // ⚠️ 補上 DELETE 允許
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret'); 
    if (req.method === 'OPTIONS') return res.status(204).send('');
    next();
});

// ==========================================
// 📍 路由註冊區 (API Routes)
// ==========================================

// 0. 系統健康檢查
app.get('/', (req, res) => {
    res.status(200).send('🚀 BrandDecoder 行動工作室 API 運作中！');
});

// 1. 🔐 Google 登入驗證
app.post('/api/auth/verify', authController.verifyLogin);

// 2. ✍️ 網頁閉環審核 API (內容產製引擎)
app.post('/api/content/draft', taskController.generateDraft);
app.post('/api/content/generate', taskController.generateImageFromDraft);
app.post('/api/content/publish', taskController.publishTask);
app.post('/api/content/compress', taskController.compressComicPanels); 
app.post('/api/content/analyze-references', taskController.analyzeReferences); 
app.get('/api/logs', taskController.getAuditLogs); 

// 3. 🧬 系統 UI 動態選項 API
app.post('/api/create-character', systemController.createCharacter); 
app.post('/api/delete-character', systemController.deleteCharacter); 
app.get('/api/system-options', systemController.getUiOptions); 
app.get('/api/locations/search', systemController.searchLocations); 
// 🚀 [新增] 品牌人設的 CRUD 路由
app.post('/api/create-persona', systemController.createPersona);
app.post('/api/delete-persona', systemController.deletePersona);
// 🚀 [新增] 全域錢包與租戶狀態同步 API (供前端拉霸機更新點數使用)
app.get('/api/tenant/config', systemController.getTenantConfig);

// 4. 📡 Telegram Webhook (對話機器人)
app.post('/api/webhook/telegram', webhookController.handleTelegramWebhook);

// 5. 👑 超級管理員專屬 API (戰情室)
app.post('/api/admin/topup', adminController.manualTopUp);
app.post('/api/admin/cron/daily-aggregate', adminController.runDailyAggregation);
app.get('/api/admin/dashboard', adminController.getDashboardData);
app.post('/api/admin/tenant/status', adminController.updateTenantStatus);
app.get('/api/admin/logs', adminController.getAdminLogsData);

// 6. ⏰ 自動排程專屬通道 (GCP Cloud Scheduler 專用)
app.post('/api/cron/trigger', cronController.triggerCronJob); 

// ==========================================
// 7. 企業級 AI 代理人核心路由 (Agentic Workflow)
// ==========================================
app.post('/api/agent/orchestrate', agentController.handleAgentRequest);
app.get('/api/agent/tasks/:tenantId', agentController.getTaskList); // 撈取歷史任務清單
app.post('/api/agent/tasks', agentController.createAgentTask); // 正式建立空任務
app.delete('/api/agent/tasks/:taskId', agentController.deleteAgentTask); // 🗑️ ✨ [新增] 刪除任務

// ==========================================
// 8. 📰 RSS 新聞進料模組 API
// ==========================================
app.get('/api/rss/news', rssController.getNewsByCategory);

// ==========================================
// 🚀 啟動 GCP 伺服器
// ==========================================
// 交還給 GCP Functions Framework 啟動，它會自動處理 8080 埠口
functions.http('api', app);