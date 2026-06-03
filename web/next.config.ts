import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Permitir fotos de perfil de ValidaCel
    remotePatterns: [
      { protocol: "https", hostname: "*.com.blog" },
      { protocol: "https", hostname: "*.validacel.com" },
    ],
  },
};

export default nextConfig;
