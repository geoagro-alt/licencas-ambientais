import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas. A CSP aqui é propositalmente restrita a diretivas que
// não afetam scripts/estilos do Next (clickjacking, <base>, destino de formulários, plugins).
const CABECALHOS_SEGURANCA = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: CABECALHOS_SEGURANCA }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    // "Empresas" passou a se chamar "Clientes"
    return [
      { source: "/empresas", destination: "/clientes", permanent: true },
      { source: "/empresas/:id", destination: "/clientes/:id", permanent: true },
    ];
  },
};

export default nextConfig;
