import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode double-mounts components in dev, which causes the socket to
  // connect twice and the server to match the tab with itself (self-match bug).
  reactStrictMode: false,
};

export default nextConfig;
