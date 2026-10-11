import type { NextConfig } from "next";

/**
 * پیکربندی Next.js
 * پکیج‌های نیتیو و ماینکرفت باید خارج از باندل سمت سرور اجرا بشن
 */
const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "mineflayer",
    "mineflayer-pathfinder",
    "mineflayer-collectblock",
    "minecraft-protocol",
    "minecraft-data",
    "prismarine-auth",
    "prismarine-chunk",
    "prismarine-entity",
    "prismarine-item",
    "prismarine-nbt",
    "prismarine-physics",
    "prismarine-recipe",
    "prismarine-registry",
    "prismarine-windows",
    "prismarine-world"
  ],
  reactStrictMode: true
};

export default nextConfig;
