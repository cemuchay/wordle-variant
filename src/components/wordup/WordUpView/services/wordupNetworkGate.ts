// src/components/wordup/WordUpView/services/wordupNetworkGate.ts

type RequestType = 'get' | 'post' | 'put' | 'delete' | 'rpc';

interface NetworkTask {
   id: string;
   type: RequestType;
   description: string;
   blocking: boolean;
   execute: () => Promise<any>;
   resolve: (value: any) => void;
   reject: (reason: any) => void;
   status: 'pending' | 'processing' | 'resolved' | 'rejected';
}

class WordUpNetworkGate {
   private queue: NetworkTask[] = [];
   private activeTaskCount = 0;

   public enqueue(
      type: RequestType,
      description: string,
      execute: () => Promise<any>,
      blocking = false
   ): Promise<any> {
      return new Promise((resolve, reject) => {
         const task: NetworkTask = {
            id: crypto.randomUUID(),
            type,
            description,
            blocking,
            execute,
            resolve,
            reject,
            status: 'pending'
         };

         this.queue.push(task);
         this.processNext();
      });
   }

   private async processNext() {
      // If a blocking task is running, wait
      const runningBlocking = this.queue.some(t => t.status === 'processing' && t.blocking);
      if (runningBlocking) return;

      // Find next task to process
      const nextTask = this.queue.find(t => t.status === 'pending');
      if (!nextTask) return;

      // If the next task is blocking and there are active tasks running, wait until they finish
      if (nextTask.blocking && this.activeTaskCount > 0) return;

      nextTask.status = 'processing';
      this.activeTaskCount++;

      try {
         console.log(`[WordUp NetworkGate] Processing task: ${nextTask.description} (${nextTask.type})`);
         const result = await nextTask.execute();
         nextTask.status = 'resolved';
         nextTask.resolve(result);
      } catch (error) {
         console.warn(`[WordUp NetworkGate] Task failed: ${nextTask.description}`, error);
         nextTask.status = 'rejected';
         nextTask.reject(error);
      } finally {
         this.activeTaskCount--;
         // Remove resolved/rejected tasks from queue
         this.queue = this.queue.filter(t => t.id !== nextTask.id);
         this.processNext();
      }
   }
}

export const wordupNetworkGate = new WordUpNetworkGate();
