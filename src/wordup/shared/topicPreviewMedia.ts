import { supabase } from "../../lib/supabaseClient";

export const TOPIC_PREVIEW_BUCKET = "topic-previews";

export const TOPIC_VIDEO_RULES = {
   MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
   MAX_DURATION_SECS: 10.5,
   ALLOWED_TYPES: ["video/mp4", "video/webm"],
   ALLOWED_EXTENSIONS: [".mp4", ".webm"],
} as const;

export const TOPIC_SCREENSHOT_RULES = {
   MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2 MB
   MAX_DIMENSION_PX: 1920,
   ALLOWED_TYPES: ["image/webp", "image/png", "image/jpeg"],
   ALLOWED_EXTENSIONS: [".webp", ".png", ".jpg", ".jpeg"],
} as const;

export interface TopicPreviewMedia {
   videoUrl: string | null;
   videoPath: string | null;
   screenshots: { url: string; path: string; name: string }[];
}

export interface ValidationResult {
   valid: boolean;
   error?: string;
}

/** Validate a gameplay preview video against size, format, and duration rules before upload. */
export async function validateTopicVideo(
   file: File,
): Promise<ValidationResult> {
   const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
   if (
      !TOPIC_VIDEO_RULES.ALLOWED_TYPES.includes(file.type as any) &&
      !TOPIC_VIDEO_RULES.ALLOWED_EXTENSIONS.includes(ext as any)
   ) {
      return {
         valid: false,
         error: `Invalid video format. Allowed: ${TOPIC_VIDEO_RULES.ALLOWED_EXTENSIONS.join(", ")}`,
      };
   }

   if (file.size > TOPIC_VIDEO_RULES.MAX_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return {
         valid: false,
         error: `Video is too large (${mb} MB). Maximum allowed size is 5 MB.`,
      };
   }

   // Check duration using a temporary <video> element
   try {
      const duration = await new Promise<number>((resolve, reject) => {
         const url = URL.createObjectURL(file);
         const video = document.createElement("video");
         video.preload = "metadata";
         video.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(video.duration);
         };
         video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not read video metadata"));
         };
         video.src = url;
      });

      if (duration > TOPIC_VIDEO_RULES.MAX_DURATION_SECS) {
         return {
            valid: false,
            error: `Video is too long (${duration.toFixed(1)}s). Maximum allowed duration is ${TOPIC_VIDEO_RULES.MAX_DURATION_SECS}s.`,
         };
      }
   } catch {
      return {
         valid: false,
         error: "Unable to verify video metadata. Please ensure it is a valid MP4 or WebM file.",
      };
   }

   return { valid: true };
}

/** Validate a topic screenshot against size, format, and dimension rules before upload. */
export async function validateTopicScreenshot(
   file: File,
): Promise<ValidationResult> {
   const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
   if (
      !TOPIC_SCREENSHOT_RULES.ALLOWED_TYPES.includes(file.type as any) &&
      !TOPIC_SCREENSHOT_RULES.ALLOWED_EXTENSIONS.includes(ext as any)
   ) {
      return {
         valid: false,
         error: `Invalid image format. Allowed: ${TOPIC_SCREENSHOT_RULES.ALLOWED_EXTENSIONS.join(", ")}`,
      };
   }

   if (file.size > TOPIC_SCREENSHOT_RULES.MAX_SIZE_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      return {
         valid: false,
         error: `Image is too large (${mb} MB). Maximum allowed size is 2 MB.`,
      };
   }

   try {
      const dims = await new Promise<{ w: number; h: number }>(
         (resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
               URL.revokeObjectURL(url);
               resolve({ w: img.width, h: img.height });
            };
            img.onerror = () => {
               URL.revokeObjectURL(url);
               reject(new Error("Could not read image"));
            };
            img.src = url;
         },
      );

      if (
         dims.w > TOPIC_SCREENSHOT_RULES.MAX_DIMENSION_PX ||
         dims.h > TOPIC_SCREENSHOT_RULES.MAX_DIMENSION_PX
      ) {
         return {
            valid: false,
            error: `Image dimensions (${dims.w}×${dims.h}) exceed max ${TOPIC_SCREENSHOT_RULES.MAX_DIMENSION_PX}px.`,
         };
      }
   } catch {
      return {
         valid: false,
         error: "Unable to read image. Please ensure it is a valid WebP, PNG, or JPG.",
      };
   }

   return { valid: true };
}

/** Fetch the preview video and screenshots for a topic from Supabase Storage. */
export async function fetchTopicPreviewMedia(
   topicSlug: string,
): Promise<TopicPreviewMedia> {
   const empty: TopicPreviewMedia = {
      videoUrl: null,
      videoPath: null,
      screenshots: [],
   };
   if (!topicSlug) return empty;

   try {
      const { data: files, error } = await supabase.storage
         .from(TOPIC_PREVIEW_BUCKET)
         .list(topicSlug, {
            limit: 20,
            sortBy: { column: "name", order: "asc" },
         });

      if (error || !files) return empty;

      let videoUrl: string | null = null;
      let videoPath: string | null = null;
      const screenshots: { url: string; path: string; name: string }[] = [];

      for (const f of files) {
         if (!f.name || f.name.startsWith(".")) continue;
         const fullPath = `${topicSlug}/${f.name}`;
         const { data: pub } = supabase.storage
            .from(TOPIC_PREVIEW_BUCKET)
            .getPublicUrl(fullPath);
         const lower = f.name.toLowerCase();

         if (lower.endsWith(".mp4") || lower.endsWith(".webm")) {
            videoUrl = pub.publicUrl;
            videoPath = fullPath;
         } else if (
            lower.endsWith(".webp") ||
            lower.endsWith(".png") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg")
         ) {
            screenshots.push({
               url: pub.publicUrl,
               path: fullPath,
               name: f.name,
            });
         }
      }

      return { videoUrl, videoPath, screenshots };
   } catch {
      return empty;
   }
}
