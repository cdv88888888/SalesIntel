/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin', '@google-cloud/bigquery'],
  skipProxyUrlNormalize: true,
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
