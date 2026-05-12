/* ============================================================
   MinimalistPicks · Hydrator (main.js)
   ------------------------------------------------------------
   Pure vanilla JS — no build step, no framework, no CDN deps.

   Architecture
     · ARTICLES is a flat list of slugs (strings).
     · Each slug → /posts/<slug>.md, which holds:
         · YAML-ish frontmatter (title, date, score, cover, intro, tags, …)
         · Markdown body (rendered by a small built-in parser)
     · Homepage fetches all .md files in parallel for fast metadata pass.
     · Article page fetches one .md and renders body + injects shop/ads.
   ============================================================ */

(function () {
  'use strict';

  /* ----------------- Globals & helpers ----------------- */
  const C  = window.SITE_CONFIG || {};
  const SLUGS = (window.ARTICLES || []).slice();
  const qs   = (s, r = document) => r.querySelector(s);
  const qsa  = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el   = (tag, attrs = {}, html) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class')      e.className = attrs[k];
      else if (k === 'text')  e.textContent = attrs[k];
      else                    e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fmtDate = (iso) => {
    const d = new Date(String(iso || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const daysAgo = (iso) => {
    const d = new Date(String(iso || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return 999;
    return (Date.now() - d.getTime()) / 86400000;
  };

  /* -------------- Base path detection -------------- */
  const BASE = (function () {
    const seg = location.pathname.split('/').filter(Boolean);
    if (location.hostname.endsWith('github.io') && seg.length > 0 && !seg[0].includes('.')) {
      return '/' + seg[0] + '/';
    }
    return '/';
  })();
  const path = (p) => BASE + String(p).replace(/^\//, '');
  const urlFor = (slug) => path('article.html?slug=' + encodeURIComponent(slug));
  const absUrl = (p) => {
    if (/^https?:/.test(p)) return p;
    const base = (C.siteUrl || (location.origin + BASE.slice(0, -1))).replace(/\/$/, '');
    return base + '/' + String(p).replace(/^\//, '');
  };
  // Resolve a markdown-relative image URL (`images/foo.jpg`) to a path that
  // works from any HTML location (article.html lives at root, not in /posts/).
  const resolvePostUrl = (url) => {
    if (/^(https?:|data:|\/\/)/.test(url)) return url;
    if (url.startsWith('/')) return url;
    return path('posts/' + url.replace(/^\.\//, ''));
  };

  /* ----------------- Markdown parser -----------------
     Supports: # headings, **bold**, *italic*, `code`, code fences,
     [links](url), ![images](url), - lists, 1. lists, > blockquotes,
     --- hr, paragraphs, auto-linked bare URLs.
     Escapes HTML in source first; safe for untrusted input. */
  function parseMarkdown(text) {
    if (!text) return '';
    text = text.replace(/\r\n/g, '\n');

    // Protect fenced code blocks
    const fences = [];
    text = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      fences.push({ lang, code });
      return `FENCE${fences.length - 1}`;
    });

    // Escape ALL HTML in source (after fence extraction)
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const inline = (s) => {
      // Protect inline code
      const inlineCode = [];
      s = s.replace(/`([^`]+)`/g, (_, c) => {
        inlineCode.push(c);
        return `IC${inlineCode.length - 1}`;
      });
      // Images
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) =>
        `<img src="${resolvePostUrl(src)}" alt="${alt}" loading="lazy" decoding="async">`);
      // Links
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) => {
        const ext = /^https?:/.test(url);
        return `<a href="${url}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
      });
      // Bold then italic (greedy-safe order)
      s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
      s = s.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');
      // Bare URL auto-link
      s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, sp, u) =>
        `${sp}<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
      // Restore inline code
      s = s.replace(/IC(\d+)/g, (_, i) => `<code>${inlineCode[+i]}</code>`);
      return s;
    };

    const lines = text.split('\n');
    const out = [];
    let para = [];
    let listMode = null;  // 'ul' | 'ol'
    let inQuote = false;

    const flushPara = () => {
      if (para.length) {
        out.push(`<p>${inline(para.join(' '))}</p>`);
        para = [];
      }
    };
    const flushList = () => { if (listMode) { out.push(`</${listMode}>`); listMode = null; } };
    const flushQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) { flushAll(); continue; }

      // Fence placeholder
      let m = line.match(/^FENCE(\d+)$/);
      if (m) {
        flushAll();
        const { lang, code } = fences[+m[1]];
        out.push(`<pre${lang ? ` data-lang="${lang}"` : ''}><code>${esc(code)}</code></pre>`);
        continue;
      }

      // Headings
      if (m = line.match(/^(#{1,6})\s+(.+)$/)) {
        flushAll();
        const lv = m[1].length;
        out.push(`<h${lv}>${inline(m[2])}</h${lv}>`);
        continue;
      }
      // HR
      if (/^(---|\*\*\*|___)\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }
      // Standalone image → <figure>
      if (m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/)) {
        flushAll();
        const src = resolvePostUrl(m[2]);
        out.push(`<figure><img src="${src}" alt="${m[1]}" loading="lazy" decoding="async">${m[1] ? `<figcaption>${m[1]}</figcaption>` : ''}</figure>`);
        continue;
      }
      // Blockquote
      if (m = line.match(/^>\s?(.*)$/)) {
        flushPara(); flushList();
        if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
        out.push(`<p>${inline(m[1])}</p>`);
        continue;
      }
      // Unordered list
      if (m = line.match(/^[-*]\s+(.+)$/)) {
        flushPara(); flushQuote();
        if (listMode !== 'ul') { flushList(); out.push('<ul>'); listMode = 'ul'; }
        out.push(`<li>${inline(m[1])}</li>`);
        continue;
      }
      // Ordered list
      if (m = line.match(/^\d+\.\s+(.+)$/)) {
        flushPara(); flushQuote();
        if (listMode !== 'ol') { flushList(); out.push('<ol>'); listMode = 'ol'; }
        out.push(`<li>${inline(m[1])}</li>`);
        continue;
      }
      // Paragraph line
      flushList(); flushQuote();
      para.push(line);
    }
    flushAll();
    return out.join('\n');
  }

  /* ----------------- Frontmatter parsing ----------------- */
  function parseFrontmatter(text) {
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: text || '' };
    const meta = {};
    m[1].split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx < 1) return;
      let key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      // strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      meta[key] = val;
    });
    if (meta.score != null) meta.score = parseFloat(meta.score) || 0;
    return { meta, body: m[2] || '' };
  }

  /* ----------------- Fetch + cache .md files ----------------- */
  const _mdCache = new Map();
  async function loadArticle(slug) {
    if (_mdCache.has(slug)) return _mdCache.get(slug);
    const p = fetch(path('posts/' + slug + '.md'))
      .then(r => r.ok ? r.text() : Promise.reject(new Error('not found: ' + slug)))
      .then(t => {
        const fm = parseFrontmatter(t);
        fm.meta.slug = slug;
        return fm;
      });
    _mdCache.set(slug, p);
    return p;
  }
  async function loadAllArticles() {
    const items = await Promise.all(SLUGS.map(s => loadArticle(s).catch(() => null)));
    return items.filter(Boolean);
  }

  /* ----------------- Sorting -----------------
     1) Sticky if <stickyDays old (newest first within group)
     2) Score desc
     3) Date desc */
  function sortArticles(items) {
    const stickyDays = C.stickyDays || 3;
    return items.slice().sort((x, y) => {
      const xs = daysAgo(x.meta.date) < stickyDays;
      const ys = daysAgo(y.meta.date) < stickyDays;
      if (xs !== ys) return xs ? -1 : 1;
      if (xs && ys)  return daysAgo(x.meta.date) - daysAgo(y.meta.date);
      const sx = +x.meta.score || 0, sy = +y.meta.score || 0;
      if (sy !== sx) return sy - sx;
      return new Date(y.meta.date) - new Date(x.meta.date);
    });
  }

  /* ----------------- Stars ----------------- */
  function starsHTML(score) {
    const s = Math.max(0, Math.min(5, Number(score) || 0));
    const full = Math.floor(s);
    const half = (s - full) >= 0.25 && (s - full) < 0.75;
    const fullN = half ? full : Math.round(s);
    const out = [];
    for (let i = 0; i < 5; i++) {
      if (i < fullN) out.push('★');
      else if (i === fullN && half) out.push('⯨');
      else out.push('☆');
    }
    return `<span class="stars" aria-label="Rated ${s.toFixed(1)} out of 5">${out.join('')}<span class="num">${s.toFixed(1)}</span></span>`;
  }

  /* ----------------- Card HTML ----------------- */
  function cardHTML(item, opts = {}) {
    const a = item.meta;
    const isNew = daysAgo(a.date) < (C.stickyDays || 3);
    const cover = a.cover || C.defaultCover;
    return `
      <a class="card" href="${urlFor(a.slug)}" aria-label="${esc(a.title)}">
        <div class="card__media">
          <img loading="lazy" decoding="async" src="${esc(cover)}" alt="${esc(a.title)}">
        </div>
        <div class="card__meta">
          ${isNew ? '<span class="badge-new">New</span>' : ''}
          <span>${fmtDate(a.date)}</span>
          ${opts.hideScore ? '' : starsHTML(a.score)}
        </div>
        <h3 class="card__title">${esc(a.title)}</h3>
        ${opts.hideExcerpt ? '' : `<p class="card__excerpt">${esc(a.intro || '')}</p>`}
      </a>`;
  }

  /* ----------------- Header / Footer hydration ----------------- */
  function injectHeader() {
    const host = qs('[data-site-header]');
    if (!host) return;
    host.innerHTML = `
      <header class="site-header">
        <div class="container site-header__inner">
          <a class="site-logo" href="${path('')}">${esc(C.logoText || C.siteName || 'Site')}</a>
          <nav class="site-nav" aria-label="Primary">
            <a href="${path('')}">Home</a>
          </nav>
        </div>
      </header>`;
  }
  function injectFooter() {
    const host = qs('[data-site-footer]');
    if (!host) return;
    const donate = C.donateLink
      ? `<a class="site-footer__donate" href="${esc(C.donateLink)}" rel="nofollow noopener" target="_blank">☕ Support our work</a>`
      : '';
    host.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="site-footer__top">
            <div>
              <div style="font-weight:500;color:var(--c-ink);margin-bottom:6px;">${esc(C.siteName)}</div>
              <div>${esc(C.tagline || '')}</div>
              ${donate}
            </div>
            <nav>
              <a href="${path('about.html')}">About</a>
              <a href="${path('contact.html')}">Contact</a>
              <a href="${path('privacy.html')}">Privacy</a>
              <a href="${path('terms.html')}">Terms</a>
            </nav>
          </div>
          <div class="site-footer__ftc">${esc(C.ftcDisclosure || '')}
            <div style="margin-top:10px;">© ${new Date().getFullYear()} ${esc(C.siteName)}. All rights reserved.</div>
          </div>
        </div>
      </footer>`;
  }

  /* ----------------- AdSense / Analytics ----------------- */
  function injectAdsense() {
    if (!C.adsenseId || !/^ca-pub-/.test(C.adsenseId)) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(C.adsenseId)}`;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);

    qsa('.ad-slot[data-ad]').forEach(slot => {
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.style.width = '100%';
      ins.style.minHeight = '90px';
      ins.setAttribute('data-ad-client', C.adsenseId);
      ins.setAttribute('data-ad-slot', slot.dataset.ad || '0000000000');
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      slot.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) {}
    });
  }
  function injectAnalytics() {
    if (!C.analyticsId || !/^G-/.test(C.analyticsId)) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(C.analyticsId)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', C.analyticsId, { anonymize_ip: true });
  }

  /* ----------------- Speculation Rules ----------------- */
  function injectSpeculationRules() {
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) return;
    const s = document.createElement('script');
    s.type = 'speculationrules';
    s.textContent = JSON.stringify({
      prerender: [{ where: { href_matches: '/*' }, eagerness: 'moderate' }]
    });
    document.head.appendChild(s);
  }

  /* ----------------- Meta / OG / JSON-LD ----------------- */
  function setMeta({ title, desc, image, url, type = 'article', published }) {
    document.title = title;
    const setProp = (sel, attr, key, val) => {
      let m = qs(sel);
      if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.appendChild(m); }
      m.setAttribute('content', val);
    };
    setProp(`meta[name="description"]`, 'name', 'description', desc);
    let link = qs('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
    link.href = url;
    setProp(`meta[property="og:title"]`,       'property', 'og:title', title);
    setProp(`meta[property="og:description"]`, 'property', 'og:description', desc);
    setProp(`meta[property="og:type"]`,        'property', 'og:type', type);
    setProp(`meta[property="og:url"]`,         'property', 'og:url', url);
    setProp(`meta[property="og:image"]`,       'property', 'og:image', image);
    setProp(`meta[property="og:site_name"]`,   'property', 'og:site_name', C.siteName || '');
    setProp(`meta[name="twitter:card"]`,        'name', 'twitter:card', 'summary_large_image');
    setProp(`meta[name="twitter:title"]`,       'name', 'twitter:title', title);
    setProp(`meta[name="twitter:description"]`, 'name', 'twitter:description', desc);
    setProp(`meta[name="twitter:image"]`,       'name', 'twitter:image', image);
    if (published) setProp(`meta[property="article:published_time"]`, 'property', 'article:published_time', published);
  }
  function injectJsonLd(json) {
    const tag = el('script', { type: 'application/ld+json' });
    tag.textContent = JSON.stringify(json);
    document.head.appendChild(tag);
  }

  /* ----------------- Cookie bar ----------------- */
  function initCookieBar() {
    if (!C.cookieBar || !C.cookieBar.enabled) return;
    let consent = null;
    try { consent = localStorage.getItem('mp_cookie'); } catch (_) {}
    if (consent === 'accept' || consent === 'decline') return;
    const bar = el('div', { class: 'cookie-bar', role: 'dialog', 'aria-live': 'polite' });
    bar.innerHTML = `
      <p>${esc(C.cookieBar.text)} <a href="${path('privacy.html')}" style="text-decoration:underline;">Learn more</a></p>
      <div class="btn-row">
        <button type="button" data-act="decline">${esc(C.cookieBar.decline || 'Decline')}</button>
        <button type="button" class="primary" data-act="accept">${esc(C.cookieBar.accept || 'Accept')}</button>
      </div>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('show'));
    bar.addEventListener('click', e => {
      const act = e.target?.dataset?.act;
      if (!act) return;
      try { localStorage.setItem('mp_cookie', act); } catch (_) {}
      bar.classList.remove('show');
      setTimeout(() => bar.remove(), 320);
    });
  }

  /* ----------------- Toast ----------------- */
  let toastT;
  function toast(msg) {
    let t = qs('.toast');
    if (!t) { t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 1900);
  }

  /* ----------------- Share row ----------------- */
  const ICONS = {
    share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>`,
    copy:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>`,
    x:     `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 3H21l-6.51 7.44L22.5 21h-6.86l-4.74-6.18L4.86 21H2l7.07-8.08L1.5 3h6.92l4.28 5.66L18.244 3Zm-1.2 16.18h1.62L7.04 4.74H5.32l11.72 14.44Z"/></svg>`,
    fb:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.1H13.5V8.9c0-.9.25-1.5 1.55-1.5H17V4.6a22 22 0 0 0-2.46-.13c-2.44 0-4.1 1.5-4.1 4.2v2.23H7.7V14h2.74v8h3.06Z"/></svg>`,
    pin:   `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.1c-5.5 0-10 4.45-10 9.95 0 4.2 2.55 7.8 6.2 9.3-.1-.8-.2-2 0-2.85.15-.75 1.1-4.65 1.1-4.65s-.3-.6-.3-1.45c0-1.4.8-2.45 1.8-2.45.85 0 1.25.65 1.25 1.4 0 .85-.55 2.15-.85 3.35-.25 1 .5 1.8 1.5 1.8 1.8 0 3.15-1.9 3.15-4.6 0-2.4-1.75-4.1-4.25-4.1-2.9 0-4.6 2.15-4.6 4.4 0 .85.35 1.8.75 2.3.1.1.1.2.1.3l-.3 1.15c-.05.2-.15.25-.4.15-1.4-.65-2.25-2.65-2.25-4.3 0-3.5 2.55-6.7 7.35-6.7 3.85 0 6.85 2.75 6.85 6.4 0 3.85-2.4 6.95-5.75 6.95-1.1 0-2.15-.6-2.5-1.3 0 0-.55 2.1-.7 2.6-.25.9-.85 2.1-1.3 2.8.95.3 1.95.45 3 .45 5.5 0 9.95-4.45 9.95-9.95C21.95 6.55 17.5 2.1 12 2.1Z"/></svg>`,
    rd:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.07c0-1.18-.96-2.13-2.14-2.13-.57 0-1.1.23-1.48.6a10.4 10.4 0 0 0-5.55-1.74l.95-4.46 3.1.66c.03.78.67 1.4 1.46 1.4.8 0 1.46-.65 1.46-1.46 0-.8-.66-1.46-1.46-1.46-.57 0-1.06.32-1.3.79l-3.5-.74c-.18-.04-.35.08-.4.25l-1.06 4.97a10.4 10.4 0 0 0-5.62 1.74 2.13 2.13 0 0 0-1.47-.6A2.13 2.13 0 0 0 3 12.07c0 .82.46 1.52 1.14 1.86-.04.24-.06.49-.06.74 0 3.74 4.27 6.78 9.54 6.78 5.27 0 9.54-3.04 9.54-6.78 0-.25-.02-.5-.05-.74A2.12 2.12 0 0 0 22 12.07ZM8.55 13.5a1.27 1.27 0 1 1 2.55 0 1.27 1.27 0 0 1-2.55 0Zm7.65 3.45c-1.16 1.16-3.4 1.25-4.05 1.25s-2.89-.09-4.05-1.25a.44.44 0 1 1 .62-.62c.73.73 2.29.99 3.43.99 1.14 0 2.7-.26 3.43-.99a.44.44 0 1 1 .62.62Zm-.5-2.18a1.27 1.27 0 1 1 0-2.54 1.27 1.27 0 0 1 0 2.54Z"/></svg>`,
    wa:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A10.5 10.5 0 0 0 3.6 16.2L2.5 21.5l5.45-1.07A10.5 10.5 0 1 0 20.5 3.5Zm-8.5 17.4c-1.6 0-3.15-.43-4.5-1.25l-.32-.2-3.23.63.65-3.15-.2-.33A8.7 8.7 0 1 1 12 20.9Zm4.95-6.45c-.27-.13-1.6-.79-1.85-.88-.25-.1-.43-.13-.62.13s-.7.88-.86 1.06c-.16.18-.32.2-.6.07-1.6-.8-2.65-1.43-3.7-3.23-.28-.48.28-.45.8-1.5.1-.18.05-.34-.02-.47-.07-.13-.6-1.45-.82-1.98-.22-.52-.45-.45-.62-.46l-.53-.01a1.02 1.02 0 0 0-.74.35c-.25.27-.97.95-.97 2.32 0 1.37 1 2.7 1.13 2.88.14.18 1.97 3 4.78 4.2 1.79.78 2.49.84 3.38.7.54-.08 1.6-.66 1.83-1.3.23-.65.23-1.2.16-1.3-.06-.13-.25-.2-.52-.33Z"/></svg>`,
    in:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM5.04 22V9.05h3.8V22h-3.8ZM10.5 9.05h3.66v1.77h.05c.5-.95 1.74-1.95 3.59-1.95 3.84 0 4.55 2.53 4.55 5.83V22h-3.8v-5.85c0-1.4-.03-3.2-1.95-3.2-1.96 0-2.26 1.53-2.26 3.1V22h-3.8V9.05Z"/></svg>`,
    tg:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m21.43 4.13-2.92 13.74c-.22 1-.81 1.24-1.65.77l-4.55-3.36-2.2 2.12c-.24.24-.45.45-.92.45l.33-4.7 8.55-7.73c.37-.33-.08-.51-.58-.18L7.07 12.45 2.5 11.03c-1-.31-1.01-1 .2-1.48l17.5-6.74c.84-.31 1.57.2 1.23 1.32Z"/></svg>`,
    mail:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`
  };
  function shareUrl(p, u, t, d, i) {
    switch (p) {
      case 'twitter':   return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
      case 'facebook':  return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
      case 'pinterest': return `https://pinterest.com/pin/create/button/?url=${u}&media=${i}&description=${t}`;
      case 'reddit':    return `https://www.reddit.com/submit?url=${u}&title=${t}`;
      case 'whatsapp':  return `https://wa.me/?text=${t}%20${u}`;
      case 'linkedin':  return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
      case 'telegram':  return `https://t.me/share/url?url=${u}&text=${t}`;
      case 'email':     return `mailto:?subject=${t}&body=${d}%20${u}`;
    } return '#';
  }
  function shareRowHTML(url, title, desc, img) {
    const cfg = C.enableShare || {};
    const u = encodeURIComponent(url), t = encodeURIComponent(title);
    const d = encodeURIComponent(desc || title), i = encodeURIComponent(img || '');
    const items = [];
    if (cfg.native && navigator.share) items.push(`<button class="share-btn" data-share="native">${ICONS.share}<span>Share</span></button>`);
    if (cfg.copyLink) items.push(`<button class="share-btn" data-share="copy">${ICONS.copy}<span>Copy link</span></button>`);
    if (cfg.twitter)   items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('twitter',u,t,d,i)}">${ICONS.x}<span>X</span></a>`);
    if (cfg.facebook)  items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('facebook',u,t,d,i)}">${ICONS.fb}<span>Facebook</span></a>`);
    if (cfg.pinterest) items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('pinterest',u,t,d,i)}">${ICONS.pin}<span>Pinterest</span></a>`);
    if (cfg.reddit)    items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('reddit',u,t,d,i)}">${ICONS.rd}<span>Reddit</span></a>`);
    if (cfg.whatsapp)  items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('whatsapp',u,t,d,i)}">${ICONS.wa}<span>WhatsApp</span></a>`);
    if (cfg.linkedin)  items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('linkedin',u,t,d,i)}">${ICONS.in}<span>LinkedIn</span></a>`);
    if (cfg.telegram)  items.push(`<a class="share-btn" target="_blank" rel="noopener nofollow" href="${shareUrl('telegram',u,t,d,i)}">${ICONS.tg}<span>Telegram</span></a>`);
    if (cfg.email)     items.push(`<a class="share-btn" href="${shareUrl('email',u,t,d,i)}">${ICONS.mail}<span>Email</span></a>`);
    return `
      <section class="share" aria-label="Share">
        <div class="share__label">Share this find</div>
        <div class="share__row">${items.join('')}</div>
      </section>`;
  }
  function bindShareActions(article) {
    qsa('[data-share]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const kind = btn.dataset.share;
        if (kind === 'native') {
          e.preventDefault();
          try { await navigator.share({ title: article.title, text: article.intro, url: location.href }); }
          catch (_) {}
        } else if (kind === 'copy') {
          e.preventDefault();
          try { await navigator.clipboard.writeText(location.href); toast('Link copied'); }
          catch (_) { toast('Copy failed — long-press the URL bar'); }
        }
      });
    });
  }

  /* ----------------- Homepage (infinite scroll) ----------------- */
  const HOME_STATE_KEY = 'mp_home_state';

  async function renderHome() {
    const heroH = qs('[data-hero-title]');
    const heroP = qs('[data-hero-tagline]');
    if (heroH) heroH.textContent = C.siteName || 'Curated Picks';
    if (heroP) heroP.textContent = C.tagline || '';

    setMeta({
      title: `${C.siteName} — ${C.tagline || ''}`.trim(),
      desc:  C.tagline || `${C.siteName} reviews of everyday essentials.`,
      image: absUrl(C.defaultCover),
      url:   absUrl(''),
      type:  'website'
    });

    const perBatch = Math.max(1, parseInt(C.postsPerPage, 10) || 12);
    const allItems = sortArticles(await loadAllArticles());

    // SEO: emit full ItemList JSON-LD so Google sees every article even though
    // only a slice is rendered. (Crawler doesn't scroll; sitemap.xml is the
    // canonical discovery path, this is just an extra signal.)
    injectJsonLd({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": C.siteName,
      "url": absUrl('')
    });
    injectJsonLd({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": allItems.slice(0, 50).map((a, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": absUrl('article.html?slug=' + a.meta.slug),
        "name": a.meta.title
      }))
    });

    const grid = qs('[data-grid]');
    if (!grid) return;

    if (allItems.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;color:var(--c-ink-muted);text-align:center;padding:40px 0;">No articles yet.</p>`;
      return;
    }

    grid.innerHTML = '';
    let rendered = 0;
    const renderBatch = () => {
      const slice = allItems.slice(rendered, rendered + perBatch);
      if (!slice.length) return false;
      grid.insertAdjacentHTML('beforeend', slice.map(a => cardHTML(a)).join(''));
      rendered += slice.length;
      return rendered < allItems.length;
    };

    // —— State restore on back-navigation ——
    // When user clicks a card and later hits Back, we want them to land where
    // they were, not at the top of a freshly-rendered 12-card grid.
    let initialBatches = 1;
    let restoreScrollY = null;
    try {
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      const isBackForward = nav?.type === 'back_forward' || performance.navigation?.type === 2;
      if (isBackForward) {
        const raw = sessionStorage.getItem(HOME_STATE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          initialBatches = Math.max(1, parseInt(s.batches, 10) || 1);
          restoreScrollY = typeof s.scrollY === 'number' ? s.scrollY : null;
        }
      }
    } catch (_) {}

    // Initial render — restore enough batches to cover the saved scroll position
    for (let i = 0; i < initialBatches; i++) {
      if (!renderBatch()) break;
    }

    // Restore scroll position after layout settles
    if (restoreScrollY != null) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: restoreScrollY, behavior: 'instant' });
      });
    }

    // —— Infinite scroll sentinel ——
    let sentinel = qs('.scroll-sentinel');
    if (sentinel) sentinel.remove();
    sentinel = el('div', { class: 'scroll-sentinel', 'aria-hidden': 'true' },
      `<span class="scroll-sentinel__spinner"></span>`);
    grid.insertAdjacentElement('afterend', sentinel);

    if (rendered >= allItems.length) {
      sentinel.style.display = 'none';
    } else if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (!renderBatch()) {
            sentinel.style.display = 'none';
            obs.disconnect();
          }
        }
      }, { rootMargin: '800px 0px' });  // start loading 800px before sentinel hits viewport
      obs.observe(sentinel);
    } else {
      // Fallback for ancient browsers: load everything at once
      while (renderBatch()) { /* noop */ }
      sentinel.style.display = 'none';
    }

    // —— Save state on navigation away ——
    const saveState = () => {
      try {
        sessionStorage.setItem(HOME_STATE_KEY, JSON.stringify({
          batches: Math.ceil(rendered / perBatch),
          scrollY: window.scrollY
        }));
      } catch (_) {}
    };
    // pagehide is more reliable than beforeunload, and works on mobile/Safari
    window.addEventListener('pagehide', saveState);
    // Also save when a card is clicked (covers the common case)
    grid.addEventListener('click', e => {
      if (e.target.closest('a.card')) saveState();
    });

    injectAdsense();
  }

  /* ----------------- Article page ----------------- */
  async function renderArticle() {
    const slug = new URLSearchParams(location.search).get('slug');
    const root = qs('[data-article-root]');
    if (!slug || !SLUGS.includes(slug)) return showNotFound(root);

    let article;
    try { article = await loadArticle(slug); }
    catch { return showNotFound(root); }

    const m = article.meta;
    const url   = absUrl('article.html?slug=' + slug);
    const cover = m.cover || C.defaultCover;
    const amzn  = `https://www.${C.amazonDomain || 'amazon.com'}/s?k=${encodeURIComponent(m.amazonKeyword || m.title)}&tag=${encodeURIComponent(C.amazonTag || '')}`;
    const bodyHTML = parseMarkdown(article.body);

    setMeta({
      title:     `${m.title} · ${C.siteName}`,
      desc:      m.metaDesc || m.intro || '',
      image:     absUrl(cover),
      url:       url,
      type:      'article',
      published: m.date
    });

    root.innerHTML = `
      <article>
        <div class="container container--narrow article-head">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="${path('')}">Home</a> &nbsp;›&nbsp; <span>${esc(m.title)}</span>
          </nav>
          <h1 class="article-title">${esc(m.title)}</h1>
          <div class="article-meta">
            <span>${fmtDate(m.date)}</span>
            <span>·</span>
            ${starsHTML(m.score)}
          </div>
        </div>

        <div class="container container--narrow">
          <div class="article-cover">
            <img src="${esc(cover)}" alt="${esc(m.title)}" loading="eager" fetchpriority="high" decoding="async">
          </div>

          <div class="article-body">
            ${m.intro ? `<p class="lead">${esc(m.intro)}</p>` : ''}

            <div class="ad-slot" data-ad="1111111111">
              <div class="ad-slot__label">Advertisement</div>
            </div>

            ${bodyHTML}

            ${m.amazonKeyword ? `
            <div class="shop-box">
              <div class="shop-box__label">Find it on Amazon</div>
              <div class="shop-box__row">
                <div class="shop-box__kw" data-keyword>${esc(m.amazonKeyword)}</div>
                <button class="btn btn--ghost" data-copy-kw>Copy keyword</button>
                <a class="btn btn-amazon" href="${amzn}" target="_blank" rel="noopener nofollow sponsored">Search on Amazon →</a>
              </div>
              <div style="font-size:.78rem;color:var(--c-ink-muted);margin-top:10px;">
                Tip: copy the keyword and paste into Amazon — you'll find the latest stock and best price.
              </div>
            </div>` : ''}

            <div class="ad-slot" data-ad="2222222222">
              <div class="ad-slot__label">Advertisement</div>
            </div>
          </div>

          ${shareRowHTML(url, m.title, m.metaDesc || m.intro, absUrl(cover))}

          <section class="related" aria-label="Related">
            <h2 class="related__title">You may also like</h2>
            <div class="related__grid" data-related></div>
          </section>
        </div>
      </article>`;

    // Related (tag-aware)
    const allItems = await loadAllArticles();
    const others = allItems.filter(a => a.meta.slug !== slug);
    const myTags = (m.tags || '').split(',').map(s => s.trim()).filter(Boolean);
    const pool = myTags.length
      ? others.filter(a => (a.meta.tags || '').split(',').map(s => s.trim()).some(t => myTags.includes(t)))
      : [];
    const remaining = others.filter(a => !pool.includes(a));
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const related = [...pool, ...remaining].slice(0, C.relatedCount || 4);
    qs('[data-related]').innerHTML = related.map(a => cardHTML(a, { hideExcerpt: true })).join('');

    // Copy keyword
    const copyBtn = qs('[data-copy-kw]');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(m.amazonKeyword); toast('Keyword copied — open Amazon and paste'); }
      catch { toast('Copy failed, please long-press to copy'); }
    });

    bindShareActions({ title: m.title, intro: m.intro });

    injectJsonLd({
      "@context": "https://schema.org",
      "@type": "Review",
      "itemReviewed": { "@type": "Product", "name": m.title, "image": absUrl(cover), "description": m.metaDesc || m.intro },
      "reviewRating": { "@type": "Rating", "ratingValue": Number(m.score) || 0, "bestRating": 5 },
      "name": m.title,
      "author": { "@type": "Organization", "name": C.authorName || C.siteName },
      "publisher": { "@type": "Organization", "name": C.siteName },
      "datePublished": m.date,
      "url": url,
      "reviewBody": m.intro
    });
    injectJsonLd({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": absUrl('') },
        { "@type": "ListItem", "position": 2, "name": m.title, "item": url }
      ]
    });

    injectAdsense();
  }

  function showNotFound(root) {
    if (root) root.innerHTML = `
      <div class="container container--narrow legal-body">
        <h1>Article not found</h1>
        <p>This piece might have moved. <a href="${path('')}">Head back home →</a></p>
      </div>`;
    setMeta({
      title: 'Not found · ' + (C.siteName || ''),
      desc:  'Article not found.',
      image: absUrl(C.defaultCover),
      url:   absUrl('article.html'),
      type:  'website'
    });
  }

  /* ----------------- Legal page hydrator ----------------- */
  function renderLegal() {
    qsa('[data-fill]').forEach(node => {
      const key = node.dataset.fill;
      if (C[key] != null) node.textContent = C[key];
    });
    const titleHost = qs('[data-page-title]');
    if (titleHost) {
      const t = titleHost.textContent.trim();
      setMeta({
        title: `${t} · ${C.siteName}`,
        desc:  `${t} of ${C.siteName}.`,
        image: absUrl(C.defaultCover),
        url:   absUrl(location.pathname.split('/').pop()),
        type:  'website'
      });
    }
    injectAdsense();
  }

  /* ----------------- Boot ----------------- */
  async function boot() {
    injectHeader();
    injectFooter();
    injectSpeculationRules();
    injectAnalytics();

    const page = document.body.dataset.page;
    try {
      if (page === 'home')         await renderHome();
      else if (page === 'article') await renderArticle();
      else if (page === 'legal')   renderLegal();
    } catch (err) {
      console.error('Render error', err);
    }

    initCookieBar();
    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
