import { Queue } from 'bullmq';
import { connection } from '../redis.js';

export const QUEUE_NAMES = {
  SCRAPING: 'scraping',
} as const;

export const scrapingQueue = new Queue(QUEUE_NAMES.SCRAPING, {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});

export const queues = {
  [QUEUE_NAMES.SCRAPING]: scrapingQueue,
};

export async function getQueueStats(queueName: string) {
  const queue = queues[queueName as keyof typeof queues];
  if (!queue) {
    throw new Error(`Queue ${queueName} not found`);
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { name: queueName, waiting, active, completed, failed, delayed };
}

export async function getAllQueuesStats() {
  return Promise.all(Object.keys(queues).map((q) => getQueueStats(q)));
}
