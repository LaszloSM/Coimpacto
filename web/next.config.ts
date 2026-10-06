import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La superficie de reunión es 100 % de cliente y offline (PWA con Serwist en S5).
  // Serwist necesita Webpack en producción: el script de build ya usa `--webpack`.
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
