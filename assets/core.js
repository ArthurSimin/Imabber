(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IGCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SERVICES = {
    discord:    { name: 'Discord',         color: '#5865F2' },
    youtube:    { name: 'YouTube',         color: '#ff0033' },
    x:          { name: 'X / Twitter',     color: '#e7e9ea' },
    github:     { name: 'GitHub',          color: '#9aa4b2' },
    curseforge: { name: 'CurseForge',      color: '#f16436' },
    modrinth:   { name: 'Modrinth',        color: '#00af54' },
    reddit:     { name: 'Reddit',          color: '#ff4500' },
    steam:      { name: 'Steam',           color: '#66c0f4' },
    imgur:      { name: 'Imgur',           color: '#1bb76e' },
    google:     { name: 'Google avatar',   color: '#34a853' },
    gravatar:   { name: 'Gravatar',        color: '#2f7fe0' },
    wikimedia:  { name: 'Wikimedia',       color: '#a8b3c5' },
    mastodon:   { name: 'Mastodon',        color: '#6364ff' },
    pinterest:  { name: 'Pinterest',       color: '#e60023' },
    tumblr:     { name: 'Tumblr',          color: '#7c8ba1' },
    twitch:     { name: 'Twitch',          color: '#9146ff' },
    spotify:    { name: 'Spotify',         color: '#1db954' },
    appstore:   { name: 'App Store',       color: '#c7ccd1' },
    generic:    { name: 'Unknown site',    color: '#6b7280' }
  };

  var SPOTIFY_UPGRADES = {
    ab67616d00001e02: ['ab67616d0000b272', 'ab67616d00004851'],
    ab67616d00004851: ['ab67616d0000b272'],
    ab67616100005174: ['ab6761610000e5eb']
  };

  function clean(raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (!raw) return null;
    raw = raw.replace(/^[<{("'\s]+/, '').replace(/[>)}"'\s,.;]+$/, '');
    if (!/^https?:\/\//i.test(raw) && /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(raw)) {
      raw = 'https://' + raw;
    }
    try {
      var u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return u;
    } catch (e) {
      return null;
    }
  }

  function basename(p) {
    return p.slice(p.lastIndexOf('/') + 1);
  }

  function dirname(p) {
    return p.slice(0, p.lastIndexOf('/') + 1);
  }

  function dedupe(list, originalHref) {
    var seen = Object.create(null);
    var out = [];
    list.forEach(function (c) {
      if (!c || c === originalHref) return;
      if (seen[c]) return;
      seen[c] = 1;
      out.push(c);
    });
    return out;
  }

  function analyze(raw, depth) {
    depth = depth || 0;
    var u = clean(raw);
    if (!u) return null;
    var notes = [];

    if (depth < 3) {
      if (u.pathname === '/_next/image') {
        var inner = u.searchParams.get('url');
        if (inner) {
          var subNext = analyze(inner, depth + 1);
          if (subNext) {
            subNext.notes.unshift('Unwrapped Next.js /_next/image proxy');
            return subNext;
          }
        }
      }
      if (/(^|\.)discordapp\.net$/.test(u.hostname) && u.pathname.indexOf('/external/') === 0) {
        var mExt = u.pathname.match(/\/(https?)\/(.+)$/);
        if (mExt) {
          var rest = mExt[2];
          try { rest = decodeURIComponent(rest); } catch (e) {}
          var subDsc = analyze(mExt[1] + '://' + rest, depth + 1);
          if (subDsc) {
            subDsc.notes.unshift('Unwrapped Discord embed proxy');
            return subDsc;
          }
        }
      }
    }

    var H = u.hostname.replace(/^www\./, '');
    function end(d) { return H === d || H.slice(-(d.length + 1)) === '.' + d; }

    var out = null;
    var cands;

    if (!out && (end('discordapp.com') || end('discordapp.net'))) {
      cands = [];
      if (/^\/attachments\//.test(u.pathname)) {
        if (end('discordapp.net')) {
          var vAtt = new URL(u);
          vAtt.search = '';
          cands.push(vAtt.toString());
        } else {
          notes.push('CDN attachments are already the original upload');
        }
      } else if (/^\/(avatars|icons|banners|splashes|discover-splashes|guild-events|role-icons|app-icons|team-icons|emojis)\//.test(u.pathname)) {
        var vDsc = new URL(u);
        vDsc.search = '';
        vDsc.searchParams.set('size', '4096');
        cands.push(vDsc.toString());
      }
      out = { serviceId: 'discord', candidates: dedupe(cands, u.href) };
    }

    if (!out && (H === 'i.ytimg.com' || H === 'img.youtube.com')) {
      var mYt = u.pathname.match(/^\/vi(?:_webp)?\/([^/]+)\/([A-Za-z0-9_]+)\.(jpg|webp)$/);
      if (mYt) {
        var prefs = ['maxresdefault', 'hq720', 'sddefault', 'hqdefault'].filter(function (n) { return n !== mYt[2]; });
        cands = prefs.map(function (n) { return 'https://i.ytimg.com/vi/' + mYt[1] + '/' + n + '.jpg'; });
        out = { serviceId: 'youtube', candidates: dedupe(cands, u.href) };
      }
    }

    if (!out && end('twimg.com')) {
      cands = [];
      if (u.pathname.indexOf('/profile_images/') > -1) {
        var nmTw = basename(u.pathname);
        var mmTw = nmTw.match(/^(.+?)_(normal|bigger|mini|200x200|400x400)(\.\w+)$/);
        if (mmTw) {
          var vTw = new URL(u);
          vTw.pathname = dirname(u.pathname) + mmTw[1] + mmTw[3];
          cands.push(vTw.toString());
        }
      } else if (u.pathname.indexOf('/media/') > -1) {
        var vMed = new URL(u);
        vMed.searchParams.set('name', 'orig');
        cands.push(vMed.toString());
        if (/:(small|medium|large|thumb)$/.test(u.pathname)) {
          var vLeg = new URL(u);
          vLeg.pathname = u.pathname.replace(/:(small|medium|large|thumb)$/, '');
          vLeg.searchParams.set('name', 'orig');
          cands.push(vLeg.toString());
        }
      }
      out = { serviceId: 'x', candidates: dedupe(cands, u.href) };
    }

    if (!out && H === 'avatars.githubusercontent.com') {
      var vGh = new URL(u);
      vGh.searchParams.set('s', '460');
      out = { serviceId: 'github', candidates: [vGh.toString()] };
    }

    if (!out && end('forgecdn.net')) {
      var npCf = u.pathname.replace(/\/thumbnails\/(\d+)\/(\d+)\/\d+\/\d+\//, '/$1/$2/');
      cands = [];
      if (npCf !== u.pathname) {
        var vCf = new URL(u);
        vCf.pathname = npCf;
        vCf.search = '';
        cands.push(vCf.toString());
      }
      out = { serviceId: 'curseforge', candidates: dedupe(cands, u.href) };
    }

    if (!out && H === 'cdn.modrinth.com') {
      cands = [];
      var nmMr = basename(u.pathname);
      if (/-thumb\./.test(nmMr)) {
        var vMr = new URL(u);
        vMr.pathname = dirname(u.pathname) + nmMr.replace(/-thumb\./, '.');
        vMr.search = '';
        cands.push(vMr.toString());
      }
      out = { serviceId: 'modrinth', candidates: dedupe(cands, u.href) };
    }

    if (!out && H === 'preview.redd.it') {
      var vRd = new URL(u);
      vRd.hostname = 'i.redd.it';
      vRd.search = '';
      out = { serviceId: 'reddit', candidates: dedupe([vRd.toString()], u.href) };
    }

    if (!out && /(steamstatic\.com|steamcdn-a\.akamaihd\.net)$/.test(u.hostname)) {
      cands = [];
      var nmSt = basename(u.pathname);
      var mmSt = nmSt.match(/^(.*)_(medium|avatar)(\.\w+)$/);
      if (mmSt) {
        var vSt = new URL(u);
        vSt.pathname = dirname(u.pathname) + mmSt[1] + '_full' + mmSt[3];
        cands.push(vSt.toString());
      }
      out = { serviceId: 'steam', candidates: dedupe(cands, u.href) };
    }

    if (!out && H === 'i.imgur.com') {
      cands = [];
      var nmIm = basename(u.pathname);
      var mmIm = nmIm.match(/^(.{5,})([sbtlhg])(\.(?:jpe?g|png|gif|webp))$/i);
      if (mmIm) {
        cands.push(u.origin + dirname(u.pathname) + mmIm[1] + mmIm[3]);
      }
      if (/\.gifv$/i.test(nmIm)) {
        cands.push(u.origin + dirname(u.pathname) + nmIm.replace(/\.gifv$/i, '.webp'));
        cands.push(u.origin + dirname(u.pathname) + nmIm.replace(/\.gifv$/i, '.mp4'));
      }
      out = { serviceId: 'imgur', candidates: dedupe(cands, u.href) };
    }

    if (!out && (end('ggpht.com') || end('googleusercontent.com'))) {
      var segGo = basename(u.pathname);
      var eqGo = segGo.indexOf('=');
      function mkGo(spec) {
        var v = new URL(u);
        v.pathname = dirname(u.pathname) + (eqGo > -1 ? segGo.slice(0, eqGo) : segGo) + spec;
        return v.toString();
      }
      out = { serviceId: 'google', candidates: dedupe([mkGo('=s0'), mkGo('=s2048')], u.href) };
    }

    if (!out && end('gravatar.com')) {
      var vGr = new URL(u);
      vGr.searchParams.set('s', '2048');
      out = { serviceId: 'gravatar', candidates: dedupe([vGr.toString()], u.href) };
    }

    if (!out && H === 'upload.wikimedia.org') {
      var mWm = u.pathname.match(/^\/wikipedia\/([a-z]+)\/thumb\/(.+)\/([^/]+)$/);
      cands = [];
      if (mWm) {
        var vWm = new URL(u);
        vWm.pathname = '/wikipedia/' + mWm[1] + '/' + mWm[2];
        cands.push(vWm.toString());
      }
      out = { serviceId: 'wikimedia', candidates: dedupe(cands, u.href) };
    }

    if (!out && u.pathname.indexOf('/media_attachments/files/') > -1 && u.pathname.indexOf('/small/') > -1) {
      var vMa = new URL(u);
      vMa.pathname = u.pathname.replace('/small/', '/original/');
      out = { serviceId: 'mastodon', candidates: dedupe([vMa.toString()], u.href) };
    }

    if (!out && end('pinimg.com')) {
      var mPi = u.pathname.match(/^\/(\d+x)\//);
      cands = [];
      if (mPi) {
        var vPi = new URL(u);
        vPi.pathname = u.pathname.replace(/^\/\d+x\//, '/originals/');
        cands.push(vPi.toString());
      }
      out = { serviceId: 'pinterest', candidates: dedupe(cands, u.href) };
    }

    if (!out && end('tumblr.com')) {
      cands = [];
      var nmTu = basename(u.pathname);
      var mmTu = nmTu.match(/^(.+)_\d{2,4}(\.(?:png|jpe?g|gif|webp))$/i);
      if (mmTu) {
        var vTu = new URL(u);
        vTu.pathname = dirname(u.pathname) + mmTu[1] + '_1280' + mmTu[2];
        cands.push(vTu.toString());
      }
      out = { serviceId: 'tumblr', candidates: dedupe(cands, u.href) };
    }

    if (!out && end('jtvnw.net')) {
      cands = [];
      if (u.pathname.indexOf('jtv_user_pictures') > -1) {
        var nmTw2 = basename(u.pathname);
        var mmTwitch = nmTw2.match(/^(.*?)-\d+x\d+(\.\w+)$/);
        if (mmTwitch) {
          var vTwitch = new URL(u);
          vTwitch.pathname = dirname(u.pathname) + mmTwitch[1] + '-300x300' + mmTwitch[2];
          if (vTwitch.pathname !== u.pathname) cands.push(vTwitch.toString());
        }
      }
      out = { serviceId: 'twitch', candidates: dedupe(cands, u.href) };
    }

    if (!out && H === 'i.scdn.co') {
      cands = [];
      var mSp = u.pathname.match(/^\/image\/([0-9a-f]{16})/);
      if (mSp && SPOTIFY_UPGRADES[mSp[1]]) {
        cands = SPOTIFY_UPGRADES[mSp[1]].map(function (h) { return u.href.replace(mSp[1], h); });
      }
      out = { serviceId: 'spotify', candidates: dedupe(cands, u.href) };
    }

    if (!out && end('mzstatic.com')) {
      cands = [];
      var npAz = u.pathname.replace(/\/\d+x\d+[a-z0-9]*(\.(?:jpe?g|png|webp))$/i, '/1024x1024bb$1');
      if (npAz !== u.pathname) {
        var vAz = new URL(u);
        vAz.pathname = npAz;
        cands.push(vAz.toString());
      }
      out = { serviceId: 'appstore', candidates: dedupe(cands, u.href) };
    }

    if (!out) {
      cands = [];
      var vGen = new URL(u);
      var touched = false;
      ['width', 'height', 'w', 'h', 'size', 'resize', 'fit', 'quality', 'q', 'scale', 'downscale', 'maxwidth', 'maxheight', 'fw', 'fh'].forEach(function (k) {
        if (vGen.searchParams.has(k)) {
          vGen.searchParams.delete(k);
          touched = true;
        }
      });
      if (touched) cands.push(vGen.toString());
      var nmGen = basename(u.pathname);
      var wmGen = nmGen.match(/^(.+)-\d+x\d+(\.\w+)$/);
      if (wmGen) {
        var vWp1 = new URL(u);
        vWp1.pathname = dirname(u.pathname) + wmGen[1] + wmGen[2];
        cands.push(vWp1.toString());
      }
      wmGen = nmGen.match(/^(.+)_\d+x\d*(\.\w+)$/);
      if (wmGen) {
        var vWp2 = new URL(u);
        vWp2.pathname = dirname(u.pathname) + wmGen[1] + wmGen[2];
        cands.push(vWp2.toString());
      }
      out = { serviceId: 'generic', candidates: dedupe(cands, u.href) };
    }

    var meta = SERVICES[out.serviceId];
    return {
      input: u.href,
      serviceId: out.serviceId,
      name: meta.name,
      color: meta.color,
      notes: notes,
      candidates: out.candidates
    };
  }

  return {
    SERVICES: SERVICES,
    clean: clean,
    analyze: analyze
  };
});
