import { RotateCw } from 'lucide-react';

export const LandscapeBlocker = () => {
  return (
    <div className="landscape-blocker-overlay">
      <div className="landscape-blocker-content">
        {/* Animated Phone Icon */}
        <div className="phone-icon-wrapper">
          <svg
            className="phone-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Smartphone frame */}
            <rect x="5" y="2" width="14" height="20" rx="3" />
            {/* Screen inner boundary */}
            <path d="M5 6h14" />
            <path d="M5 18h14" />
            {/* Home button / Indicator */}
            <circle cx="12" cy="20" r="0.5" fill="currentColor" />
            {/* Speaker */}
            <path d="M10 4h4" />
          </svg>
          <RotateCw className="rotate-arrow-svg" size={20} />
        </div>

        {/* Informative text */}
        <h2 className="blocker-title">
          Rotate Your Device
        </h2>
        <p className="blocker-subtitle">
          This game is optimized for portrait mode. Please turn your device to continue playing.
        </p>

        {/* Visual decoration */}
        <div className="blocker-badge">
          Portrait Only
        </div>
      </div>
    </div>
  );
};
