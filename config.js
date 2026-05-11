/* ============================================================
   MinimalistPicks · 站点总控配置文件 (Master Config)
   ------------------------------------------------------------
   ✅  这是整个网站的"大脑"。99% 的设置都在这里改。
   ✅  改完保存 → 推送到 GitHub → 全站自动生效。
   ✅  不需要懂代码，只需要替换引号里面的内容。
   ============================================================ */

window.SITE_CONFIG = {

  /* —— 基础信息 ———————————————————————————————— */
  siteName:        "MinimalistPicks",
  tagline:         "Curated everyday essentials. Quietly tested. Honestly reviewed.",
  siteUrl:         "https://minimalistpicks.com",   // 你的最终域名，结尾不要带 /
  siteLanguage:    "en",
  defaultCover:    "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?w=1200&q=80&auto=format&fit=crop",
  logoText:        "MinimalistPicks",               // 顶部显示的纯文字 logo

  /* —— 联系方式 ———————————————————————————————— */
  contactEmail:    "hello@minimalistpicks.com",
  authorName:      "The MinimalistPicks Team",

  /* —— 广告 & 统计 (留空则自动不加载) —————————————— */
  adsenseId:       "",   // 例: "ca-pub-1234567890123456"
  analyticsId:     "",   // 例: "G-XXXXXXXXXX"  (GA4)

  /* —— 亚马逊联盟 —————————————————————————————— */
  amazonTag:       "minimalistpic-20",              // 你的 Amazon Associates Tag
  amazonDomain:    "amazon.com",                     // 不同站点改这里 (.co.uk / .de / .co.jp)

  /* —— 法律页面参数 ——————————————————————————— */
  privacyDate:     "May 12, 2026",                   // 隐私政策最近更新日
  companyLocation: "United States",                  // 司法管辖区

  /* —— 社交分享 (Web Share + 各平台) ————————————— */
  enableShare: {
    native:     true,    // 移动端原生分享 (Web Share API)
    copyLink:   true,
    twitter:    true,
    facebook:   true,
    pinterest:  true,    // 好物分享强烈建议开启
    reddit:     true,
    whatsapp:   true,
    linkedin:   false,
    telegram:   false,
    email:      true
  },

  /* —— Cookie 通知条 (GDPR / CCPA) ————————————— */
  cookieBar: {
    enabled: true,
    text:    "We use cookies to analyze traffic and personalize ads. By browsing this site, you accept our use of cookies.",
    accept:  "Accept",
    decline: "Decline"
  },

  /* —— 内部链接相关推荐 —————————————————————— */
  relatedCount:  4,        // 文章底部展示几篇"你可能也喜欢"
  stickyDays:    3,        // 几天内的文章在首页顶部置顶

  /* —— 捐赠 / 打赏 (可选, 留空则不显示) ————————— */
  donateLink:    "",       // 例: "https://buymeacoffee.com/yourname"

  /* —— FTC / Affiliate 披露文字 ————————————————— */
  ftcDisclosure: "As an Amazon Associate we earn from qualifying purchases. This site contains affiliate links. We may earn a small commission when you buy through our links — at no extra cost to you. We only recommend products we genuinely believe in."

};
