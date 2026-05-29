interface CloudflareEnv {
  DB: D1Database;
  PROJECT_FILES?: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET: R2Bucket;
  WORKER_SELF_REFERENCE: Fetcher;
  NEXT_ASSETS: Fetcher;
  IMAGES?: unknown;
  NEXT_PUBLIC_APP_NAME?: string;
}
