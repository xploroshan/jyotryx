/**
 * Cloudflare R2 upload helper — public image hosting for the Instagram
 * Graph API (which fetches image_url server-side, so URLs must be public).
 *
 * Node 20+ ESM. Mirrors the conventions of
 * apps/api/src/storage/storage.service.ts (S3Client against the R2 endpoint,
 * region 'auto', bucket default 'myastro360-uploads').
 *
 * @aws-sdk/client-s3 is imported lazily inside upload() so this module can
 * always be loaded (and isConfigured checked) even when the SDK is absent.
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ isConfigured: boolean, upload: (args: { key: string, buffer: Buffer|Uint8Array, contentType?: string }) => Promise<string> }}
 */
export function makeStorage(env = process.env) {
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = env.R2_BUCKET_NAME || 'myastro360-uploads';
  // Graph API containers fetch the URL later, possibly minutes after upload,
  // so a stable public URL is required — presigned URLs won't do.
  const publicBase = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '');

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && publicBase);

  return {
    isConfigured,

    /**
     * Upload a buffer to R2 and return its public URL.
     * @param {object} args
     * @param {string} args.key - object key (path within the bucket).
     * @param {Buffer|Uint8Array} args.buffer - file contents.
     * @param {string} [args.contentType]
     * @returns {Promise<string>} public URL of the uploaded object.
     */
    async upload({ key, buffer, contentType = 'image/png' }) {
      if (!isConfigured) {
        throw new Error(
          'R2 storage not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
          'R2_SECRET_ACCESS_KEY and R2_PUBLIC_URL',
        );
      }
      if (!key) throw new Error('upload: key is required');
      if (!buffer) throw new Error('upload: buffer is required');

      let S3Client;
      let PutObjectCommand;
      try {
        ({ S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3'));
      } catch (err) {
        throw new Error(
          `@aws-sdk/client-s3 is not installed (${err?.message || err}); ` +
          'install it to enable R2 uploads',
        );
      }

      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });

      try {
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }));
      } finally {
        s3.destroy();
      }

      return `${publicBase}/${key.replace(/^\/+/, '')}`;
    },
  };
}
