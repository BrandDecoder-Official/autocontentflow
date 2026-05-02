// services/rss.service.js
const Parser = require('rss-parser');

const parser = new Parser({
    customFields: {
        item: [['content:encoded', 'encodedContent']],
    },
});

// Google News 台灣繁體中文版基礎網址
const GOOGLE_NEWS_BASE = 'https://news.google.com/rss/headlines/section/topic';
const PARAMS = '?hl=zh-TW&gl=TW&ceid=TW:zh-Hant';

// 映射六大分類到 Google News 的 Topic ID
const CATEGORY_MAP = {
    POLITICS: 'NATION',
    WORLD: 'WORLD',
    BUSINESS: 'BUSINESS',
    ENTERTAINMENT: 'ENTERTAINMENT',
    SPORTS: 'SPORTS',
    LIFE: 'HEALTH',
};

// 自由時報 — 與分類對應；摘要通常比 Google News 聚合描述好讀
const LTN_FEEDS = {
    POLITICS: 'https://news.ltn.com.tw/rss/politics.xml',
    WORLD: 'https://news.ltn.com.tw/rss/world.xml',
    BUSINESS: 'https://news.ltn.com.tw/rss/business.xml',
    ENTERTAINMENT: 'https://news.ltn.com.tw/rss/entertainment.xml',
    SPORTS: 'https://news.ltn.com.tw/rss/sports.xml',
    LIFE: 'https://news.ltn.com.tw/rss/life.xml',
};

// 央廣 — 綜合稿，RSS 常含較長導讀／內文片段（繁中），可補 Google 過短摘要
const RTI_MAIN_FEED = 'https://www.rti.org.tw/rss';

function stripHtml(html) {
    if (!html) return '';
    return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractItemText(item) {
    const encoded = item.encodedContent || item['content:encoded'] || '';
    const htmlBody = item.content || '';
    const stripped = stripHtml(encoded || htmlBody);
    const snippet = (item.contentSnippet || item.summary || '').trim();
    let text = stripped.length >= snippet.length ? stripped : snippet;
    if (!text && item.title) text = String(item.title).trim();
    if (text.length > 4500) text = `${text.slice(0, 4500)}…`;
    return text;
}

function normalizeItem(item, sourceLabel) {
    const title = (item.title || '').replace(/\s+/g, ' ').trim();
    if (!title) return null;
    const guid = item.guid;
    const link = item.link || (typeof guid === 'string' ? guid : guid?.value) || '';
    return {
        title,
        content: extractItemText(item) || title,
        link,
        pubDate: item.pubDate,
        source: sourceLabel,
    };
}

async function parseFeedSafe(url) {
    try {
        return await parser.parseURL(url);
    } catch (error) {
        console.warn(`📡 [RSS Service] 略過 (${url}): ${error.message}`);
        return { items: [] };
    }
}

function mergeNewsPreferLonger(entries) {
    const map = new Map();
    for (const news of entries) {
        if (!news || !news.title) continue;
        const key = news.title.toLowerCase().replace(/\s+/g, ' ').slice(0, 96);
        const prev = map.get(key);
        if (!prev || (news.content || '').length > (prev.content || '').length) {
            map.set(key, news);
        }
    }
    return Array.from(map.values());
}

/**
 * 合併多路 RSS：Google News（話題）+ 央廣（長文摘要）+ 自由時報（分類）
 * 同標題保留較長內文，再依內文長度排序，降低「只有標題一句」對生成的影響。
 */
async function fetchTrendingNews(category = 'BUSINESS', limit = 20) {
    try {
        const cat = (category || 'BUSINESS').toUpperCase();
        const topicId = CATEGORY_MAP[cat] || 'NATION';
        const googleUrl = `${GOOGLE_NEWS_BASE}/${topicId}${PARAMS}`;
        const ltnUrl = LTN_FEEDS[cat];

        const feedResults = await Promise.all([
            parseFeedSafe(googleUrl),
            parseFeedSafe(RTI_MAIN_FEED),
            ltnUrl ? parseFeedSafe(ltnUrl) : Promise.resolve({ items: [] }),
        ]);
        const [googleFeed, rtiFeed, ltnFeed] = feedResults;

        const raw = [];
        const push = (items, label, cap) => {
            for (const item of (items || []).slice(0, cap)) {
                const n = normalizeItem(item, label);
                if (n) raw.push(n);
            }
        };

        push(googleFeed.items, 'Google News', 30);
        push(rtiFeed.items, '央廣 RTI', 70);
        push(ltnFeed.items, '自由時報', 45);

        const merged = mergeNewsPreferLonger(raw);
        merged.sort((a, b) => (b.content || '').length - (a.content || '').length);
        const top = merged.slice(0, limit);

        console.log(`✅ [RSS Service] ${cat}: 合併 ${merged.length} 筆 → 回傳 ${top.length} 筆（優先較長內文）`);
        return top;
    } catch (error) {
        console.error('❌ [RSS Service] 抓取新聞失敗:', error.message);
        throw new Error('無法取得熱門新聞，請稍後再試。');
    }
}

module.exports = { fetchTrendingNews };
