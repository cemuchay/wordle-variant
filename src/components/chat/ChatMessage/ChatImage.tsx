import { useState } from "react";
import { Download } from "lucide-react";
import { useAppStore } from "../../../store/useAppStore";

interface ChatImageProps {
  url: string;
}

function getThumbnailUrl(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}width=200&height=200&resize=cover`;
}

export const ChatImage = ({ url }: ChatImageProps) => {
  const setPreviewImage = useAppStore((s) => s.setPreviewImage);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch {
      useAppStore.getState().triggerToast("Failed to download image", 3000);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreview = () => {
    setPreviewImage(url);
  };

  if (hasError) {
    return (
      <div className="w-48 h-48 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center">
        <span className="text-[10px] text-white/40 font-black uppercase">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className="mt-1 relative w-48 h-48 rounded-xl overflow-hidden border border-white/10 group cursor-pointer bg-black/20" onClick={handlePreview}>
      <img
        src={getThumbnailUrl(url)}
        alt="shared image"
        className="w-full h-full object-cover rounded-xl"
        onError={() => setHasError(true)}
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-xl" />
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        title="Download image"
      >
        <Download size={14} className="text-white" />
      </button>
    </div>
  );
};
