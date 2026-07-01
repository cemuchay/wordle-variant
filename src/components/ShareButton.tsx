import { Check, Share2 } from 'lucide-react';
import React, { useState } from 'react';

interface Props {
  text: string;
}

export const ShareButton: React.FC<Props> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) { /* empty */ }
    }

    // Fallback to Clipboard
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 bg-correct hover:brightness-110 text-white font-bold py-3 px-4 rounded-lg transition-all active:scale-95 w-full cursor-pointer"
    >
      {copied ? (
        <>
          <Check size={20} /> COPIED!
        </>
      ) : (
        <>
          <Share2 size={20} /> SHARE RESULTS
        </>
      )}
    </button>
  );
};