# MinimalistPicks

A Zen-minimalist, zero-build, single-file-config static review site for GitHub Pages.

- **Edit one file** (`articles.js`) to publish a new post
- **Edit another** (`config.js`) to rebrand the entire site
- **No frameworks**, no build step, no package manager
- AdSense / Analytics auto-inject when IDs are provided
- GDPR/CCPA cookie bar, FTC disclosure, Privacy/Terms/About/Contact pre-built
- JSON-LD Review schema + OpenGraph + Twitter Card on every article
- Native Web Share + Twitter / Facebook / Pinterest / Reddit / WhatsApp / Email
- Speculation Rules for instant prerender on hover

## Quick start

1. Create a public GitHub repo
2. Drop every file in this folder into the repo (keep `.nojekyll`)
3. Settings → Pages → Branch `main` / root → Save
4. Wait ~1 minute, your site is live

Full step-by-step guide (in Chinese): see **[部署说明.md](部署说明.md)**.

## File map

| File | Purpose |
| --- | --- |
| `config.js` | All site-wide settings — name, email, AdSense, etc. |
| `articles.js` | All article data — add one entry to publish |
| `index.html` | Homepage (card grid) |
| `article.html` | Single template — uses `?slug=` |
| `about.html` / `contact.html` / `privacy.html` / `terms.html` | Compliance pages auto-filled from config |
| `404.html` | Not-found page |
| `assets/style.css` | Vanilla CSS with custom properties (light + dark) |
| `assets/main.js` | Hydrator: routing, sort, share, cookies, JSON-LD |
| `sitemap.xml` / `robots.txt` | SEO |
| `tools/update-sitemap.html` | One-click sitemap regenerator |
| `CNAME` | Custom domain (delete if not using one) |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Publishing a new post

Open `articles.js`, copy any existing entry, change the fields, commit. That's it.

```js
{
  title: "...",
  date: "2026-05-15",          // YYYY-MM-DD; <3 days old gets "New" + pinned
  score: 4.7,                  // 0-5; affects ranking
  slug: "url-friendly-slug",   // becomes /article.html?slug=url-friendly-slug
  coverImage: "https://...",
  intro: "Pain-point opener.",
  features: ["...", "..."],
  amazonKeyword: "...",
  metaDesc: "150-160 chars",
  tags: "comma, separated"     // used only for related-post matching
}
```

## License

MIT. Honestly do whatever you want with it.
