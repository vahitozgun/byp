import withPWA from "next-pwa";

const pwa = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: "CacheFirst",
      options: { cacheName: "google-fonts", expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: "CacheFirst",
      options: { cacheName: "next-static", expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    {
      urlPattern: /\/_next\/image\?.*/i,
      handler: "StaleWhileRevalidate",
      options: { cacheName: "next-image", expiration: { maxEntries: 50 } },
    },
    {
      urlPattern: /\/.*\.(png|jpg|jpeg|svg|ico|webp)$/i,
      handler: "CacheFirst",
      options: { cacheName: "images", expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/dashboard"),
      handler: "NetworkFirst",
      options: { cacheName: "dashboard-pages", networkTimeoutSeconds: 5 },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/auth"),
      handler: "NetworkFirst",
      options: { cacheName: "auth-pages", networkTimeoutSeconds: 5 },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default pwa(nextConfig);
