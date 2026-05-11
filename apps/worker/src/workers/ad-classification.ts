import { Job } from 'bullmq';

interface AdClassificationJob {
  adId: string;
  description: string | null;
}

export async function adClassificationWorker(job: Job<AdClassificationJob>) {
  const { adId, description } = job.data;
  console.log(
    `[ad-classification] stub: would classify ad ${adId} (description length: ${description?.length ?? 0})`,
  );
}
