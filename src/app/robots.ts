import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/wallet', '/coins', '/ai', '/notifications'],
    },
    sitemap: 'https://callapp.in/sitemap.xml',
    host: 'https://callapp.in',
  }
}
