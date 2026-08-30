import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 기존 Python/분석 파일 제외
  eslint: {
    dirs: ['app', 'components', 'lib', 'types'],
  },
};

export default nextConfig;
