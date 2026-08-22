<h1 align="center">Imabber</h1>

<p align="center">
  <a href="https://github.com/ArthurSimin/Imabber">
    <img alt="GitHub" height="56" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/available/github_vector.svg">
  </a>
  <a href="https://arthursimin.github.io/Imabber/">
    <img alt="website" height="56" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/documentation/website_vector.svg">
  </a>
  <img alt="opencode" height="56" src="devin_opencode_badge.svg">
</p>

<p align="center">
  <strong>Paste a link, get the highest-quality image. Nothing is uploaded — it all runs in your browser.</strong>
</p>

## What it does

Compressed thumbnails and resized profile pictures are everywhere. Imabber rewrites them back to their original, full-resolution versions — or resolves a page link into the best available image automatically.

Paste a URL, a Discord user ID, or a CurseForge/Modrinth/Steam/App Store page link. Imabber detects the platform, fetches the highest-quality variant, and verifies it against the original pixel-by-pixel.

## Supported services

Discord (ID lookup, avatars, banners, emojis), CurseForge (page link), Modrinth (page link), YouTube (page link), Steam (page link), GitHub (page link), App Store (page link), X / Twitter, Reddit, Imgur, Google avatars, Gravatar, Wikimedia, Mastodon, Pinterest, Tumblr, Twitch, Spotify, Next.js image proxies, and a generic fallback for any other URL.

## Quick start

Clone or download:

```bash
git clone https://github.com/ArthurSimin/Imabber.git
```

Open `index.html` in any modern browser. No build step, no server required.

## Structure

* `index.html` — UI
* `assets/style.css` — Styling (Catppuccin Mocha theme)
* `assets/core.js` — URL rewrite engine and CDN pattern rules
* `assets/app.js` — Page-link resolvers, image verification, and UI logic

## License

MIT
