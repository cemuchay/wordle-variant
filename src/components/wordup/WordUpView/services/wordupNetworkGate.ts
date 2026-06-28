/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/wordup/WordUpView/services/wordupNetworkGate.ts
import { supabase } from "../../../../lib/supabaseClient";
import { safeLocalStorage } from "../../../../utils/storage";

export type RequestType = "get" | "post" | "put" | "delete" | "rpc";

export interface SerializableTaskConfig {
   table?: string;
   action: "insert" | "update" | "upsert" | "delete" | "rpc";
   payload?: any;
   filter?: any;
   rpcMethod?: string;
}

export interface NetworkTask {
   id: string;
   type: RequestType;
   description: string;
   blocking: boolean;
   execute?: () => Promise<any>;
   config?: SerializableTaskConfig;
   resolve?: (value: any) => void;
   reject?: (reason: any) => void;
   status: "pending" | "processing" | "resolved" | "rejected";
   retryCount: number;
}

const STORAGE_KEY = "wordup_persistent_network_queue";

class WordUpNetworkGate {
   private queue: NetworkTask[] = [];
   private activeTaskCount = 0;
   private isProcessing = false;

   constructor() {
      // Defer recovery slightly to allow other systems to load
      setTimeout(() => {
         this.loadQueueFromStorage();
      }, 500);
   }

   private loadQueueFromStorage() {
      try {
         const stored = safeLocalStorage.getItem(STORAGE_KEY);
         if (stored) {
            const parsed = JSON.parse(stored) as any[];
            parsed.forEach((item) => {
               const task: NetworkTask = {
                  id: item.id,
                  type: item.type,
                  description: item.description,
                  blocking: item.blocking ?? false,
                  config: item.config,
                  status: "pending",
                  retryCount: item.retryCount ?? 0,
               };
               this.queue.push(task);
            });
            this.processNext();
         }
      } catch (e) {
         console.error(
            "[WordUp NetworkGate] Failed to load queue from storage:",
            e,
         );
      }
   }

   private saveQueueToStorage() {
      try {
         const serializableTasks = this.queue
            .filter(
               (t) =>
                  t.config &&
                  (t.status === "pending" || t.status === "processing"),
            )
            .map((t) => ({
               id: t.id,
               type: t.type,
               description: t.description,
               blocking: t.blocking,
               config: t.config,
               retryCount: t.retryCount,
            }));

         if (serializableTasks.length > 0) {
            safeLocalStorage.setItem(
               STORAGE_KEY,
               JSON.stringify(serializableTasks),
            );
         } else {
            safeLocalStorage.removeItem(STORAGE_KEY);
         }
      } catch (e) {
         console.error(
            "[WordUp NetworkGate] Failed to save queue to storage:",
            e,
         );
      }
   }

   public enqueue(
      type: RequestType,
      description: string,
      executeOrConfig: (() => Promise<any>) | SerializableTaskConfig,
      blocking = false,
   ): Promise<any> {
      return new Promise((resolve, reject) => {
         const isConfig = typeof executeOrConfig !== "function";

         const task: NetworkTask = {
            id: crypto.randomUUID(),
            type,
            description,
            blocking,
            execute: isConfig
               ? undefined
               : (executeOrConfig as () => Promise<any>),
            config: isConfig
               ? (executeOrConfig as SerializableTaskConfig)
               : undefined,
            resolve,
            reject,
            status: "pending",
            retryCount: 0,
         };

         this.queue.push(task);

         if (isConfig && type !== "get") {
            this.saveQueueToStorage();
         }

         this.processNext();
      });
   }

   private async executeTask(task: NetworkTask): Promise<any> {
      if (task.execute) {
         return await task.execute();
      }

      if (!task.config) {
         throw new Error(
            "Task lacks both execute function and serializable config",
         );
      }

      const { action, table, payload, filter, rpcMethod } = task.config;

      switch (action) {
         case "insert": {
            const { data, error } = await supabase
               .from(table!)
               .insert(payload)
               .select();
            if (error) throw error;
            return data;
         }
         case "update": {
            const { data, error } = await supabase
               .from(table!)
               .update(payload)
               .match(filter || {})
               .select();
            if (error) throw error;
            return data;
         }
         case "upsert": {
            const { data, error } = await supabase
               .from(table!)
               .upsert(payload)
               .select();
            if (error) throw error;
            return data;
         }
         case "delete": {
            const { data, error } = await supabase
               .from(table!)
               .delete()
               .match(filter || {})
               .select();
            if (error) throw error;
            return data;
         }
         case "rpc": {
            const { data, error } = await supabase.rpc(rpcMethod!, payload);
            if (error) throw error;
            return data;
         }
         default:
            throw new Error(`Unsupported network action: ${action}`);
      }
   }

   private async processNext() {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
         while (true) {
            const runningBlocking = this.queue.some(
               (t) => t.status === "processing" && t.blocking,
            );
            if (runningBlocking) break;

            const nextTask = this.queue.find((t) => t.status === "pending");
            if (!nextTask) break;

            if (nextTask.blocking && this.activeTaskCount > 0) break;

            nextTask.status = "processing";
            this.activeTaskCount++;

            this.runTask(nextTask);
         }
      } finally {
         this.isProcessing = false;
      }
   }

   private async runTask(task: NetworkTask) {
      try {
         const result = await this.executeTask(task);
         task.status = "resolved";
         if (task.resolve) task.resolve(result);
      } catch (error: any) {
         console.warn(
            `[WordUp NetworkGate] Task failed: ${task.description}`,
            error,
         );

         const isTransient =
            !error ||
            error.status === undefined ||
            error.status === 0 ||
            error.status >= 500 ||
            error.message?.includes("Failed to fetch") ||
            error.message?.includes("Network Error");

         if (isTransient && task.config && task.retryCount < 5) {
            task.retryCount++;
            task.status = "pending";

            this.saveQueueToStorage();

            setTimeout(() => {
               this.processNext();
            }, 5000);
         } else {
            task.status = "rejected";
            if (task.reject) task.reject(error);
         }
      } finally {
         this.activeTaskCount--;
         if (task.status === "resolved" || task.status === "rejected") {
            this.queue = this.queue.filter((t) => t.id !== task.id);
            this.saveQueueToStorage();
         }
         this.processNext();
      }
   }
}

export const wordupNetworkGate = new WordUpNetworkGate();
