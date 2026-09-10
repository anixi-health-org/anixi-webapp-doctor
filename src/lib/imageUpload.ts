/** Shared image pick / validate / normalize helpers for profile & practice logos. */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const SKIP_CROP_MAX_BYTES = 512 * 1024;

export const ACCEPTED_IMAGE_INPUT =
  'image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

function extractFirebaseCode(err: unknown): string {
  if (typeof err === 'object' && err && 'code' in err) {
    return String((err as { code?: string }).code ?? '');
  }
  return '';
}

export function validateImageFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const typeOk =
    file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name);
  if (!typeOk) {
    return 'Please choose a PNG or JPG image.';
  }
  if (!file.size) {
    return 'That file appears empty. Try a different image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `That image is ${mb} MB. Please use a file under 5 MB.`;
  }
  return null;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Try another PNG or JPG.'));
    };
    image.src = url;
  });
}

/** Resize/compress to JPEG for Storage — works without opening the crop modal. */
export async function normalizeImageFile(
  file: File,
  fileName: string,
  maxEdge = 1024,
): Promise<File> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const scale = Math.min(1, maxEdge / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image for upload.');

  ctx.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Could not prepare image for upload.'));
          return;
        }
        resolve(result);
      },
      'image/jpeg',
      0.88,
    );
  });

  return new File([blob], fileName.endsWith('.jpg') ? fileName : `${fileName}.jpg`, {
    type: 'image/jpeg',
  });
}

export function shouldSkipCrop(file: File): boolean {
  return file.size <= SKIP_CROP_MAX_BYTES;
}

export function describeImageUploadError(err: unknown, kind: 'photo' | 'logo'): string {
  const code = extractFirebaseCode(err);
  const message = err instanceof Error ? err.message : String(err ?? '');
  const lower = message.toLowerCase();

  if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
    return `Could not save the ${kind}. Please sign in again and retry.`;
  }
  if (code === 'storage/quota-exceeded') {
    return `Storage quota exceeded while saving the ${kind}. Try a smaller image.`;
  }
  if (code === 'storage/canceled') {
    return `The ${kind} upload was cancelled. Please try again.`;
  }
  if (
    code === 'storage/retry-limit-exceeded' ||
    /network|failed to fetch|offline/i.test(lower)
  ) {
    return `Network issue while uploading the ${kind}. Check your connection and try again.`;
  }
  if (lower.includes('firestore') && (lower.includes('too large') || lower.includes('longer than'))) {
    return `Could not save ${kind} details. Please try again or contact support.`;
  }
  if (
    code === 'storage/invalid-checksum' ||
    (lower.includes('too large') && lower.includes('5')) ||
    (lower.includes('exceeds') && lower.includes('maximum') && lower.includes('size'))
  ) {
    return `That ${kind} is too large. Please use a PNG or JPG under 5 MB.`;
  }
  if (message && message.length < 160 && !lower.includes('firebase storage:')) {
    return message;
  }
  return `Could not upload the ${kind}. Please try a PNG or JPG under 5 MB.`;
}
