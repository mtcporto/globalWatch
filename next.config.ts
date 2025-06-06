import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.fbi.gov',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ws-public.interpol.int',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
