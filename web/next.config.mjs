/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Imagem de produção enxuta (web/Dockerfile copia .next/standalone).
  output: "standalone",
};

export default nextConfig;
