import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Allow images from CDN
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.motionshapes.com',
        pathname: '/**',
      },
    ],
  },
  
  // Required for FFmpeg.wasm SharedArrayBuffer support
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
