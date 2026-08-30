export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://webcam-obs.vercel.app/sitemap.xml',
  }
}
