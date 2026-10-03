import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.ts.net",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
