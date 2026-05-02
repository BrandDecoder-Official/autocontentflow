// ==========================================
// 🎙️ 全 Google 系統：TTS 語音生成引擎 (tts.service.js)
// 專職：利用 Google Cloud Text-to-Speech API 實現 IP 聲線定調
// ==========================================
const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();

class TTSService {
    
    constructor() {
        // 映射「三重選單」到 Google 的語音模型名稱 (Voice Name)
        // 這裡會選擇 Neural2 或 Wavenet 等高品質模型
        this.voiceMap = {
            'M-TW-Steady': { name: 'cmn-TW-Wavenet-B', ssmlGender: 'MALE' },
            'M-TW-Young': { name: 'cmn-TW-Neural2-B', ssmlGender: 'MALE' },
            'F-TW-Young': { name: 'cmn-TW-Wavenet-A', ssmlGender: 'FEMALE' },
            'F-TW-Steady': { name: 'cmn-TW-Neural2-A', ssmlGender: 'FEMALE' },
            // 口音與方言切換 (例如：北京腔)
            'M-CN-Steady': { name: 'cmn-CN-Wavenet-B', ssmlGender: 'MALE' }
        };
        this.defaultVoice = { name: 'cmn-TW-Wavenet-B', ssmlGender: 'MALE' };
    }

    /**
     * 🗣️ 批次生成台詞語音 (Google 專用版)
     */
    async generateBatchAudio(panels, voiceProfile) {
        console.log(`[Google TTS] 啟動批次生成作業...`);
        
        const profileKey = `${voiceProfile.gender}-${voiceProfile.accent}-${voiceProfile.tone}`;
        const targetVoice = this.voiceMap[profileKey] || this.defaultVoice;

        const audioTracks = [];

        for (let i = 0; i < panels.length; i++) {
            const text = panels[i].dialogue;
            if (!text || text === 'None') {
                audioTracks.push(null);
                continue;
            }

            try {
                // 🌟 透過 SSML 控制語速與語調 (實現您說的「情緒」特質)
                const speakingRate = this._getSpeakingRate(voiceProfile.tone);
                const pitch = this._getPitch(voiceProfile.tone);

                const request = {
                    input: { text: text },
                    voice: { 
                        languageCode: this._getLanguageCode(voiceProfile.accent), 
                        name: targetVoice.name 
                    },
                    audioConfig: { 
                        audioEncoding: 'MP3',
                        speakingRate: speakingRate, // 控制節奏
                        pitch: pitch                // 控制頻率 (高亢/沉穩)
                    },
                };

                const [response] = await client.synthesizeSpeech(request);
                
                // 將二進位數據上傳至您的 Google Cloud Storage
                const audioUrl = await this._uploadToStorage(response.audioContent, taskId, i);
                audioTracks.push(audioUrl);
                
                console.log(`[Google TTS] 第 ${i + 1} 軌完成。`);
            } catch (err) {
                console.error(`[Google TTS] 失敗:`, err);
                audioTracks.push(null);
            }
        }
        return audioTracks;
    }

    // --- 輔助邏輯：將抽象的「語氣」轉化為 Google 參數 ---
    _getSpeakingRate(tone) {
        if (tone === '厭世') return 0.85; // 慢一點
        if (tone === '激動') return 1.25; // 快一點
        return 1.0;
    }

    _getPitch(tone) {
        if (tone === '年輕') return 2.0;  // 音調拉高
        if (tone === '沉穩') return -2.0; // 音調壓低
        return 0.0;
    }

    _getLanguageCode(accent) {
        const codes = { 'TW': 'cmn-TW', 'CN': 'cmn-CN', 'HK': 'yue-HK' };
        return codes[accent] || 'cmn-TW';
    }
}

module.exports = new TTSService();