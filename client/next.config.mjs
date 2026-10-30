/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
  return {
    fallback: [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL}/api/:path*`,
      },
      {
        source: '/:shortCode',
        destination: `${process.env.BACKEND_URL}/:shortCode`,
      },
    ],
  };
},
};

export default nextConfig;