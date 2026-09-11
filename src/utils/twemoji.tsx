// src/utils/twemoji.tsx
import React, { useState, useEffect } from 'react';
import { getMemoryEmoji, loadEmojiSvg, subscribeEmoji } from './emojiCache';

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
 * Reactive Twemoji component that renders native Unicode immediately (0ms delay),
 * while asynchronously loading & caching the crisp Twemoji SVG in IndexedDB.
 */
export function Twemoji({ rawEmoji, hex }: { rawEmoji: string; hex: string }) {
  const [cachedSrc, setCachedSrc] = useState<string | null>(() => getMemoryEmoji(hex));

  useEffect(() => {
    if (cachedSrc) return;

    // Check synchronous memory again or subscribe to pending download
    const currentInMem = getMemoryEmoji(hex);
    if (currentInMem) {
      setCachedSrc(currentInMem);
      return;
    }

    const unsubscribe = subscribeEmoji(hex, (url) => {
      setCachedSrc(url);
    });

    // Trigger async load (IndexedDB -> CDN fallback)
    void loadEmojiSvg(hex);

    return unsubscribe;
  }, [hex, cachedSrc]);

  if (cachedSrc) {
    return (
      <img
        src={cachedSrc}
        alt={rawEmoji}
        draggable={false}
        className="inline-block align-[-0.15em] w-[1.15em] h-[1.15em] mx-[0.05em] select-none pointer-events-none"
      />
    );
  }

  // Instant zero-delay native fallback
  return (
    <span className="font-emoji inline-block align-[-0.05em] mx-[0.03em] select-text">
      {rawEmoji}
    </span>
  );
}

/**
 * Parses a string and returns React nodes with instant native emoji first,
 * seamlessly upgraded to cached Twemoji SVGs once available.
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

    parts.push(
      <Twemoji
        key={`${keyPrefix}-em-${matchIdx}`}
        rawEmoji={rawEmoji}
        hex={hex}
      />
    );

    lastIdx = matchIdx + rawEmoji.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return parts;
}
