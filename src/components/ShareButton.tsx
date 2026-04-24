import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

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
      } catch (err) {
        console.log("Share cancelled", err);
      }
    }
    
    // Fallback to Clipboard
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 bg-correct hover:brightness-110 text-white font-bold py-3 px-8 rounded-lg transition-all active:scale-95 w-full"
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