import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/chat', '/boost/success'],
    },
    sitemap: 'https://randoo.fun/sitemap.xml',
  }
}
