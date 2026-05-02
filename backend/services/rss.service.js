// services/rss.service.js
const Parser = require('rss-parser');
const parser = new Parser();

// Google News 台灣繁體中文版基礎網址
const GOOGLE_NEWS_BASE = 'https://news.google.com/rss/headlines/section/topic';
const PARAMS = '?hl=zh-TW&gl=TW&ceid=TW:zh-Hant';

// 映射您的六大分類到 Google News 的 Topic ID
const CATEGORY_MAP = {
    'POLITICS': 'NATION',         // 政治 (國內要聞)
    'WORLD': 'WORLD',             // 國際
    'BUSINESS': 'BUSINESS',       // 財金
    'ENTERTAINMENT': 'ENTERTAINMENT', // 娛樂
    'SPORTS': 'SPORTS',           // 運動
    'LIFE': 'HEALTH'              // 生活 (Google News 無單純生活，以健康/生活休閒替代)
};

/**
 * 取得指定分類的最新熱門新聞 (預設 20 筆)
 * @param {string} category - 分類代碼 (如: BUSINESS)
 * @param {number} limit - 抓取筆數
 */
async function fetchTrendingNews(category = 'BUSINESS', limit = 20) {
    try {
        const topicId = CATEGORY_MAP[category.toUpperCase()] || 'NATION';
        const feedUrl = `${GOOGLE_NEWS_BASE}/${topicId}${PARAMS}`;
        
        console.log(`📡 [RSS Service] 正在抓取 Google News: ${category} 類別...`);
        const feed = await parser.parseURL(feedUrl);
        
        // 整理並清洗資料
        const cleanedNews = feed.items.slice(0, limit).map(item => {
            // 清洗 Description 裡的 HTML 標籤 (Google News 預設會塞 a 標籤)
            const cleanContent = item.contentSnippet || item.content || "";
            const pureText = cleanContent.replace(/<[^>]*>?/gm, '').trim();

            return {
                title: item.title,
                content: pureText,
                link: item.link,
                pubDate: item.pubDate
            };
        });

        console.log(`✅ [RSS Service] 成功抓取 ${cleanedNews.length} 筆新聞！`);
        return cleanedNews;

    } catch (error) {
        console.error("❌ [RSS Service] 抓取新聞失敗:", error.message);
        throw new Error("無法取得熱門新聞，請稍後再試。");
    }
}

module.exports = { fetchTrendingNews };