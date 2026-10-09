// Shrink photos on the phone before upload: faster on 4G, and converts formats the model
// can't read (AVIF, HEIC where the browser supports it) into JPEG.
const MAX_SIDE = 2000;
const MAX_BYTES = 10 * 1024 * 1024;

async function decode(file) {
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

export async function prepareFile(file) {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) throw new Error("PDF is larger than 10 MB");
    return file;
  }
  let img;
  try {
    img = await decode(file);
  } catch {
    throw new Error("This image format isn't supported. Please take a photo or use JPEG/PNG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return new File([blob], "upload.jpg", { type: "image/jpeg" });
}
