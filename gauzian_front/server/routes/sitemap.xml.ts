export default defineEventHandler((event) => {
  const baseUrl = 'https://gauzian.pupin.fr';
  const currentDate = new Date().toISOString().split('T')[0];
  
  const urls = [
    {
      loc: `${baseUrl}/`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '1.0'
    },
    {
      loc: `${baseUrl}/drive`,
      lastmod: currentDate,
      changefreq: 'daily',
      priority: '0.8'
    },
    {
      loc: `${baseUrl}/login`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.6'
    },
    {
      loc: `${baseUrl}/info`,
      lastmod: currentDate,
      changefreq: 'monthly',
      priority: '0.5'
    }
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  setHeader(event, 'Content-Type', 'application/xml');
  return sitemap;
});
