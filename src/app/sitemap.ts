import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://callapp.in'
  const now = new Date()

  // Public pages (indexable)
  const publicPages = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily' as const, priority: 1.0 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${base}/legal/community`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${base}/legal/cookies`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${base}/legal/deletion`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${base}/legal/contact`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
  ]

  return publicPages
}
