const { db } = require('./services/firestore.service');

async function check() {
    try {
        const snapshot = await db.collection('tasks').orderBy('updatedAt', 'desc').limit(2).get();
        if (snapshot.empty) {
            console.log("No tasks found");
            return;
        }
        snapshot.forEach(doc => {
            console.log("====================================");
            console.log("ID:", doc.id);
            const data = doc.data();
            console.log("Status:", data.status);
            console.log("Universe:", data.missionContext?.universe);
            console.log("ColorMode:", data.missionContext?.colorMode);
            console.log("PanelCount:", data.missionContext?.panelCount);
            console.log("image_options:", JSON.stringify(data.image_options, null, 2));
            console.log("draftContent.panels length:", data.draftContent?.panels?.length);
            console.log("draftContent.panels:", JSON.stringify(data.draftContent?.panels, null, 2));
        });
    } catch (e) {
        console.error("Error:", e);
    }
}

check();
