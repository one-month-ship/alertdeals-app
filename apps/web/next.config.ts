import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@alertdeals/db', '@alertdeals/shared'],
  cacheComponents: true,
};

export default config;
