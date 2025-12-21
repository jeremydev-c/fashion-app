import { apiRequest } from './apiClient';

export type UploadImageResponse = {
  success: boolean;
  image: {
    url: string;
    publicId: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    thumbnailUrl: string;
    mediumUrl: string;
  };
};

import * as FileSystem from 'expo-file-system';

/**
 * Upload image file to Cloudinary via backend
 */
export async function uploadImageFile(
  imageUri: string,
  options?: {
    removeBackground?: boolean;
    enhance?: boolean;
    folder?: string;
  }
): Promise<UploadImageResponse> {
  // Convert local URI to base64 using expo-file-system
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return uploadImageBase64(base64, options);
}

/**
 * Upload base64 image to Cloudinary via backend
 */
export async function uploadImageBase64(
  imageBase64: string,
  options?: {
    removeBackground?: boolean;
    enhance?: boolean;
    folder?: string;
  }
): Promise<UploadImageResponse> {
  const res = await apiRequest<UploadImageResponse>('/upload/image-base64', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64,
      removeBackground: options?.removeBackground || false,
      enhance: options?.enhance || false,
      folder: options?.folder || 'wardrobe',
    }),
  });

  return res;
}

