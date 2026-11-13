import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
