import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

const DEFAULT_VIDEO_BUCKET = 'video-journals';

const getExtension = (uri: string) => {
  const cleanUri = uri.split('?')[0] ?? uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();

  if (!extension || extension.includes('/')) {
    return 'mp4';
  }

  return extension;
};

const getContentType = (extension: string) => {
  if (extension === 'mov') {
    return 'video/quicktime';
  }

  if (extension === 'm4v') {
    return 'video/x-m4v';
  }

  return 'video/mp4';
};

export const getVideoBucket = () =>
  process.env.EXPO_PUBLIC_SUPABASE_VIDEO_BUCKET ?? DEFAULT_VIDEO_BUCKET;

export const uploadJournalVideo = async ({
  uri,
  userId,
  journalId,
}: {
  uri: string;
  userId: string;
  journalId: string;
}) => {
  const fileInfo = await FileSystem.getInfoAsync(uri);

  if (!fileInfo.exists) {
    throw new Error(`Recorded video not found at "${uri}".`);
  }

  const extension = getExtension(uri);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) {
    throw new Error('Recorded video file was empty and could not be uploaded.');
  }

  const filePath = `${journalId}/${userId}/${Date.now()}.${extension}`;
  const bucket = getVideoBucket();

  const { error } = await supabase.storage.from(bucket).upload(
    filePath,
    decode(base64),
    {
      contentType: getContentType(extension),
      upsert: false,
    }
  );

  if (error) {
    throw new Error(
      `Storage upload failed for bucket "${bucket}" at path "${filePath}": ${error.message}`
    );
  }

  return {
    bucket,
    filePath,
    storagePath: `${bucket}/${filePath}`,
  };
};
