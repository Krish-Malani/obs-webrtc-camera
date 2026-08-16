import os from 'os';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i.family === 'IPv4' && !i.internal)
      .map((i) => i.address)
  }
};

export default nextConfig;
