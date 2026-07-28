import type { NextConfig } from 'next';

/**
 * Content Security Policy.
 *
 * The public invitation renderer only needs self-hosted assets plus whatever
 * image host the storage adapter is configured with, so we keep the policy
 * tight and widen it explicitly through env instead of using wildcards.
 */
const imageHosts = (process.env.NEXT_PUBLIC_MEDIA_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
    })),
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    // Keeps the public invitation bundle small: only the icons actually used
    // are pulled in from the icon package.
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Guest-facing invitation pages must never be indexed by default;
        // section 33 of the product spec. The public page can opt in.
        source: '/p/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
