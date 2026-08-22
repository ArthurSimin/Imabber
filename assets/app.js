(function () {
  'use strict';

  var CORE = window.IGCore;
  var ta = document.getElementById('urls');
  var runBtn = document.getElementById('run');
  var clearBtn = document.getElementById('clear');
  var grid = document.getElementById('grid');
  var statusEl = document.getElementById('status');
  var toastEl = document.getElementById('toast');

  var done = 0, total = 0;

  var DISCORD_ID = /^\d{15,21}$/;
  var DISCORD_PROFILE = /^(?:https?:\/\/)?(?:[a-z]+\.)?discord\.com\/users\/(\d{15,21})(?:[/?#]|$)/i;
  var CF_PAGE = /^(?:https?:\/\/)?(?:www\.)?curseforge\.com\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9._-]+)(?:[/?#]|$)/i;
  var MODRINTH_PAGE = /^(?:https?:\/\/)?(?:www\.)?modrinth\.com\/(?:mod|plugin|datapack|modpack|resourcepack)\/([a-z0-9._-]+)(?:[/?#]|$)/i;
  var STEAM_PAGE = /^(?:https?:\/\/)?store\.steampowered\.com\/app\/(\d+)(?:[/?#]|$)/i;
  var YT_PAGE = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&/?#]|$)/i;
  var GH_PROFILE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)(?:[?#]|$)/i;
  var APPSTORE_PAGE = /^(?:https?:\/\/)?apps\.apple\.com\/(?:[^/]*\/)?(?:app|developer)\/(?:[^/]*\/)?id(\d+)(?:[/?#]|$)/i;
  var URLISH = /^https?:\/\//i;
  var WWWISH = /^www\./i;
  var DOMAINISH = /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i;
  var DISCORD_NAME = /^(?=.*[a-z])[a-z0-9._]{2,32}$/;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function shortUrl(u) {
    return u.length > 84 ? u.slice(0, 44) + ' … ' + u.slice(-38) : u;
  }

  function classify(tok) {
    tok = tok.trim();
    if (!tok) return null;
    if (DISCORD_ID.test(tok)) return { type: 'did', tok: tok };
    var m = tok.match(DISCORD_PROFILE);
    if (m) return { type: 'did', tok: m[1] };
    m = tok.match(CF_PAGE);
    if (m) return { type: 'cf', game: m[1], category: m[2], tok: m[3] };
    m = tok.match(MODRINTH_PAGE);
    if (m) return { type: 'mr', tok: m[1] };
    m = tok.match(STEAM_PAGE);
    if (m) return { type: 'steam', tok: m[1] };
    m = tok.match(YT_PAGE);
    if (m) return { type: 'yt', tok: m[1] };
    m = tok.match(GH_PROFILE);
    if (m) return { type: 'gh', tok: m[1] };
    m = tok.match(APPSTORE_PAGE);
    if (m) return { type: 'apple', tok: m[1] };
    if (WWWISH.test(tok)) return { type: 'url', tok: 'https://' + tok };
    if (URLISH.test(tok) || DOMAINISH.test(tok)) return { type: 'url', tok: tok };
    var name = tok.replace(/^@+/, '').replace(/#\d{1,4}$/, '');
    if (DISCORD_NAME.test(name)) return { type: 'dname', tok: name };
    return null;
  }

  function parseInput() {
    var seen = Object.create(null);
    var out = [];
    ta.value.split(/\s+/).forEach(function (raw) {
      var c = classify(raw);
      if (!c) return;
      var key = c.type + ':' + (c.game || '') + ':' + (c.category || '') + ':' + c.tok;
      if (seen[key]) return;
      seen[key] = 1;
      out.push(c);
    });
    return out.slice(0, 24);
  }

  function probe(url) {
    return new Promise(function (resolve) {
      var im = new Image();
      var finished = false;
      var t = setTimeout(function () {
        if (finished) return;
        finished = true;
        im.src = '';
        resolve({ ok: false });
      }, 9000);
      im.onload = function () {
        if (finished) return;
        finished = true;
        clearTimeout(t);
        resolve({ ok: true, w: im.naturalWidth, h: im.naturalHeight });
      };
      im.onerror = function () {
        if (finished) return;
        finished = true;
        clearTimeout(t);
        resolve({ ok: false });
      };
      im.referrerPolicy = 'no-referrer';
      im.src = url;
    });
  }

  function fetchJson(url, timeoutMs) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, timeoutMs || 8000);
    return fetch(url, { signal: ctrl.signal })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        clearTimeout(t);
        throw err;
      });
  }

  function headSize(url) {
    return fetch(url, { method: 'HEAD', mode: 'cors' })
      .then(function (r) {
        var n = parseInt(r.headers.get('content-length'), 10);
        return r.ok && isFinite(n) && n > 0 ? n : null;
      })
      .catch(function () { return null; });
  }

  function fmtBytes(n) {
    if (!isFinite(n)) return '';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function pct(oldA, newA) {
    if (!oldA) return '+∞%';
    var p = Math.round((newA - oldA) / oldA * 100);
    return '+' + p.toLocaleString('en-US') + '%';
  }

  function deriveName(url) {
    try {
      var b = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      b = b.replace(/[^\w.-]+/g, '_').replace(/^\.+/, '');
      return b || 'image';
    } catch (e) {
      return 'image';
    }
  }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { toast('URL copied'); })
        .catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var i = document.createElement('input');
    i.value = text;
    document.body.appendChild(i);
    i.select();
    try {
      document.execCommand('copy');
      toast('URL copied');
    } catch (e) {
      window.prompt('Copy the URL:', text);
    }
    i.remove();
  }

  function download(url, name) {
    fetch(url, { mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      })
      .then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        toast('Downloading…');
      })
      .catch(function () {
        window.open(url, '_blank', 'noopener');
        toast('Direct download blocked — opened in a new tab');
      });
  }

  function cardShell(inner) {
    var card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = inner;
    grid.appendChild(card);
    return card;
  }

  function bumpStatus() {
    done++;
    statusEl.hidden = false;
    statusEl.textContent = done === total
      ? 'Done — ' + total + ' item' + (total > 1 ? 's' : '') + ' processed.'
      : 'Processed ' + done + ' of ' + total + '…';
    if (done >= total) runBtn.disabled = false;
  }

  function setActions(card, url) {
    card.dataset.url = url;
    card.dataset.name = deriveName(url);
    var btns = card.querySelectorAll('.actions button');
    for (var i = 0; i < btns.length; i++) btns[i].disabled = false;
    var curl = card.querySelector('.curl');
    curl.textContent = shortUrl(url);
    curl.title = url;
  }

  function setWinImg(card, url) {
    var box = card.querySelector('figure.win .imgbox');
    box.innerHTML = '';
    var im = document.createElement('img');
    im.alt = 'Best available image';
    im.referrerPolicy = 'no-referrer';
    im.src = url;
    box.appendChild(im);
  }

  function settle(opts) {
    if (opts && typeof opts.onDone === 'function') opts.onDone();
    else bumpStatus();
  }

  function finish(card, a, o, best, opts) {
    if (!card.isConnected) return;
    var settled = false;
    function doneOnce() {
      if (settled) return;
      settled = true;
      settle(opts);
    }

    var pill = card.querySelector('.pill');
    pill.classList.remove('busy');
    var oDims = card.querySelector('figure.orig .dims');
    var wDims = card.querySelector('figure.win .dims');
    if (oDims) oDims.textContent = o ? ' · ' + o.w + '×' + o.h : '';

    if (!o && !best) {
      pill.className = 'pill err';
      pill.textContent = 'Could not load';
      var box = card.querySelector('figure.win .imgbox');
      box.innerHTML = '<span class="dead">unavailable</span>';
      doneOnce();
      return;
    }

    var oa = o ? o.w * o.h : 0;
    var ba = best ? best.w * best.h : 0;

    if (best && o && ba > oa) {
      pill.className = 'pill ok';
      pill.textContent = 'Enhanced ' + pct(oa, ba);
      setWinImg(card, best.url);
      wDims.textContent = ' · ' + best.w + '×' + best.h;
      setActions(card, best.url);
    } else if (best && !o) {
      pill.className = 'pill info';
      pill.textContent = 'Original blocked — best guess';
      setWinImg(card, best.url);
      wDims.textContent = ' · ' + best.w + '×' + best.h;
      setActions(card, best.url);
    } else if (best) {
      pill.className = 'pill warn';
      pill.textContent = 'Already max quality';
      setWinImg(card, best.url);
      wDims.textContent = ' · ' + best.w + '×' + best.h;
      setActions(card, a.input);
    } else {
      pill.className = 'pill warn';
      pill.textContent = 'Already max quality';
      setWinImg(card, a.input);
      wDims.textContent = o ? ' · ' + o.w + '×' + o.h : '';
      setActions(card, a.input);
    }

    var target = card.dataset.url;
    if (target) {
      Promise.all([headSize(target), headSize(a.input)]).then(function (sizes) {
        if (!card.isConnected) return;
        if (sizes[1]) oDims.textContent += ' · ' + fmtBytes(sizes[1]);
        if (sizes[0]) wDims.textContent += ' · ' + fmtBytes(sizes[0]);
      });
    }
    doneOnce();
  }

  function startPipeline(card, a, opts) {
    var img = card.querySelector('figure.orig img');
    img.addEventListener('click', function () { window.open(a.input, '_blank', 'noopener'); });

    var origP = probe(a.input).then(function (r) { return r.ok ? r : null; });

    var chain = Promise.resolve(null);
    a.candidates.forEach(function (c) {
      chain = chain.then(function (best) {
        if (best || !card.isConnected) return best;
        return probe(c).then(function (r) {
          return r.ok ? { url: c, w: r.w, h: r.h } : null;
        });
      });
    });

    Promise.all([origP, chain]).then(function (res) {
      finish(card, a, res[0], res[1], opts);
    });
  }

  function noticeCard(colorDot, titleHtml, pillClass, pillText, bodyHtml) {
    cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:' + colorDot + '"></span>' +
        '<span class="svc">' + titleHtml + '</span>' +
        '<span class="pill ' + pillClass + '">' + esc(pillText) + '</span>' +
      '</div>' +
      '<div class="notice">' + bodyHtml + '</div>'
    );
  }

  function resultCard(a) {
    var svcLabel = a.kindLabel ? esc(a.serviceName || a.name) + ' ' + esc(a.kindLabel) : esc(a.name);
    var notesHtml = (a.notes || []).map(function (n) { return '<span class="note">' + esc(n) + '</span>'; }).join('');
    var dotColor = a.color || '#5865f2';
    return cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:' + dotColor + '"></span>' +
        '<span class="svc">' + svcLabel + '</span>' +
        notesHtml +
        '<span class="pill busy">Analyzing…</span>' +
      '</div>' +
      '<div class="panes">' +
        '<figure class="orig">' +
          '<div class="imgbox" title="Open original in a new tab"><img alt="Original image" referrerpolicy="no-referrer" src="' + esc(a.input) + '"></div>' +
          '<figcaption><b>Original</b><span class="dims"></span></figcaption>' +
        '</figure>' +
        '<figure class="win">' +
          '<div class="imgbox" title="Open full quality in a new tab"><span class="spin"></span></div>' +
          '<figcaption><b>Best available</b><span class="dims"></span></figcaption>' +
        '</figure>' +
      '</div>' +
      '<div class="curl"></div>' +
      '<div class="actions">' +
        '<button type="button" class="star" data-act="download" disabled>Download</button>' +
        '<button type="button" data-act="copy" disabled>Copy URL</button>' +
        '<button type="button" data-act="open" disabled>Open ↗</button>' +
      '</div>'
    );
  }

  function processUrl(raw) {
    var a = CORE.analyze(raw);
    if (!a) {
      noticeCard('#f38ba8', esc(String(raw)), 'err', 'Rejected',
        '<p>Not a usable http(s) image URL.</p>');
      bumpStatus();
      return;
    }
    startPipeline(resultCard(a), a);
  }

  function snowflakeDate(id) {
    try {
      return new Date(Number((BigInt(id) >> 22n)) + 1420070400000);
    } catch (e) {
      return null;
    }
  }

  function defaultAvatarIndex(id) {
    try {
      return Number((BigInt(id) >> 22n) % 6n);
    } catch (e) {
      return 0;
    }
  }

  function resolveDiscordUser(id) {
    var out = { id: id, username: null, displayName: null, avatarHash: null, bannerHash: null, source: null };

    function absorb(d) {
      if (!d) return;
      out.username = out.username || d.username || null;
      out.displayName = out.displayName || d.global_name || d.display_name || null;
      if (typeof d.avatar === 'string' && d.avatar) out.avatarHash = d.avatar;
      if (typeof d.banner === 'string' && d.banner) out.bannerHash = out.bannerHash || d.banner;
    }

    return fetchJson('https://japi.rest/discord/v1/user/' + id)
      .then(function (j) {
        absorb(j && j.data);
        if (out.username || out.avatarHash) out.source = 'japi.rest';
      })
      .catch(function () {})
      .then(function () {
        if (out.avatarHash) return null;
        return fetchJson('https://discordlookup.mevdschee.nl/api/userinfo/' + id)
          .then(function (j) {
            absorb(j);
            if (out.avatarHash && !out.source) out.source = 'discordlookup';
          })
          .catch(function () {});
      })
      .then(function () {
        if (out.avatarHash) return null;
        return fetchJson('https://api.lanyard.rest/v1/users/' + id)
          .then(function (j) {
            if (j && j.success) absorb(j.data && j.data.discord_user);
            if (out.avatarHash && !out.source) out.source = 'Lanyard';
          })
          .catch(function () {});
      })
      .then(function () { return out; });
  }

  function profileCard(id, user) {
    var created = snowflakeDate(id);
    var rows = [
      ['User ID', id],
      ['Username', user.username ? '@' + user.username : null],
      ['Display name', user.displayName],
      ['Account created', created ? created.toISOString().slice(0, 10) : null],
      ['Resolved via', user.source]
    ].filter(function (r) { return r[1]; });

    var kv = rows.map(function (r) {
      return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('');

    return cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#89b4fa"></span>' +
        '<span class="svc">Discord user' + (user.displayName || user.username ? ' — ' + esc(user.displayName || '@' + user.username) : '') + '</span>' +
        '<span class="pill ok">Resolved via ' + esc(user.source || 'lookup') + '</span>' +
      '</div>' +
      '<div class="pmeta">' + kv + '</div>'
    );
  }

  function resolveProfile(id) {
    var busy = cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#89b4fa"></span>' +
        '<span class="svc">Discord ID ' + esc(id) + '</span>' +
        '<span class="pill busy">Resolving user…</span>' +
      '</div>'
    );

    resolveDiscordUser(id).then(function (user) {
      if (!busy.isConnected) return;

      if (!user.username && !user.avatarHash) {
        busy.innerHTML =
          '<div class="chead">' +
            '<span class="dot" style="--c:#f38ba8"></span>' +
            '<span class="svc">Discord ID ' + esc(id) + '</span>' +
            '<span class="pill err">Could not resolve</span>' +
          '</div>' +
          '<div class="notice">' +
            '<p>No public lookup service could find this ID. The account may not exist, may be banned/deleted, or the lookup services are temporarily down.</p>' +
            '<p>Double-check the ID: enable <b>Developer Mode</b> in Discord settings, then right-click a user → <b>Copy User ID</b>.</p>' +
          '</div>';
        bumpStatus();
        return;
      }

      busy.replaceWith(profileCard(id, user));

      var pending = 0;
      function track(a) {
        var card = resultCard(a);
        grid.appendChild(card);
        pending++;
        startPipeline(card, a, {
          onDone: function () {
            if (--pending === 0) bumpStatus();
          }
        });
      }

      if (user.avatarHash) {
        var ext = user.avatarHash.indexOf('a_') === 0 ? '.gif' : '.png';
        var av = CORE.analyze('https://cdn.discordapp.com/avatars/' + id + '/' + user.avatarHash + ext + '?size=64');
        av.kindLabel = 'avatar';
        av.serviceName = 'Discord';
        av.notes.push('From user ID via public lookup');
        track(av);
      } else {
        track({
          input: 'https://cdn.discordapp.com/embed/avatars/' + defaultAvatarIndex(id) + '.png',
          candidates: [],
          notes: ['No custom avatar — this is the generated default'],
          kindLabel: 'avatar',
          serviceName: 'Discord'
        });
      }

      if (user.bannerHash) {
        var bn = CORE.analyze('https://cdn.discordapp.com/banners/' + id + '/' + user.bannerHash + '.png?size=600');
        bn.kindLabel = 'banner';
        bn.serviceName = 'Discord';
        bn.notes.push('Profile banner');
        track(bn);
      }
    });
  }

  function resolveByName(name) {
    var busy = cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#f9e2af"></span>' +
        '<span class="svc">Discord lookup “' + esc(name) + '”</span>' +
        '<span class="pill busy">Trying resolvers…</span>' +
      '</div>'
    );

    resolveDiscordUser(name).then(function (user) {
      if (!busy.isConnected) return;
      if (user.username || user.avatarHash) {
        busy.remove();
        resolveProfile(user.id || name);
        return;
      }
      busy.innerHTML =
        '<div class="chead">' +
          '<span class="dot" style="--c:#f9e2af"></span>' +
          '<span class="svc">Discord lookup “' + esc(name) + '”</span>' +
          '<span class="pill warn">Needs a user ID</span>' +
        '</div>' +
        '<div class="notice">' +
          '<p>Discord does not allow anonymous username → ID lookups, so nicknames can only be resolved when a lookup service already knows the account.</p>' +
          '<p>To grab an avatar or banner reliably:</p>' +
          '<ol>' +
            '<li>In Discord, open <b>User Settings</b> → <b>Advanced</b> → enable <b>Developer Mode</b>.</li>' +
            '<li>Right-click the user (in chat or their profile) → <b>Copy User ID</b>.</li>' +
            '<li>Paste that 17–20 digit number here and hit <b>Get full quality</b>.</li>' +
          '</ol>' +
        '</div>';
      bumpStatus();
    });
  }

  function resolveCf(game, category, slug) {
    var busy = cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#f16436"></span>' +
        '<span class="svc">CurseForge project “' + esc(slug) + '”</span>' +
        '<span class="pill busy">Resolving logo…</span>' +
      '</div>'
    );

    fetchJson('https://api.cfwidget.com/' + game + '/' + category + '/' + slug).then(function (j) {
      if (!busy.isConnected) return;

      if (!j || j.error || (j.code && j.code !== 'in_progress' && j.code !== 'pending') || !j.thumbnail) {
        var reason = j && (j.code === 'not_found' || j.error === 'not found')
          ? 'No CurseForge project exists at that address.'
          : j && (j.code === 'in_progress' || j.code === 'pending')
            ? 'The project index is still being built by the lookup service — try again in a minute.'
            : !j
              ? 'The lookup service could not be reached. It may be down or rate-limiting — try again shortly.'
              : 'This project has no custom logo to fetch.';
        busy.innerHTML =
          '<div class="chead">' +
            '<span class="dot" style="--c:#f16436"></span>' +
            '<span class="svc">CurseForge project “' + esc(slug) + '”</span>' +
            '<span class="pill warn">Could not resolve</span>' +
          '</div>' +
          '<div class="notice"><p>' + reason + '</p></div>';
        bumpStatus();
        return;
      }

      var a = CORE.analyze(j.thumbnail);
      a.kindLabel = 'project logo';
      a.serviceName = 'CurseForge';
      if (j.title) a.notes.unshift('Project: ' + j.title);
      a.notes.push('Resolved via cfwidget');

      var card = resultCard(a);
      busy.replaceWith(card);
      startPipeline(card, a);
    });
  }

  function resolveModrinth(slug) {
    var busy = cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#00af54"></span>' +
        '<span class="svc">Modrinth project “' + esc(slug) + '”</span>' +
        '<span class="pill busy">Resolving icon…</span>' +
      '</div>'
    );

    fetchJson('https://api.modrinth.com/v2/project/' + encodeURIComponent(slug)).then(function (j) {
      if (!busy.isConnected) return;
      if (!j || !j.icon_url) {
        busy.innerHTML =
          '<div class="chead">' +
            '<span class="dot" style="--c:#00af54"></span>' +
            '<span class="svc">Modrinth project “' + esc(slug) + '”</span>' +
            '<span class="pill warn">Could not resolve</span>' +
          '</div>' +
          '<div class="notice"><p>' +
            (j ? 'This project has no icon, or the slug is invalid.' : 'The Modrinth API could not be reached — try again shortly.') +
          '</p></div>';
        bumpStatus();
        return;
      }
      var a = CORE.analyze(j.icon_url);
      a.kindLabel = 'project icon';
      a.serviceName = 'Modrinth';
      if (j.title) a.notes.unshift('Project: ' + j.title);
      a.notes.push('Resolved via Modrinth API');
      var card = resultCard(a);
      busy.replaceWith(card);
      startPipeline(card, a);
    });
  }

  function resolveSteam(appId) {
    var busy = cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#66c0f4"></span>' +
        '<span class="svc">Steam app ' + esc(appId) + '</span>' +
        '<span class="pill busy">Resolving header art…</span>' +
      '</div>'
    );

    fetchJson('https://store.steampowered.com/api/appdetails?appids=' + appId).then(function (j) {
      if (!busy.isConnected) return;
      var data = j && j[appId] && j[appId].data;
      if (!data || !data.header_image) {
        busy.innerHTML =
          '<div class="chead">' +
            '<span class="dot" style="--c:#66c0f4"></span>' +
            '<span class="svc">Steam app ' + esc(appId) + '</span>' +
            '<span class="pill warn">Could not resolve</span>' +
          '</div>' +
          '<div class="notice"><p>' +
            (j && j[appId] && !j[appId].success
              ? 'No Steam app exists with that ID.'
              : 'The Steam API could not be reached — try again shortly.') +
          '</p></div>';
        bumpStatus();
        return;
      }
      var a = CORE.analyze(data.header_image);
      a.kindLabel = 'header art';
      a.serviceName = 'Steam';
      if (data.name) a.notes.unshift(data.name);
      a.notes.push('Resolved via Steam Store API');
      var card = resultCard(a);
      busy.replaceWith(card);
      startPipeline(card, a);
    });
  }

  function resolveYouTube(videoId) {
    var imageUrl = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
    var a = CORE.analyze(imageUrl);
    a.kindLabel = 'thumbnail';
    a.serviceName = 'YouTube';
    a.notes.unshift('Video ID: ' + videoId);
    startPipeline(resultCard(a), a);
  }

  function resolveGitHub(username) {
    var inputUrl = 'https://github.com/' + encodeURIComponent(username) + '.png';
    var enhancedUrl = 'https://avatars.githubusercontent.com/' + encodeURIComponent(username) + '?s=460';
    var a = {
      input: inputUrl,
      candidates: [enhancedUrl],
      name: 'GitHub',
      color: '#9aa4b2',
      notes: ['GitHub user: @' + username, 'Paste a profile link → avatar at 460px'],
      kindLabel: 'avatar',
      serviceName: 'GitHub'
    };
    startPipeline(resultCard(a), a);
  }

  function resolveAppStore(appId) {
    var busy = cardShell(
      '<div class="chead">' +
        '<span class="dot" style="--c:#a2aaad"></span>' +
        '<span class="svc">App Store app ' + esc(appId) + '</span>' +
        '<span class="pill busy">Resolving icon…</span>' +
      '</div>'
    );

    fetchJson('https://itunes.apple.com/lookup?id=' + appId).then(function (j) {
      if (!busy.isConnected) return;
      var r = j && j.results && j.results[0];
      if (!r || (!r.artworkUrl1024 && !r.artworkUrl512)) {
        busy.innerHTML =
          '<div class="chead">' +
            '<span class="dot" style="--c:#a2aaad"></span>' +
            '<span class="svc">App Store app ' + esc(appId) + '</span>' +
            '<span class="pill warn">Could not resolve</span>' +
          '</div>' +
          '<div class="notice"><p>' +
            (r ? 'This app has no artwork available.' : 'No App Store app exists with that ID.') +
          '</p></div>';
        bumpStatus();
        return;
      }
      var artUrl = r.artworkUrl1024 || r.artworkUrl512;
      var a = CORE.analyze(artUrl);
      a.kindLabel = 'app icon';
      a.serviceName = 'App Store';
      if (r.trackName) a.notes.unshift(r.trackName);
      a.notes.push('Resolved via iTunes Lookup API');
      var card = resultCard(a);
      busy.replaceWith(card);
      startPipeline(card, a);
    });
  }

  function run() {
    var items = parseInput();
    if (!items.length) {
      toast('Paste a link or Discord user ID first');
      ta.focus();
      return;
    }
    runBtn.disabled = true;
    done = 0;
    total = items.length;
    statusEl.hidden = false;
    statusEl.textContent = 'Processed 0 of ' + total + '…';
    grid.innerHTML = '';
    items.forEach(function (item) {
      if (item.type === 'did') resolveProfile(item.tok);
      else if (item.type === 'cf') resolveCf(item.game, item.category, item.tok);
      else if (item.type === 'mr') resolveModrinth(item.tok);
      else if (item.type === 'steam') resolveSteam(item.tok);
      else if (item.type === 'yt') resolveYouTube(item.tok);
      else if (item.type === 'gh') resolveGitHub(item.tok);
      else if (item.type === 'apple') resolveAppStore(item.tok);
      else if (item.type === 'dname') resolveByName(item.tok);
      else processUrl(item.tok);
    });
  }

  runBtn.addEventListener('click', run);

  clearBtn.addEventListener('click', function () {
    ta.value = '';
    grid.innerHTML = '';
    statusEl.hidden = true;
    ta.focus();
  });

  ta.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  });

  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (chip) {
    chip.addEventListener('click', function () {
      ta.value = chip.getAttribute('data-u');
      run();
      ta.scrollIntoView({ block: 'nearest' });
    });
  });

  grid.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var box = e.target.closest('.imgbox');
    if (box && box.querySelector('img')) {
      window.open(box.querySelector('img').src, '_blank', 'noopener');
      return;
    }
    var btn = e.target.closest('.actions button');
    if (!btn || btn.disabled) return;
    var card = btn.closest('.card');
    var url = card.dataset.url;
    if (!url) return;
    var act = btn.getAttribute('data-act');
    if (act === 'copy') copyText(url);
    else if (act === 'download') download(url, card.dataset.name || 'image');
    else if (act === 'open') window.open(url, '_blank', 'noopener');
  });

  ta.focus();
})();
