import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Quicklink Activity', short_name: 'Quicklink', description: 'Private business activity for Quicklink clients.', start_url: '/', display: 'standalone', background_color: '#f6f6f3', theme_color: '#1d1d1b', icons: [{ src: '/icon.png', sizes: '1024x1024', type: 'image/png' }] }
}
