/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '../lib/supabaseClient';
import { RETRY } from '../constants/game';
import type { OutboxEntry } from './outbox';

const retryOperation = async <T>(
   operation: () => Promise<T>,
   retries: number = RETRY.SYNC_COUNT,
   delay: number = RETRY.SYNC_DELAY,
): Promise<T> => {
   for (let i = 0; i < retries; i++) {
      try {
         return await operation();
      } catch (err) {
         if (i === retries - 1) throw err;
         await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
      }
   }
   throw new Error('unreachable');
};

// Insert a message row. A duplicate-key error means the realtime echo already
// persisted it — treated as success so outbox cleanup still runs.
export const insertMessageWithRetry = async (payload: any): Promise<void> => {
   await retryOperation(async () => {
      const { error } = await supabase.from("messages").insert([payload]);
      if (error) {
         if (error.code === '23505') return;
         throw error;
      }
   });
};

export const uploadVoiceAsset = async (userId: string, blob: Blob): Promise<string> => {
   const mimeType = blob.type || "audio/wav";
   let extension = "wav";
   if (mimeType.includes("webm")) extension = "webm";
   else if (mimeType.includes("mp4")) extension = "mp4";
   else if (mimeType.includes("ogg")) extension = "ogg";
   const fileName = `${userId}/${Date.now()}.${extension}`;

   await retryOperation(async () => {
      const { error: uploadErr } = await supabase.storage
         .from("voice-notes")
         .upload(fileName, blob, {
            contentType: mimeType,
            cacheControl: "3600",
         });
      if (uploadErr) throw uploadErr;
   });

   const { data } = supabase.storage.from("voice-notes").getPublicUrl(fileName);
   return data.publicUrl;
};

// Expects an already-compressed image blob.
export const uploadImageAsset = async (userId: string, blob: Blob): Promise<string> => {
   const fileName = `${userId}/${Date.now()}.jpg`;

   await retryOperation(async () => {
      const { error: uploadErr } = await supabase.storage
         .from("chat-images")
         .upload(fileName, blob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
         });
      if (uploadErr) throw uploadErr;
   });

   const { data } = supabase.storage.from("chat-images").getPublicUrl(fileName);
   return data.publicUrl;
};

// Deliver a queued outbox entry over the network. Returns the final remote
// URLs so callers can merge them into the store message.
export const deliverOutboxEntry = async (
   entry: OutboxEntry,
   userId: string,
): Promise<{ voiceUrl?: string; imageUrl?: string }> => {
   if (entry.kind === "text") {
      await insertMessageWithRetry(entry.payload);
      return {};
   }

   if (!entry.blob) {
      throw new Error(`Outbox entry ${entry.id} is missing its media blob`);
   }

   if (entry.kind === "voice") {
      const voiceUrl = await uploadVoiceAsset(userId, entry.blob);
      await insertMessageWithRetry({
         ...entry.payload,
         id: entry.id,
         voice_url: voiceUrl,
      });
      return { voiceUrl };
   }

   const imageUrl = await uploadImageAsset(userId, entry.blob);
   await insertMessageWithRetry({
      ...entry.payload,
      id: entry.id,
      image_url: imageUrl,
   });
   return { imageUrl };
};
