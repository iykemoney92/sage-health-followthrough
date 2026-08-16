import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apple fetches this to verify Universal Links and rejects it unless the
        // content type is JSON. The file has no extension (Apple requires that
        // exact path), so Next would otherwise serve it as octet-stream.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
