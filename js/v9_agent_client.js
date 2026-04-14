// js/v9_agent_client.js
import { STATE, CONFIG } from './config.js';

export const AgentClient = {
    get API_URL() {
        return `${CONFIG.CLOUD_RUN_URL.replace(/\/$/, '')}/api/agent/orchestrate`;
    },
    async sendCommand(action, payload = {}, existingTaskId = null) {
        try {
            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: STATE.uid || 'user_chief_001',
                    taskId: existingTaskId || ('task_agent_' + Date.now()),
                    action: action,
                    payload: payload
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                let errMsg = errText;
                try { errMsg = JSON.parse(errText).message; } catch(e) {}
                throw new Error(errMsg || `伺服器回應錯誤碼: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            return result.state; 
        } catch (error) {
            console.error('[Agent Client Error]', error);
            throw error; 
        }
    }
};
