/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GITHUB_OWNER: process.env.GITHUB_OWNER || '',
    NEXT_PUBLIC_GITHUB_REPO:  process.env.GITHUB_REPO  || '',
    NEXT_PUBLIC_GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
  },
  images: {
    domains: ['raw.githubusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
