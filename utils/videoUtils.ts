export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:video/mp4;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const extractFrameFromVideo = async (
  videoUrl: string,
  timestamp: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    video.src = videoUrl;
    video.muted = true;
    video.currentTime = timestamp;

    // Safety timeout
    const timeout = setTimeout(() => {
        reject(new Error("Frame extraction timed out"));
    }, 5000);

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            clearTimeout(timeout);
            video.remove();
            resolve(dataUrl);
        } else {
            reject(new Error("Could not get canvas context"));
        }
      } catch (e) {
        reject(e);
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });

    // Trigger loading
    video.load();
    // We don't strictly need to play, but setting currentTime triggers seek
  });
};
