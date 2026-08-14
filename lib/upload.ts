import * as FileSystem from 'expo-file-system/legacy';
import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import { Image } from 'react-native';
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

/**
 * Resolve the pixel size of a local image (needed for center-crop).
 * Falls back to error → caller handles it.
 */
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return map[ext] || 'image/jpeg';
}

/**
 * Generate a unique file path for a listing image.
 * Format: {userId}/{timestamp}-{random}.{ext}
 */
function generateFilePath(userId: string, ext: string): string {
  const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return `${userId}/${name}.${ext}`;
}

/**
 * Upload a local image file to Supabase Storage.
 *
 * @param uri - Local file URI (from image picker or camera)
 * @param userId - Owner's user ID (used for path isolation)
 * @returns Public URL of the uploaded image
 * @throws If the upload fails
 */
export async function uploadImage(uri: string, userId: string): Promise<string> {
  if (!uri) throw new Error('Selecciona una foto');
  if (!userId) throw new Error('Se requiere el usuario');

  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const filePath = generateFilePath(userId, safeExt);
  let contentType = mimeFromExt(safeExt);

  // Comprimir y redimensionar la imagen antes de subir (ahorra espacio + ancho de banda)
  let processedUri = uri;
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: 1200 });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.WEBP,
      compress: 0.82,
    });
    processedUri = result.uri;
    contentType = 'image/webp';
  } catch {
    // Si falla la manipulación, subir la original
    console.warn('Image manipulation failed, using original');
  }

  // Read the file as base64 via expo-file-system (reliable in React Native)
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(processedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (readError) {
    throw new Error('No se pudo leer el archivo de imagen');
  }

  // Decode base64 to binary ArrayBuffer for Supabase upload
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('listing-images')
    .upload(filePath, bytes.buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('listing-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Delete an image from Supabase Storage using its public URL.
 *
 * @param publicUrl - Full public URL of the image to delete
 * @throws If the URL doesn't belong to listing-images or deletion fails
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  if (!publicUrl) throw new Error('Public URL is required');

  // Extract the file path from the public URL
  const baseUrl = supabase.storage
    .from('listing-images')
    .getPublicUrl('')
    .data.publicUrl.replace(/\/?$/, '/');

  if (!publicUrl.startsWith(baseUrl)) {
    throw new Error('URL does not belong to the listing-images bucket');
  }

  const filePath = publicUrl.replace(baseUrl, '');

  const { error } = await supabase.storage
    .from('listing-images')
    .remove([filePath]);

  if (error) throw error;
}

/**
 * Upload a user avatar to Supabase Storage.
 * Paridad con la web (src/lib/upload.ts uploadAvatar): path FIJO
 * `{userId}/avatar.webp`, center-crop cuadrado 256x256, compresion webp
 * 0.8, borra el avatar anterior y re-sube con upsert. El path fijo hace
 * que cada usuario tenga un solo objeto en el bucket `avatars`.
 *
 * @param uri - Local image URI (from image picker)
 * @param userId - Owner's user ID (used for path isolation)
 * @returns Public URL of the uploaded avatar
 * @throws If the upload fails
 */
export async function uploadAvatar(uri: string, userId: string): Promise<string> {
  if (!uri) throw new Error('Selecciona una foto');
  if (!userId) throw new Error('Se requiere el usuario');

  // Center-crop a cuadrado + 256x256 + webp 0.8 (paridad web). Si algo
  // falla (dimensiones, manipulacion), se sube la original con su mime real.
  let processedUri = uri;
  let contentType = mimeFromExt(uri.split('.').pop()?.toLowerCase() || 'jpg');
  try {
    const { width, height } = await getImageSize(uri);
    const size = Math.min(width, height);
    const originX = Math.round((width - size) / 2);
    const originY = Math.round((height - size) / 2);

    const context = ImageManipulator.manipulate(uri);
    context.crop({ originX, originY, width: size, height: size });
    context.resize({ width: 256, height: 256 });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({
      format: SaveFormat.WEBP,
      compress: 0.8,
    });
    processedUri = result.uri;
    contentType = 'image/webp';
  } catch {
    console.warn('Avatar manipulation failed, using original');
  }

  // Read the file as base64 via expo-file-system (reliable in React Native)
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(processedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    throw new Error('No se pudo leer el archivo de imagen');
  }

  // Decode base64 to binary ArrayBuffer for Supabase upload
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const avatarPath = `${userId}/avatar.webp`;

  // Upload con upsert: reemplaza el avatar anterior atómicamente. NO se hace
  // remove previo — si el upload fallara, el avatar existente quedaría borrado
  // y `avatar_url` apuntaría a un objeto inexistente.
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, bytes.buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(avatarPath);

  return publicUrl;
}
