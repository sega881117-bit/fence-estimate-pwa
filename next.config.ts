import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  // This PWA is also published on GitHub Pages, which serves static files.
  output: 'export',
  // GitHub Pages hosts project sites below the repository name.
  assetPrefix: isGitHubPages ? '/fence-estimate-pwa' : undefined,
};

export default nextConfig;
