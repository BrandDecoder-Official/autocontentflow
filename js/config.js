// js/config.js

export const CONFIG = {
    CLOUD_RUN_URL: 'https://bd-autocontentflow-217800246535.asia-east1.run.app',
    GOOGLE_CLIENT_ID: '217800246535-tuc0olph401jjipa5hm34hq45h9jlq7j.apps.googleusercontent.com'
};

// 全域狀態管理 (State)
export const STATE = {
    isComicModeActive: true,
    globalAuthToken: '',
    currentTaskId: '',
    sceneFiles: [],     // 存放背景圖陣列
    objectFiles: [],    // 存放道具圖陣列
    globalSystemStyles: [],
    globalSystemMotions: []
};
