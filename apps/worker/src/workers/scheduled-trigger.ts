import { Job } from 'bullmq';
export async function scheduledTriggerWorker(_job: Job) {
  console.log(`[scheduled-trigger] fired at ${new Date().toISOString()}`);
}
