/** @type {import('next').NextConfig} */
const nextConfig = {
  skipProxyUrlNormalize: true,
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
