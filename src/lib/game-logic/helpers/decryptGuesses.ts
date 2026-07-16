/* eslint-disable @typescript-eslint/no-explicit-any */
export const decryptGuessesSub = (encryptedStr: any, key: string) => {
   if (!encryptedStr) return [];
   if (typeof encryptedStr !== "string" || !encryptedStr.startsWith("enc:")) {
      try {
         return typeof encryptedStr === "string"
            ? JSON.parse(encryptedStr)
            : encryptedStr;
         // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
         return encryptedStr;
      }
   }
   if (!key) {
      console.warn("Decryption key is missing");
      return [];
   }
   try {
      const ciphertext = encryptedStr.substring(4);
      const decoded = atob(ciphertext);
      const decryptedBinary = decoded
         .split("")
         .map((char, i) => {
            const charCode = char.charCodeAt(0);
            const keyCode = key.charCodeAt(i % key.length);
            return String.fromCharCode(charCode ^ keyCode);
         })
         .join("");
      // Decode the UTF-8 binary string back to original unicode plaintext
      const plaintext = decodeURIComponent(escape(decryptedBinary));
      return JSON.parse(plaintext);
   } catch (e) {
      console.error("Decryption failed:", e);
      return [];
   }
};
