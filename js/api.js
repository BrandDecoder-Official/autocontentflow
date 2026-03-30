// js/api.js
import { CONFIG, STATE } from './config.js';

export async function fetchSystemOptionsAPI() {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/system-options`);
    return response.json();
}

export async function createDraftAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function generateImageAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function publishContentAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/content/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${STATE.globalAuthToken}` },
        body: JSON.stringify(payload)
    });
    return response.json();
}

export async function generateVideoAPI(payload) {
    const response = await fetch(`${CONFIG.CLOUD_RUN_URL}/api/generate-interpolation-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return response.json();
}
