// js/utils.js

export function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.backgroundColor = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#3b82f6');
    toast.classList.remove('-translate-y-20', 'opacity-0');
    setTimeout(() => { toast.classList.add('-translate-y-20', 'opacity-0'); }, 3000);
}

export async function processFileToBase64(file) {
    if (!file || file.size === 0) return null;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                resolve({ mimeType: 'image/jpeg', data: compressedBase64.split(',')[1] });
            };
            img.onerror = e => reject(e);
        };
        reader.onerror = e => reject(e);
    });
}
