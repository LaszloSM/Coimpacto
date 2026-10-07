import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web = plataforma de administración y monitoreo de la Fundación. La reunión offline vive en
  // la app Android (movil/). Los paquetes internos se publican como TypeScript sin compilar.
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@credimpacto/reglas", "@credimpacto/tokens"],
};

export default nextConfig;
