import type { NextConfig } from 'next';

const config: NextConfig = {
  turbopack: { root: __dirname },
  experimental: { inlineCss: true },
};

export default config;
