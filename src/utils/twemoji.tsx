// src/utils/twemoji.tsx
import React from 'react';

// Twemoji CDN base URL (standard Twitter/Discord emoji asset CDN)
const TWEMOJI_BASE_URL = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg';

/**
 * Converts a Unicode emoji string into its Twemoji hex code point sequence
 * e.g., '👨‍💻' -> '1f468-200d-1f4bb'
 */
export function toCodePoint(unicodeSurrogates: string): string {
  const r: string[] = [];
  let c = 0;
  let p = 0;
  let i = 0;
  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++);
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16));
      p = 0;
    } else if (0xd800 <= c && c <= 0xdbff) {
      p = c;
    } else {
      r.push(c.toString(16));
    }
  }
  // Trim default variation selectors (\ufe0f) unless part of keycaps/modifiers
  return r.filter(cp => cp !== 'fe0f').join('-');
}

// Regex matching standard and modern Unicode emoji sequences (including ZWJ, skin tones, flags)
export const EMOJI_REGEX = /(?:\ud83c[\udde6-\uddff]{2}|(?:\ud83c[\udffb-\udfff])|(?:\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83c[\udf00-\udfff]|\ud83e[\udd00-\udfff]|\u2600-\u26ff|\u2700-\u27bf|\u2300-\u23ff|\u2b50|\u2b55|\u2934|\u2935|\u25aa|\u25ab|\u25b6|\u25c0|\u25fb-\u25fe|\u3030|\u303d|\u00a9|\u00ae|\u2122|\u203c|\u2049|\u2139|\u2194-\u2199|\u21a9-\u21aa)(?:\ufe0f|\ud83c[\udffb-\udfff])?(?:\u200d(?:\ud83d[\udc00-\ude4f\ude80-\udeff]|\ud83c[\udf00-\udfff]|\ud83e[\udd00-\udfff]|\u2600-\u26ff|\u2700-\u27bf|\u2300-\u23ff|\u2b50)(?:\ufe0f|\ud83c[\udffb-\udfff])?)*)/g;

/**
 * Parses a string and returns React nodes with emojis replaced by crisp, universally-supported Twemoji SVGs.
 */
export function renderEmojiNode(text: string, keyPrefix = 'tw'): React.ReactNode {
  if (!text) return text;
  // Quick test before running string splits
  if (!EMOJI_REGEX.test(text)) return text;
  EMOJI_REGEX.lastIndex = 0;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    const rawEmoji = match[0];
    const matchIdx = match.index;

    // Push preceding text if any
    if (matchIdx > lastIdx) {
      parts.push(text.slice(lastIdx, matchIdx));
    }

    const hex = toCodePoint(rawEmoji);
    const src = `${TWEMOJI_BASE_URL}/${hex}.svg`;

    parts.push(
      <img
        key={`${keyPrefix}-em-${matchIdx}`}
        src={src}
        alt={rawEmoji}
        draggable={false}
        loading="lazy"
        className="inline-block align-[-0.15em] w-[1.15em] h-[1.15em] mx-[0.05em] select-none pointer-events-none"
        onError={(e) => {
          // If SVG fails to load (rare/offline fallback), revert gracefully to native emoji character
          const target = e.currentTarget;
          target.style.display = 'none';
          if (target.parentElement) {
            target.parentElement.appendChild(document.createTextNode(rawEmoji));
          }
        }}
      />
    );

    lastIdx = matchIdx + rawEmoji.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}
