// Shrink photos before upload (faster, and converts formats the model can't read, like AVIF
// or HEIC where the browser can decode them, into JPEG). PDFs go up unchanged.
const MAX_SIDE = 2000;
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,application/pdf";

export class FileProblem extends Error {
  constructor(public kind: "too_big" | "unsupported") {
    super(kind);
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) throw new FileProblem("too_big");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new FileProblem("unsupported");
  let img: ImageBitmap | HTMLImageElement;
  try {
    img = await decode(file);
  } catch {
    throw new FileProblem("unsupported");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new FileProblem("unsupported");
  if (blob.size > MAX_BYTES) throw new FileProblem("too_big");
  return new File([blob], "upload.jpg", { type: "image/jpeg" });
}
