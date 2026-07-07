import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

/**
 * Generate a unique file path for a listing image.
 * Format: {userId}/{timestamp}-{random}.{ext}
 */
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
  if (!uri) throw new Error('Image URI is required');
  if (!userId) throw new Error('User ID is required');

  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  const filePath = generateFilePath(userId, safeExt);
  let contentType = mimeFromExt(safeExt);

  // Comprimir y redimensionar la imagen antes de subir (ahorra espacio + ancho de banda)
  let processedUri = uri;
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );
    processedUri = result.uri;
    contentType = 'image/jpeg'; // la compresión convierte a JPEG
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
