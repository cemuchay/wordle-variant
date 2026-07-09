import type { WordUpQuestion } from "./types";

// AES-GCM decryption for edge function payloads
export async function decryptAESGCM(
   encryptedBase64: string,
   base64Key: string,
): Promise<string> {
   const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
   const key = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
   );
   const combined = Uint8Array.from(atob(encryptedBase64), (c) =>
      c.charCodeAt(0),
   );
   const iv = combined.slice(0, 12);
   const data = combined.slice(12);
   const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
   );
   return new TextDecoder().decode(decrypted);
}

// Unified decryption: tries AES-GCM first (edge function), falls back to XOR (legacy)
export async function decryptMatchQuestions(match: {
   encrypted_questions?: string;
   questions?: string;
   encryption_key: string;
}): Promise<WordUpQuestion[]> {
   const key = match.encryption_key;
   if (!key) throw new Error("No encryption key found on match");

   // Try the raw encrypted payload (if edge function wrote to a separate column)
   if (match.encrypted_questions) {
      try {
         const plain = await decryptAESGCM(match.encrypted_questions, key);
         return JSON.parse(plain);
      } catch (e) {
         console.warn("AES-GCM on encrypted_questions failed:", e);
      }
   }

   if (match.questions) {
      try {
         const plain = await decryptAESGCM(match.questions, key);
         return JSON.parse(plain);
      } catch {
         return decryptQuestions(match.questions, key);
      }
   }

   throw new Error("No encrypted questions found on match");
}

// XOR Base64 (legacy client-side encryption)

export const generateSecretKey = (): string => {
   const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let key = "";
   for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return key;
};

export const encryptQuestions = (
   questions: WordUpQuestion[],
   key: string,
): string => {
   const str = JSON.stringify(questions);
   let result = "";
   for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(
         str.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
   }
   return btoa(encodeURIComponent(result));
};

export const decryptQuestions = (
   encryptedStr: string,
   key: string,
): WordUpQuestion[] => {
   const decoded = decodeURIComponent(atob(encryptedStr));
   let result = "";
   for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
         decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
   }
   return JSON.parse(result);
};
