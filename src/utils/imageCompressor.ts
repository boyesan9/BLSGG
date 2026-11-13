/**
 * Image compressor utility for reducing mobile camera/upload photos
 * Prevents QuotaExceededError in browser storage while keeping visual sharpness and watermarks crisp.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Converts a File or Blob to a Data URL safely via FileReader
 */
export function fileToDataUrl(fileOrBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Image compressor utility for reducing mobile camera/upload photos.
 * Prevents QuotaExceededError in browser storage while keeping visual sharpness.
 * Robust against varied parameter orders (e.g. compressImage(file, 1200, 0.75)).
 */
export async function compressImage(
  dataUrlOrFile: string | File | Blob,
  maxWidthOrOptions: number | CompressOptions = 1080,
  maxHeightOrQuality: number = 1080,
  qualityParam: number = 0.75
): Promise<string> {
  // Resolve arguments safely to handle both (file, maxWidth, maxHeight, quality)
  // and callers invoking (file, maxDimension, quality) where 3rd arg is <= 1.0
  let maxWidth = 1080;
  let maxHeight = 1080;
  let quality = 0.75;

  if (typeof maxWidthOrOptions === 'object' && maxWidthOrOptions !== null) {
    maxWidth = maxWidthOrOptions.maxWidth ?? 1080;
    maxHeight = maxWidthOrOptions.maxHeight ?? maxWidth;
    quality = maxWidthOrOptions.quality ?? 0.75;
  } else if (typeof maxWidthOrOptions === 'number') {
    maxWidth = maxWidthOrOptions;
    if (typeof maxHeightOrQuality === 'number') {
      if (maxHeightOrQuality > 0 && maxHeightOrQuality <= 1.0) {
        // Caller invoked compressImage(file, 1200, 0.75) where 3rd arg is quality
        maxHeight = maxWidth;
        quality = maxHeightOrQuality;
      } else {
        maxHeight = maxHeightOrQuality;
        quality = typeof qualityParam === 'number' ? qualityParam : 0.75;
      }
    }
  }

  // Ensure minimum sane dimensions
  maxWidth = Math.max(100, Math.round(maxWidth));
  maxHeight = Math.max(100, Math.round(maxHeight));
  quality = Math.min(1.0, Math.max(0.1, quality));

  // Obtain source string safely
  let rawSrc = '';
  let isBlobUrl = false;
  try {
    if (typeof dataUrlOrFile === 'string') {
      rawSrc = dataUrlOrFile;
    } else if (dataUrlOrFile instanceof Blob) {
      rawSrc = await fileToDataUrl(dataUrlOrFile);
    } else {
      return '';
    }
  } catch (_readErr) {
    if (typeof dataUrlOrFile !== 'string') {
      try {
        rawSrc = URL.createObjectURL(dataUrlOrFile);
        isBlobUrl = true;
      } catch {
        return '';
      }
    }
  }

  return new Promise((resolve) => {
    const img = new Image();

    // NEVER set crossOrigin on data: or blob: URLs as it can taint canvas or cause blank render
    if (rawSrc.startsWith('http://') || rawSrc.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    const cleanup = () => {
      if (isBlobUrl) {
        try {
          URL.revokeObjectURL(rawSrc);
        } catch (_) {}
      }
    };

    const processCanvas = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height || width <= 0 || height <= 0) {
          cleanup();
          resolve(rawSrc);
          return;
        }

        // Calculate aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          cleanup();
          resolve(rawSrc);
          return;
        }

        // Draw image directly onto canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG
        const compressed = canvas.toDataURL('image/jpeg', quality);
        cleanup();
        if (!compressed || compressed.length < 100) {
          resolve(rawSrc);
        } else {
          resolve(compressed);
        }
      } catch (_err) {
        cleanup();
        resolve(rawSrc);
      }
    };

    img.onload = () => {
      if ('decode' in img && typeof img.decode === 'function') {
        img
          .decode()
          .then(() => processCanvas())
          .catch(() => processCanvas());
      } else {
        processCanvas();
      }
    };

    img.onerror = () => {
      cleanup();
      resolve(rawSrc);
    };

    img.src = rawSrc;
  });
}
