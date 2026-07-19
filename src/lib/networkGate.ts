/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./supabaseClient";
import { safeLocalStorage } from "../utils/storage";

export interface SerializedRequest {
   type: "supabase";
   table: string;
   operation: "select" | "insert" | "update" | "upsert" | "delete";
   payload?: any;
   query?: {
      eq?: Record<string, any>;
      maybeSingle?: boolean;
      options?: any;
   };
}

export interface QueueEntry {
   id: string;
   action: string;
   request: SerializedRequest;
   isBlocking: boolean;
   retries: number;
   created_at: number;
}

class NetworkGate {
   private queue: QueueEntry[] = [];
   private activePromiseCallbacks = new Map<
      string,
      { resolve: (val: any) => void; reject: (err: any) => void }
   >();
   private isProcessing = false;

   constructor() {
      this.loadQueue();
      // Start processing any persisted tasks on boot/mount after a brief delay
      setTimeout(() => this.processQueue(), 500);
   }

   private loadQueue() {
      try {
         const cached = safeLocalStorage.getItem("wordle-network-queue");
         if (cached) {
            this.queue = JSON.parse(cached);
            // Reset retry counts for a fresh session attempt
            this.queue.forEach((item) => {
               item.retries = 0;
            });
         }
      } catch (e) {
         console.error("Failed to load network queue from cache:", e);
         this.queue = [];
      }
   }

   private saveQueue() {
      try {
         safeLocalStorage.setItem(
            "wordle-network-queue",
            JSON.stringify(this.queue),
         );
      } catch (e) {
         console.error("Failed to save network queue to cache:", e);
      }
   }

   public async enqueue(
      action: string,
      request: SerializedRequest,
      isBlocking = false,
   ): Promise<any> {
      const id = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const entry: QueueEntry = {
         id,
         action,
         request,
         isBlocking,
         retries: 0,
         created_at: Date.now(),
      };

      const promise = new Promise<any>((resolve, reject) => {
         this.activePromiseCallbacks.set(id, { resolve, reject });
      });

      this.queue.push(entry);
      this.saveQueue();

      // Trigger processing loop asynchronously
      this.processQueue();

      return promise;
   }

   private async processQueue() {
      if (this.isProcessing || this.queue.length === 0) return;
      this.isProcessing = true;

      try {
         while (this.queue.length > 0) {
            const entry = this.queue[0];
            let success = false;
            let result: any = null;
            let lastError: any = null;

            while (entry.retries < 3 && !success) {
               try {
                  result = await this.executeRequest(entry.request);
                  success = true;
               } catch (err: any) {
                  lastError = err;
                  entry.retries++;
                  this.saveQueue();
                  if (entry.retries < 3) {
                     // Exponential backoff: wait 1s, then 2s
                     await new Promise((res) =>
                        setTimeout(res, 1000 * entry.retries),
                     );
                  }
               }
            }

            // Remove from queue
            this.queue.shift();
            this.saveQueue();

            const callbacks = this.activePromiseCallbacks.get(entry.id);
            if (callbacks) {
               if (success) {
                  callbacks.resolve(result);
               } else {
                  callbacks.reject(
                     lastError ||
                        new Error(
                           `Request failed after 3 retries: ${entry.action}`,
                        ),
                  );
               }
               this.activePromiseCallbacks.delete(entry.id);
            }
         }
      } finally {
         this.isProcessing = false;
      }
   }

   private async executeRequest(req: SerializedRequest): Promise<any> {
      if (req.type !== "supabase") {
         throw new Error(`Unsupported request type: ${req.type}`);
      }

      const queryBuilder = supabase.from(req.table);

      switch (req.operation) {
         case "select": {
            let q = queryBuilder.select(req.payload?.select || "*");
            if (req.query?.eq) {
               for (const [k, v] of Object.entries(req.query.eq)) {
                  q = q.eq(k, v);
               }
            }
            if (req.query?.maybeSingle) {
               const { data, error } = await q.maybeSingle();
               if (error) throw error;
               return data;
            }
            const { data, error } = await q;
            if (error) throw error;
            return data;
         }
         case "upsert": {
            const { data, error } = await queryBuilder.upsert(
               req.payload,
               req.query?.options || {},
            );
            if (error) throw error;
            return data;
         }
         case "insert": {
            const { data, error } = await queryBuilder.insert(req.payload);
            if (error) throw error;
            return data;
         }
         case "update": {
            let q = queryBuilder.update(req.payload);
            if (req.query?.eq) {
               for (const [k, v] of Object.entries(req.query.eq)) {
                  q = q.eq(k, v);
               }
            }
            const { data, error } = await q;
            if (error) throw error;
            return data;
         }
         case "delete": {
            let q = queryBuilder.delete();
            if (req.query?.eq) {
               for (const [k, v] of Object.entries(req.query.eq)) {
                  q = q.eq(k, v);
               }
            }
            const { data, error } = await q;
            if (error) throw error;
            return data;
         }
         default:
            throw new Error(`Unsupported Supabase operation: ${req.operation}`);
      }
   }
}

export const networkGate = new NetworkGate();
