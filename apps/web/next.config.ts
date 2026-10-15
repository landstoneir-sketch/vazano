import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  poweredByHeader: false,
  typedRoutes: true,
};
export default nextConfig;
