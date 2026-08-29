import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-mode route/build indicator (bottom-left "N" badge) has no
  // production relevance and was intercepting clicks on real interactive
  // elements underneath it in the e2e suite (which runs against `next dev`
  // per playwright.config.ts) — e.g. the sidebar's sign-out button.
  devIndicators: false,
};

export default nextConfig;
