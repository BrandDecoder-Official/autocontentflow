// controllers/rss.controller.js
const rssService = require('../services/rss.service');

async function getNewsByCategory(req, res) {
    try {
        // 從前端接收分類參數 (例如: ?category=BUSINESS)
        const category = req.query.category || 'BUSINESS'; 
        
        // 呼叫 Service 抓取前 20 筆
        const newsList = await rssService.fetchTrendingNews(category, 20);
        
        return res.status(200).json({
            success: true,
            category: category,
            count: newsList.length,
            data: newsList
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = { getNewsByCategory };