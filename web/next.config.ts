import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Web = plataforma de administración y monitoreo de la Fundación. La reunión offline vive en
  // la app Android (movil/). Los paquetes internos se publican como TypeScript sin compilar.
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@credimpacto/reglas", "@credimpacto/tokens"],
  // /api va al backend Django en el mismo origen: sin CORS y con la cookie de sesión del dominio.
  async rewrites() {
    return [{ source: "/api/:ruta*", destination: `${process.env.CREDIMPACTO_API ?? "http://localhost:8000"}/api/:ruta*` }];
  },
};

export default nextConfig;
