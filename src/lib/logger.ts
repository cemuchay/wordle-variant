/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./supabaseClient";
import { safeLocalStorage } from "../utils/storage";

export type LogLevel = "info" | "warn" | "error" | "fatal";

interface LogEntry {
   level: LogLevel;
   message: string;
   context?: any;
   timestamp: string;
}

class Logger {
   private static instance: Logger;
   private sessionId: string;
   private buffer: LogEntry[] = [];
   private readonly MAX_BUFFER_SIZE = 50;
   private isStreaming = false;

   private constructor() {
      this.sessionId = Math.random().toString(36).substring(2, 15);
      this.initGlobalHandlers();
   }

   public static getInstance(): Logger {
      if (!Logger.instance) {
         Logger.instance = new Logger();
      }
      return Logger.instance;
   }

   private initGlobalHandlers() {
      window.onerror = (message, source, lineno, colno, error) => {
         this.fatal("Unhandled Runtime Error", {
            message,
            source,
            lineno,
            colno,
            stack: error?.stack,
         });
      };

      window.onunhandledrejection = (event) => {
         this.error("Unhandled Promise Rejection", {
            reason: event.reason,
         });
      };
   }

   private async getUserDetails(): Promise<{ id: string | null; name: string | null }> {
      try {
         const {
            data: { user },
         } = await supabase.auth.getUser();
         if (!user) return { id: null, name: null };

         let name = user.user_metadata?.username || user.user_metadata?.display_name || user.user_metadata?.full_name || null;

         if (!name) {
            const { data } = await supabase
               .from("profiles")
               .select("username")
               .eq("id", user.id)
               .single();
            name = data?.username || null;
         }
         return { id: user.id, name };
      } catch (e) {
         console.warn("[Logger] Error fetching user details:", e);
         return { id: null, name: null };
      }
   }

   private addToBuffer(entry: LogEntry) {
      this.buffer.push(entry);
      if (this.buffer.length > this.MAX_BUFFER_SIZE) {
         this.buffer.shift();
      }
   }

   private async streamLog(entry: LogEntry) {
      if (this.isStreaming) return;
      this.isStreaming = true;

      try {
         const { id: userId, name: username } = await this.getUserDetails();
         const { error } = await supabase.from("client_logs").insert([
            {
               level: entry.level,
               message: entry.message,
               context: {
                  ...this.safeJsonClone(entry.context),
                  browser: navigator.userAgent,
                  url: window.location.href,
                  timestamp: entry.timestamp,
                  user_id: userId,
                  username: username,
               },
               session_id: this.sessionId,
               user_id: userId,
            },
         ]);

         if (error) {
            console.warn(
               "[Logger] Failed to stream log to Supabase:",
               error.message,
            );
         }
      } catch (e) {
         console.warn("[Logger] Error in streamLog:", e);
      } finally {
         this.isStreaming = false;
      }
   }

   private safeJsonClone(obj: any): any {
      if (!obj) return obj;
      const cache = new WeakSet();
      try {
         return JSON.parse(
            JSON.stringify(obj, (key, value) => {
               if (typeof value === "object" && value !== null) {
                  if (cache.has(value)) return undefined; // Prune circular reference
                  cache.add(value);
               }
               if (key === "logs" && Array.isArray(value))
                  return "[NESTED_LOGS]"; // Avoid recursive log structures
               return value;
            }),
         );
      } catch (e) {
         return { error: "Cloning failed", message: String(e) };
      }
   }

   public info(message: string, context?: unknown) {
      const entry: LogEntry = {
         level: "info",
         message,
         context,
         timestamp: new Date().toISOString(),
      };
      this.addToBuffer(entry);
      console.log(`[INFO] ${message}`, context);
   }

   public warn(message: string, context?: unknown) {
      const entry: LogEntry = {
         level: "warn",
         message,
         context,
         timestamp: new Date().toISOString(),
      };
      this.addToBuffer(entry);
      console.warn(`[WARN] ${message}`, context);
   }

   public error(message: string, context?: unknown) {
      const entry: LogEntry = {
         level: "error",
         message,
         context,
         timestamp: new Date().toISOString(),
      };
      this.addToBuffer(entry);
      console.error(`[ERROR] ${message}`, context);
      this.streamLog(entry);
   }

   public fatal(message: string, context?: unknown) {
      const entry: LogEntry = {
         level: "fatal",
         message,
         context,
         timestamp: new Date().toISOString(),
      };
      this.addToBuffer(entry);
      console.error(`[FATAL] ${message}`, context);
      // Fatal logs are always streamed immediately
      this.streamLog(entry);
   }

   public getLogs(): LogEntry[] {
      return [...this.buffer];
   }

   public async sendLogsToAdmin() {
      const storage: Record<string, any> = {};
      const keys = safeLocalStorage.getAllKeys();
      for (const key of keys) {
         const value = safeLocalStorage.getItem(key) || "";
         try {
            // Attempt to parse JSON for better formatting in the diagnostic report
            storage[key] = JSON.parse(value);
         } catch {
            storage[key] = value;
         }
      }

      // Use safeJsonClone to avoid circular references when snapshoting the buffer
      const logsCopy = this.safeJsonClone(this.buffer);

      const data = {
         logs: logsCopy,
         device: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
         },
         localStorage: storage,
      };

      // We use fatal level to trigger the admin email alert pattern
      const entry: LogEntry = {
         level: "fatal",
         message: "MANUAL SESSION LOG REQUEST",
         context: data,
         timestamp: new Date().toISOString(),
      };

      // Add to buffer AFTER copying the buffer to avoid self-reference
      this.addToBuffer(entry);

      // Stream to database
      await this.streamLog(entry);

      // Also directly invoke the edge function to ensure email delivery
      try {
         const { id: userId, name: username } = await this.getUserDetails();
         await supabase.functions.invoke("send-error-email", {
            body: {
               record: {
                  ...entry,
                  context: {
                     ...entry.context,
                     user_id: userId,
                     username: username,
                  },
                  session_id: this.sessionId,
                  user_id: userId,
                  created_at: entry.timestamp,
               },
            },
         });
      } catch (e) {
         console.warn("[Logger] Direct email invocation failed:", e);
      }
   }

   public downloadLogs() {
      const data = JSON.stringify(
         {
            sessionId: this.sessionId,
            logs: this.buffer,
            device: {
               userAgent: navigator.userAgent,
               platform: navigator.platform,
               language: navigator.language,
               screen: `${window.screen.width}x${window.screen.height}`,
            },
         },
         null,
         2,
      );

      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wordle-debug-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
   }
}

export const logger = Logger.getInstance();
