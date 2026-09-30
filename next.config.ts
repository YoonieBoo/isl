import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Real course datasets (e.g. a semester's full Learning Evidence log,
    // or a multi-file batch upload) regularly exceed Next's 1MB default for
    // Server Action request bodies.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
