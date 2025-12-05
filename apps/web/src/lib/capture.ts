export async function grabStill(track: MediaStreamTrack): Promise<Blob> {
  const ImageCaptureCtor = (window as any).ImageCapture;
  if (ImageCaptureCtor) {
    try {
      const imageCapture = new ImageCaptureCtor(track);
      if (imageCapture.takePhoto) {
        return await imageCapture.takePhoto();
      }
    } catch (error) {
      console.warn('ImageCapture takePhoto failed, falling back to canvas', error);
    }
  }

  const stream = new MediaStream([track]);
  const video = Object.assign(document.createElement('video'), {
    srcObject: stream
  });
  await video.play();
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to capture frame');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate blob'));
    }, 'image/jpeg', 0.9);
  });
}
