// services/social.service.js

const config = require('../config/env.config.js');

// 🛠️ 小工具：暫停等待 (冷卻時間)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 📘 Facebook 發文引擎
async function publishToFacebookAPI(imageInput, message, locationId = null) {
    const images = Array.isArray(imageInput) ? imageInput : [imageInput];
    const pageId = config.FB_PAGE_ID;
    const token = config.FB_PAGE_TOKEN;

    if (images.length === 1) {
        console.log('📘 [Social Service] FB 單圖模式發佈中...');
        const url = `https://graph.facebook.com/v25.0/${pageId}/photos`;
        
        const params = new URLSearchParams({
            url: images[0],
            message: message,
            access_token: token
        });
        if (locationId) {
            params.append('place', locationId);
        }

        const response = await fetch(url, { method: 'POST', body: params });
        const data = await response.json();
        if (data.error) {
            const m = data.error.message || '';
            let extra = '';
            if (/publish_actions/i.test(m)) {
                extra =
                    ' 請確認使用「粉絲專頁」長效權杖（Page Access Token），且 App 具備 pages_manage_posts；已廢止的 publish_actions / 使用者發文流程無法再發 Page 貼文。';
            }
            throw new Error(`FB 錯誤: ${m}${extra}`);
        }
        return data;
    } else {
        console.log(`📘 [Social Service] FB 輪播多圖模式發佈中 (共 ${images.length} 張)...`);
        const mediaIds = [];
        
        for (let i = 0; i < images.length; i++) {
            const url = `https://graph.facebook.com/v25.0/${pageId}/photos`;
            const params = new URLSearchParams({
                url: images[i],
                published: 'false', 
                access_token: token
            });
            
            const res = await fetch(url, { method: 'POST', body: params });
            const data = await res.json();
            if (data.error) {
                const m = data.error.message || '';
                const extra = /publish_actions/i.test(m)
                    ? '（請改用 Page Access Token + pages_manage_posts）'
                    : '';
                throw new Error(`FB 圖片隱藏上傳失敗: ${m}${extra}`);
            }
            mediaIds.push(data.id); 
            
            // 🌟 防擋冷卻
            console.log(`⏳ [Social Service] FB 子圖片 ${i + 1}/${images.length} 傳送完畢，冷卻中...`);
            await sleep(1500); 
        }

        console.log(`⏳ [Social Service] FB 所有子圖片上傳完畢，等待 Meta 統整 (3秒)...`);
        await sleep(3000); 

        console.log(`📘 [Social Service] 準備發佈包含 ${mediaIds.length} 張圖片的貼文...`);
        const feedUrl = `https://graph.facebook.com/v25.0/${pageId}/feed`;
        
        const feedParams = new URLSearchParams();
        feedParams.append('message', message);
        feedParams.append('access_token', token);
        if (locationId) {
            feedParams.append('place', locationId);
        }
        
        mediaIds.forEach((id, index) => {
            feedParams.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: id }));
        });
        
        const res = await fetch(feedUrl, { method: 'POST', body: feedParams });
        const data = await res.json();
        if (data.error) {
            const m = data.error.message || '';
            const extra = /publish_actions/i.test(m)
                ? ' 請使用粉絲專頁長效權杖並具 pages_manage_posts。'
                : '';
            throw new Error(`FB 多圖貼文發佈失敗: ${m}${extra}`);
        }
        return data;
    }
}

// 📸 Instagram 發文引擎
async function publishToInstagramAPI(imageInput, caption, locationId = null) {
    const igUserId = config.IG_USER_ID; 
    const token = config.FB_PAGE_TOKEN;
    
    const images = Array.isArray(imageInput) ? imageInput : [imageInput];
    let finalContainerId;

    if (images.length === 1) {
        console.log('📸 [Social Service] IG 單圖模式發佈中...');
        const containerUrl = `https://graph.facebook.com/v25.0/${igUserId}/media`;
        const containerParams = new URLSearchParams({ image_url: images[0], caption: caption, access_token: token });
        if (locationId) containerParams.append('location_id', locationId);
        const containerRes = await fetch(containerUrl, { method: 'POST', body: containerParams });
        const containerData = await containerRes.json();
        if (containerData.error) throw new Error(`IG 單圖容器失敗: ${containerData.error.message}`);
        finalContainerId = containerData.id;
    } else {
        console.log(`📸 [Social Service] IG 輪播相簿模式 (共 ${images.length} 張)...`);
        const childIds = [];
        for (let i = 0; i < images.length; i++) {
            const childUrl = `https://graph.facebook.com/v25.0/${igUserId}/media`;
            const params = new URLSearchParams({ image_url: images[i], is_carousel_item: 'true', access_token: token });
            const res = await fetch(childUrl, { method: 'POST', body: params });
            const data = await res.json();
            if (data.error) throw new Error(`IG 子圖片建立失敗: ${data.error.message}`);
            childIds.push(data.id);
            
            console.log(`⏳ [Social Service] IG 子圖片 ${i + 1}/${images.length} 傳送完畢，冷卻中...`);
            await sleep(2000); 
        }

        // 🌟 寬鬆策略：IG 處理圖片超級慢，給它 10 秒
        console.log(`⏳ [Social Service] IG 子圖片全部送出，等待 Meta 下載與處理 (10秒)...`);
        await sleep(10000); 

        console.log('📸 [Social Service] 正在將子圖片打包成 IG 相簿...');
        const carouselUrl = `https://graph.facebook.com/v25.0/${igUserId}/media`;
        const carouselParams = new URLSearchParams({ media_type: 'CAROUSEL', children: childIds.join(','), caption: caption, access_token: token });
        if (locationId) carouselParams.append('location_id', locationId);
        const res = await fetch(carouselUrl, { method: 'POST', body: carouselParams });
        const data = await res.json();
        if (data.error) throw new Error(`IG 輪播主容器失敗: ${data.error.message}`);
        finalContainerId = data.id;
    }

    // 🌟 寬鬆策略：主容器建立後，給予更充足的準備時間再發布
    console.log(`⏳ [Social Service] IG 主容器建立成功 (${finalContainerId})，準備發佈 (等待 8 秒)...`);
    await sleep(8000); 

    console.log('🚀 [Social Service] 正在正式發佈至 Instagram...');
    const publishUrl = `https://graph.facebook.com/v25.0/${igUserId}/media_publish`;
    const publishParams = new URLSearchParams({ creation_id: finalContainerId, access_token: token });
    const publishRes = await fetch(publishUrl, { method: 'POST', body: publishParams });
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(`IG 發佈失敗: ${publishData.error.message}`);
    return publishData;
}

// 🧵 Threads 發佈引擎
async function publishToThreadsAPI(imageInput, caption, locationId = null) {
    try {
        const token = config.THREADS_TOKEN;
        const images = Array.isArray(imageInput) ? imageInput : [imageInput];
        let finalContainerId;

        if (images.length === 1) {
            console.log('🧵 [Social Service] Threads 單圖模式發佈中...');
            let threadsUrl = `https://graph.threads.net/v1.0/me/threads?media_type=IMAGE&image_url=${encodeURIComponent(images[0])}&text=${encodeURIComponent(caption)}&access_token=${token}`;
            if (locationId) threadsUrl += `&location_id=${encodeURIComponent(locationId)}`;
            const containerRes = await fetch(threadsUrl, { method: 'POST' });
            const containerData = await containerRes.json();
            if (!containerData.id) throw new Error(`Threads 單圖容器失敗: ${JSON.stringify(containerData)}`);
            finalContainerId = containerData.id;
        } else {
            console.log(`🧵 [Social Service] Threads 多圖模式發佈中 (共 ${images.length} 張)...`);
            const childIds = [];
            for (let i = 0; i < images.length; i++) {
                const childUrl = `https://graph.threads.net/v1.0/me/threads?media_type=IMAGE&image_url=${encodeURIComponent(images[i])}&is_carousel_item=true&access_token=${token}`;
                const res = await fetch(childUrl, { method: 'POST' });
                const data = await res.json();
                
                if (!data.id) throw new Error(`Threads 子容器失敗: ${JSON.stringify(data)}`);
                childIds.push(data.id);
                
                console.log(`⏳ [Social Service] Threads 子圖片 ${i + 1}/${images.length} 傳送完畢，冷卻中...`);
                await sleep(2500); 
            }

            // 🌟 寬鬆策略
            console.log(`⏳ [Social Service] Threads 子圖片全部送出，等待 Meta 下載與處理 (10秒)...`);
            await sleep(10000); 

            const carouselUrl = `https://graph.threads.net/v1.0/me/threads?media_type=CAROUSEL&children=${encodeURIComponent(childIds.join(','))}&text=${encodeURIComponent(caption)}&access_token=${token}`;
            const res = await fetch(carouselUrl, { method: 'POST' });
            const data = await res.json();
            if (!data.id) throw new Error(`Threads 輪播主容器失敗: ${JSON.stringify(data)}`);
            finalContainerId = data.id;
        }

        // 🌟 寬鬆策略
        console.log(`⏳ [Social Service] Threads 主容器建立成功 (${finalContainerId})，準備發佈 (等待 8 秒)...`);
        await sleep(8000); 

        console.log('🚀 [Social Service] 正在正式發佈至 Threads...');
        const publishUrl = `https://graph.threads.net/v1.0/me/threads_publish?creation_id=${finalContainerId}&access_token=${token}`;
        const publishRes = await fetch(publishUrl, { method: 'POST' });
        const publishData = await publishRes.json();
        if (!publishData.id) throw new Error(`Threads 發佈失敗: ${JSON.stringify(publishData)}`);
        return publishData;
    } catch (error) {
        console.error('❌ Threads 發佈流程發生例外錯誤:', error.message);
        throw error;
    }
}

module.exports = {
    publishToFacebookAPI,
    publishToInstagramAPI,
    publishToThreadsAPI
};