import { Check, Loader2, Share2 } from 'lucide-react';
import React, { useState } from 'react';

interface Props {
  text: string;
}

export const ShareButton: React.FC<Props> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing || copied) return;
    setIsSharing(true);

    try {
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
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={isSharing || copied}
      className="flex items-center justify-center gap-2 bg-correct hover:brightness-110 text-white font-bold py-3 px-4 rounded-lg transition-all active:scale-95 w-full cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      {isSharing ? (
        <>
          <Loader2 size={20} className="animate-spin" /> SHARING...
        </>
      ) : copied ? (
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