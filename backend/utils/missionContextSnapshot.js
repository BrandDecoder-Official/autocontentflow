'use strict';

/**
 * 從草稿 API body 抽出可存入 Firestore 的 missionContext（略過大物件如 sceneFiles）。
 * 供 publish／生圖／前端 loadMissionFromDB 一致讀取 taskMode、pipeline 版本等。
 */
const SNAPSHOT_KEYS = [
    'topic',
    'universe',
    'taskMode',
    'style',
    'colorMode',
    'ratio',
    'resolution',
    'panelCount',
    'plannedImageCount',
    'isStoryMode',
    'persona',
    'hookType',
    'contentLength',
    'platforms',
    'isIndependentPost',
    'platformStrategies',
    'scheduledAt',
    'characters',
    'tgConfig',
];

function buildMissionContextSnapshot(payloadRaw) {
    const mission = payloadRaw && (payloadRaw.missionContext || payloadRaw);
    const nested = payloadRaw && payloadRaw.missionContext && typeof payloadRaw.missionContext === 'object'
        ? payloadRaw.missionContext
        : null;

    const out = {};
    for (const k of SNAPSHOT_KEYS) {
        const v = nested && nested[k] !== undefined ? nested[k] : mission && mission[k];
        if (v !== undefined) out[k] = v;
    }

    if (!out.taskMode) out.taskMode = 'GENERATE';
    if (out.pipelineVersion == null) out.pipelineVersion = 1;

    return out;
}

module.exports = { buildMissionContextSnapshot };
