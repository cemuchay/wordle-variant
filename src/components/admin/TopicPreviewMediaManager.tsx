import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
   TOPIC_PREVIEW_BUCKET,
   TOPIC_VIDEO_RULES,
   TOPIC_SCREENSHOT_RULES,
   validateTopicVideo,
   validateTopicScreenshot,
   fetchTopicPreviewMedia,
   type TopicPreviewMedia,
} from "@/wordup/shared/topicPreviewMedia";
import { Film, Image as ImageIcon, Trash2, Upload, X, AlertCircle, Loader2 } from "lucide-react";

interface TopicPreviewMediaManagerProps {
   topicSlug: string;
   topicName: string;
   onClose: () => void;
   triggerToast: (text: string, type?: "success" | "error") => void;
}

export const TopicPreviewMediaManager = ({
   topicSlug,
   topicName,
   onClose,
   triggerToast,
}: TopicPreviewMediaManagerProps) => {
   const [media, setMedia] = useState<TopicPreviewMedia>({
      videoUrl: null,
      videoPath: null,
      screenshots: [],
   });
   const [loading, setLoading] = useState(true);
   const [uploadingVideo, setUploadingVideo] = useState(false);
   const [uploadingImg, setUploadingImg] = useState(false);
   const [validationError, setValidationError] = useState<string | null>(null);

   const loadMedia = useCallback(async () => {
      setLoading(true);
      const res = await fetchTopicPreviewMedia(topicSlug);
      setMedia(res);
      setLoading(false);
   }, [topicSlug]);

   useEffect(() => {
      loadMedia();
   }, [loadMedia]);

   const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setValidationError(null);
      const check = await validateTopicVideo(file);
      if (!check.valid) {
         setValidationError(check.error || "Invalid video file.");
         return;
      }

      setUploadingVideo(true);
      try {
         // Remove old video if present
         if (media.videoPath) {
            await supabase.storage.from(TOPIC_PREVIEW_BUCKET).remove([media.videoPath]);
         }
         const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
         const path = `${topicSlug}/preview.${ext}`;
         const { error } = await supabase.storage
            .from(TOPIC_PREVIEW_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });

         if (error) throw error;
         triggerToast("Preview video uploaded!", "success");
         await loadMedia();
      } catch (err: any) {
         setValidationError(err.message || "Failed to upload video.");
      } finally {
         setUploadingVideo(false);
      }
   };

   const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length === 0) return;

      setValidationError(null);
      setUploadingImg(true);
      try {
         for (const file of files) {
            const check = await validateTopicScreenshot(file);
            if (!check.valid) {
               setValidationError(`${file.name}: ${check.error}`);
               setUploadingImg(false);
               return;
            }
         }

         for (const file of files) {
            const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
            const path = `${topicSlug}/screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
            const { error } = await supabase.storage
               .from(TOPIC_PREVIEW_BUCKET)
               .upload(path, file, { upsert: true, contentType: file.type });
            if (error) throw error;
         }

         triggerToast(`Uploaded ${files.length} screenshot(s)!`, "success");
         await loadMedia();
      } catch (err: any) {
         setValidationError(err.message || "Failed to upload screenshot.");
      } finally {
         setUploadingImg(false);
      }
   };

   const handleDelete = async (path: string) => {
      try {
         const { error } = await supabase.storage.from(TOPIC_PREVIEW_BUCKET).remove([path]);
         if (error) throw error;
         triggerToast("Media deleted", "success");
         await loadMedia();
      } catch (err: any) {
         triggerToast(err.message || "Delete failed", "error");
      }
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
         <div className="bg-[#161618] border border-white/15 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
               <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                     Preview Media — {topicName}
                  </h3>
                  <p className="text-[11px] text-white/50 font-mono">{topicSlug}</p>
               </div>
               <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
               >
                  <X size={18} />
               </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
               {validationError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-xs font-semibold">
                     <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                     <span>{validationError}</span>
                  </div>
               )}

               {loading ? (
                  <div className="flex items-center justify-center py-12 text-white/50 gap-2 text-xs font-bold uppercase">
                     <Loader2 size={16} className="animate-spin" /> Loading media...
                  </div>
               ) : (
                  <>
                     {/* Gameplay Video Section */}
                     <div className="space-y-2.5 bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <Film size={16} className="text-[#E85151]" />
                              <span className="text-xs font-black uppercase tracking-wider text-white">
                                 Gameplay Video
                              </span>
                           </div>
                           <label className="flex items-center gap-1.5 bg-[#E85151] hover:bg-[#d44343] text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                              {uploadingVideo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                              <span>{media.videoUrl ? "Replace Video" : "Upload Video"}</span>
                              <input
                                 type="file"
                                 accept="video/mp4,video/webm"
                                 onChange={handleVideoUpload}
                                 disabled={uploadingVideo}
                                 className="hidden"
                              />
                           </label>
                        </div>

                        <p className="text-[10px] text-white/50">
                           Rules: MP4 or WebM • Max {TOPIC_VIDEO_RULES.MAX_SIZE_BYTES / (1024 * 1024)} MB • Max {TOPIC_VIDEO_RULES.MAX_DURATION_SECS}s duration
                        </p>

                        {media.videoUrl ? (
                           <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video max-h-56">
                              <video
                                 src={media.videoUrl}
                                 autoPlay
                                 loop
                                 muted
                                 playsInline
                                 className="w-full h-full object-contain"
                              />
                              {media.videoPath && (
                                 <button
                                    onClick={() => handleDelete(media.videoPath!)}
                                    className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-lg border border-white/15 cursor-pointer"
                                    title="Delete Video"
                                 >
                                    <Trash2 size={14} />
                                 </button>
                              )}
                           </div>
                        ) : (
                           <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-[11px] text-white/40 font-bold uppercase">
                              No preview video uploaded
                           </div>
                        )}
                     </div>

                     {/* Screenshots Section */}
                     <div className="space-y-2.5 bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <ImageIcon size={16} className="text-emerald-400" />
                              <span className="text-xs font-black uppercase tracking-wider text-white">
                                 Screenshots ({media.screenshots.length})
                              </span>
                           </div>
                           <label className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg cursor-pointer transition-all">
                              {uploadingImg ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                              <span>Add Screenshots</span>
                              <input
                                 type="file"
                                 accept="image/webp,image/png,image/jpeg"
                                 multiple
                                 onChange={handleScreenshotUpload}
                                 disabled={uploadingImg}
                                 className="hidden"
                              />
                           </label>
                        </div>

                        <p className="text-[10px] text-white/50">
                           Rules: WebP, PNG, or JPG • Max {TOPIC_SCREENSHOT_RULES.MAX_SIZE_BYTES / (1024 * 1024)} MB • Max {TOPIC_SCREENSHOT_RULES.MAX_DIMENSION_PX}×{TOPIC_SCREENSHOT_RULES.MAX_DIMENSION_PX}px
                        </p>

                        {media.screenshots.length > 0 ? (
                           <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {media.screenshots.map((shot) => (
                                 <div key={shot.path} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black aspect-video">
                                    <img
                                       src={shot.url}
                                       alt={shot.name}
                                       className="w-full h-full object-cover"
                                    />
                                    <button
                                       onClick={() => handleDelete(shot.path)}
                                       className="absolute top-1.5 right-1.5 p-1 bg-black/75 hover:bg-red-600 text-white rounded-md opacity-80 group-hover:opacity-100 cursor-pointer"
                                       title="Delete Screenshot"
                                    >
                                       <Trash2 size={12} />
                                    </button>
                                 </div>
                              ))}
                           </div>
                        ) : (
                           <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-[11px] text-white/40 font-bold uppercase">
                              No screenshots uploaded
                           </div>
                        )}
                     </div>
                  </>
               )}
            </div>
         </div>
      </div>
   );
};

