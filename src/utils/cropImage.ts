export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MAX_OUTPUT_EDGE = 1024;

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: PixelCrop,
  fileName = 'practice-logo.jpg'
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const sourceEdge = Math.max(pixelCrop.width, pixelCrop.height);
  const outputEdge = Math.max(1, Math.min(MAX_OUTPUT_EDGE, Math.round(sourceEdge)));
  canvas.width = outputEdge;
  canvas.height = outputEdge;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputEdge,
    outputEdge
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to crop image'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.85
    );
  });
}
