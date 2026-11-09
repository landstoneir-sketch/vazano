import type { NextConfig } from 'next';

const internalApiBaseUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '');

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  poweredByHeader: false,
  typedRoutes: true,
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${internalApiBaseUrl}/:path*`,
      },
    ];
  },
};
export default nextConfig;
