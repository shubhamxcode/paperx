import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS project. A stray pnpm-lock.yaml in the home
  // folder made Turbopack infer the home dir as root and fail to resolve modules
  // like next-auth / tailwindcss. process.cwd() is the project dir when running
  // `npm run dev` / `dev:https` from here, forcing resolution against ./node_modules.
  turbopack: {
    root: process.cwd(),
  },
  // reactCompiler disabled: its Babel plugin runs through Turbopack's webpack-loader
  // path, which panics when the project path contains a space ("PaperX project").
  // Re-enable once the folder is renamed to a space-free path.
  // reactCompiler: true,
};

export default nextConfig;
