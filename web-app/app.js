// app.js — Quietube: minimal, single-video, no-suggestions YouTube search

(function () {
  'use strict';

  /* ---------- Storage (safe wrapper — localStorage is blocked in the
     sandboxed preview iframe but works fine once the site is published) --- */

  var memoryStore = {};
  function safeGet(key) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? memoryStore[key] || null : v;
    } catch (e) {
      return memoryStore[key] || null;
    }
  }
  function safeSet(key, val) {
    memoryStore[key] = val;
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {
      /* ignore — memory fallback already set */
    }
  }
  function safeRemove(key) {
    delete memoryStore[key];
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
  }

  /* ---------- State ---------- */

  var state = {
    apiKey: safeGet('qt_api_key') || '',
    resultCount: parseInt(safeGet('qt_result_count') || '5', 10),
    namesOnly: safeGet('qt_names_only') === '1',
    showChannels: safeGet('qt_show_channels') === '1',
    dangerMode: safeGet('qt_danger_mode') === '1',
    player: null,
    currentChannel: null,
    currentPlaylist: null,
    playerReturnView: 'search',
    channelVideosNextPageToken: null,
    channelVideosRenderedCount: 0,
    channelPlaylistsNextPageToken: null,
    channelPlaylistsRenderedCount: 0,
    playlistVideosNextPageToken: null,
    playlistVideosRenderedCount: 0,
  };

  /* ---------- Element refs ---------- */

  var els = {
    views: {
      setup: document.getElementById('view-setup'),
      search: document.getElementById('view-search'),
      channel: document.getElementById('view-channel'),
      playlist: document.getElementById('view-playlist'),
      player: document.getElementById('view-player'),
    },
    setupForm: document.getElementById('setup-form'),
    setupKeyInput: document.getElementById('setup-key-input'),
    setupError: document.getElementById('setup-error'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    resultsArea: document.getElementById('results-area'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    settingsClose: document.getElementById('settings-close'),
    countDecrement: document.getElementById('count-decrement'),
    countIncrement: document.getElementById('count-increment'),
    countValue: document.getElementById('count-value'),
    namesOnlyToggle: document.getElementById('names-only-toggle'),
    showChannelsToggle: document.getElementById('show-channels-toggle'),
    dangerModeToggle: document.getElementById('danger-mode-toggle'),
    forgetKeyBtn: document.getElementById('forget-key-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    channelBackBtn: document.getElementById('channel-back-btn'),
    channelAvatar: document.getElementById('channel-avatar'),
    channelTitle: document.getElementById('channel-title'),
    channelSubtitle: document.getElementById('channel-subtitle'),
    channelResultsArea: document.getElementById('channel-results-area'),
    channelVideosLoadMoreBtn: document.getElementById('channel-videos-load-more-btn'),
    channelPlaylistsSection: document.getElementById('channel-playlists-section'),
    channelPlaylistsArea: document.getElementById('channel-playlists-area'),
    channelPlaylistsLoadMoreBtn: document.getElementById('channel-playlists-load-more-btn'),
    playlistBackBtn: document.getElementById('playlist-back-btn'),
    playlistAvatar: document.getElementById('playlist-avatar'),
    playlistTitle: document.getElementById('playlist-title'),
    playlistResultsArea: document.getElementById('playlist-results-area'),
    playlistLoadMoreBtn: document.getElementById('playlist-load-more-btn'),
    playerContainer: document.getElementById('player-container'),
    playerTitle: document.getElementById('player-title'),
    playerBackBtn: document.getElementById('player-back-btn'),
    playerWrap: document.getElementById('player-frame-wrap'),
    finishedCard: document.getElementById('finished-card'),
    searchAgainBtn: document.getElementById('search-again-btn'),
  };

  /* ---------- View switching ---------- */

  function showView(name) {
    Object.keys(els.views).forEach(function (key) {
      els.views[key].hidden = key !== name;
    });
  }

  function getVisibleView() {
    var found = 'search';
    Object.keys(els.views).forEach(function (key) {
      if (!els.views[key].hidden) found = key;
    });
    return found;
  }

  /* ---------- Theme ---------- */

  (function initTheme() {
    var root = document.documentElement;
    var stored = safeGet('qt_theme');
    var mode = stored || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    root.setAttribute('data-theme', mode);
    updateThemeIcon(mode);
    els.themeToggle.addEventListener('click', function () {
      mode = mode === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', mode);
      safeSet('qt_theme', mode);
      updateThemeIcon(mode);
    });
  })();

  function updateThemeIcon(mode) {
    els.themeToggle.setAttribute('aria-label', 'Switch to ' + (mode === 'dark' ? 'light' : 'dark') + ' mode');
    els.themeToggle.innerHTML =
      mode === 'dark'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  /* ---------- Setup / API key ---------- */

  function hasKey() {
    return !!state.apiKey;
  }

  els.setupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var val = els.setupKeyInput.value.trim();
    if (!val) {
      els.setupError.textContent = 'Please paste a key to continue.';
      return;
    }
    state.apiKey = val;
    safeSet('qt_api_key', val);
    els.setupError.textContent = '';
    resolveInitialView();
  });

  els.forgetKeyBtn.addEventListener('click', function () {
    safeRemove('qt_api_key');
    state.apiKey = '';
    closeSettings();
    showView('setup');
    els.setupKeyInput.value = '';
    els.setupKeyInput.focus();
  });

  /* ---------- Settings modal ---------- */

  function renderSettings() {
    els.countValue.textContent = String(state.resultCount);
    els.namesOnlyToggle.setAttribute('aria-checked', state.namesOnly ? 'true' : 'false');
    els.showChannelsToggle.setAttribute('aria-checked', state.showChannels ? 'true' : 'false');
    els.dangerModeToggle.setAttribute('aria-checked', state.dangerMode ? 'true' : 'false');
  }

  function openSettings() {
    renderSettings();
    els.settingsModal.hidden = false;
  }
  function closeSettings() {
    els.settingsModal.hidden = true;
  }

  els.settingsBtn.addEventListener('click', openSettings);
  els.settingsClose.addEventListener('click', closeSettings);
  els.settingsModal.addEventListener('click', function (e) {
    if (e.target === els.settingsModal) closeSettings();
  });

  els.countDecrement.addEventListener('click', function () {
    state.resultCount = Math.max(3, state.resultCount - 1);
    safeSet('qt_result_count', String(state.resultCount));
    renderSettings();
  });
  els.countIncrement.addEventListener('click', function () {
    state.resultCount = Math.min(8, state.resultCount + 1);
    safeSet('qt_result_count', String(state.resultCount));
    renderSettings();
  });
  els.namesOnlyToggle.addEventListener('click', function () {
    state.namesOnly = !state.namesOnly;
    safeSet('qt_names_only', state.namesOnly ? '1' : '0');
    renderSettings();
  });
  els.showChannelsToggle.addEventListener('click', function () {
    state.showChannels = !state.showChannels;
    safeSet('qt_show_channels', state.showChannels ? '1' : '0');
    renderSettings();
  });
  els.dangerModeToggle.addEventListener('click', function () {
    state.dangerMode = !state.dangerMode;
    safeSet('qt_danger_mode', state.dangerMode ? '1' : '0');
    renderSettings();
  });

  /* ---------- Search ---------- */

  // When channels are shown, we look for a channel whose name is an exact or
  // very-near-exact match to the query within a wider net of results than we
  // actually display, so a matching channel surfaces even if it wouldn't rank
  // in the normal capped list. The visible cap itself never changes — a
  // matched channel is added on top of it, not instead of it.
  var CHANNEL_MATCH_SEARCH_DEPTH = 20;

  function normalizeForMatch(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function levenshteinDistance(a, b) {
    var m = a.length;
    var n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    var prevRow = [];
    for (var j = 0; j <= n; j++) prevRow[j] = j;
    for (var i = 1; i <= m; i++) {
      var currRow = [i];
      for (j = 1; j <= n; j++) {
        currRow[j] =
          a[i - 1] === b[j - 1]
            ? prevRow[j - 1]
            : 1 + Math.min(prevRow[j - 1], prevRow[j], currRow[j - 1]);
      }
      prevRow = currRow;
    }
    return prevRow[n];
  }

  function isNearExactChannelMatch(channelTitle, query) {
    var a = normalizeForMatch(channelTitle);
    var b = normalizeForMatch(query);
    if (!a || !b) return false;
    if (a === b) return true;
    var maxLen = Math.max(a.length, b.length);
    var threshold = maxLen <= 4 ? 0 : maxLen <= 8 ? 1 : 2;
    return levenshteinDistance(a, b) <= threshold;
  }

  // Combines the normal capped display list with a guaranteed-visible
  // near-exact channel match found anywhere in the wider fetched pool.
  function buildDisplayItems(query, items) {
    var displayItems = items.slice(0, state.resultCount);
    if (!state.showChannels) return displayItems;

    var matched = null;
    for (var i = 0; i < items.length; i++) {
      var candidate = items[i];
      var isChannel = candidate.id && candidate.id.kind === 'youtube#channel';
      if (isChannel && isNearExactChannelMatch(candidate.snippet && candidate.snippet.title, query)) {
        matched = candidate;
        break;
      }
    }
    if (matched) {
      var alreadyShown = displayItems.some(function (it) {
        return it.id && it.id.channelId && matched.id && it.id.channelId === matched.id.channelId;
      });
      if (!alreadyShown) {
        matched._pinnedMatch = true;
        displayItems = displayItems.concat([matched]);
      }
    }
    return displayItems;
  }

  function parseTimeParam(raw) {
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
    var m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (m && (m[1] || m[2] || m[3])) {
      var h = parseInt(m[1] || '0', 10);
      var mi = parseInt(m[2] || '0', 10);
      var s = parseInt(m[3] || '0', 10);
      return h * 3600 + mi * 60 + s;
    }
    var n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  // Recognizes a pasted YouTube URL (watch/shorts/embed/live/youtu.be, with
  // or without a scheme) and pulls out the video ID + start time, so typing
  // or pasting a link into the search bar jumps straight to the player
  // instead of running it as a text search.
  function parseYouTubeUrl(text) {
    text = (text || '').trim();
    if (!text) return null;

    var url;
    try {
      var withScheme = /^https?:\/\//i.test(text) ? text : 'https://' + text;
      url = new URL(withScheme);
    } catch (e) {
      return null;
    }

    var host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    var videoId = null;

    if (host === 'youtu.be') {
      videoId = url.pathname.replace(/^\//, '').split('/')[0] || null;
    } else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else {
        var m = url.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]+)/);
        if (m) videoId = m[2];
      }
    } else {
      return null;
    }

    if (!videoId || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null;

    var startRaw = url.searchParams.get('t') || url.searchParams.get('time_continue') || url.searchParams.get('start');
    return { videoId: videoId, start: parseTimeParam(startRaw) };
  }

  els.searchForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = els.searchInput.value.trim();
    if (!q) return;
    var pasted = parseYouTubeUrl(q);
    if (pasted) {
      playVideo(pasted.videoId, '', pasted.start);
      return;
    }
    runSearch(q);
  });

  els.searchAgainBtn.addEventListener('click', function () {
    stopPlayback();
    showView('search');
    els.searchInput.value = '';
    els.searchInput.focus();
    els.resultsArea.innerHTML = '';
  });

  function renderSkeleton(container, namesOnly) {
    var count = namesOnly ? 3 : state.resultCount;
    var html = '<div class="skeleton-grid' + (namesOnly ? ' names-only' : '') + '">';
    for (var i = 0; i < count; i++) {
      html += namesOnly
        ? '<div class="skeleton-card"><div class="skeleton-line"></div></div>'
        : '<div class="skeleton-card"><div class="skeleton-thumb"></div><div class="skeleton-line"></div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function runSearch(query) {
    renderSkeleton(els.resultsArea, state.namesOnly);

    var endpoint = 'https://www.googleapis.com/youtube/v3/search';
    var fetchCount = state.showChannels ? CHANNEL_MATCH_SEARCH_DEPTH : state.resultCount;
    var params = new URLSearchParams({
      part: 'snippet',
      type: state.showChannels ? 'video,channel' : 'video',
      maxResults: String(fetchCount),
      q: query,
      key: state.apiKey,
      fields:
        'items(id/kind,id/videoId,id/channelId,snippet/title,snippet/thumbnails/medium/url,snippet/thumbnails/high/url,snippet/thumbnails/default/url)',
    });

    fetch(endpoint + '?' + params.toString())
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            var msg = (body && body.error && body.error.message) || 'Search failed (' + res.status + ').';
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        renderResults(query, buildDisplayItems(query, data.items || []));
      })
      .catch(function (err) {
        renderError(els.resultsArea, err.message);
      });
  }

  function renderError(container, message) {
    container.innerHTML =
      '<div class="state-message">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>' +
      '<p>' +
      escapeHtml(message) +
      '</p>' +
      '<button class="btn btn-ghost" id="fix-key-btn" type="button">Check API key in settings</button>' +
      '</div>';
    var fixBtn = container.querySelector('#fix-key-btn');
    if (fixBtn) fixBtn.addEventListener('click', openSettings);
  }

  /* ---------- Result card rendering (shared between search results and
     the per-channel video list) ---------- */

  function pickThumb(snippet) {
    var t = snippet && snippet.thumbnails;
    return t && (t.medium || t.high || t.default);
  }

  function videoCardHtml(item, index, namesOnly) {
    var videoId = item.id && item.id.videoId;
    if (!videoId) return '';
    var title = (item.snippet && item.snippet.title) || 'Untitled video';
    var thumb = pickThumb(item.snippet);

    if (namesOnly) {
      return (
        '<button class="result-card" role="listitem" data-type="video" data-video-id="' +
        videoId +
        '" data-title="' +
        escapeHtml(title) +
        '">' +
        '<span class="result-index">' +
        (index + 1) +
        '</span>' +
        '<span class="result-title">' +
        escapeHtml(title) +
        '</span>' +
        '</button>'
      );
    }

    return (
      '<button class="result-card" role="listitem" data-type="video" data-video-id="' +
      videoId +
      '" data-title="' +
      escapeHtml(title) +
      '">' +
      '<span class="result-thumb">' +
      (thumb ? '<img src="' + escapeHtml(thumb.url) + '" alt="" loading="lazy" width="320" height="180">' : '') +
      '<span class="play-badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' +
      '</span>' +
      '<span class="result-title">' +
      escapeHtml(title) +
      '</span>' +
      '</button>'
    );
  }

  function channelCardHtml(item, index, namesOnly) {
    var channelId = item.id && item.id.channelId;
    if (!channelId) return '';
    var title = (item.snippet && item.snippet.title) || 'Untitled channel';
    var thumb = pickThumb(item.snippet);
    var thumbUrl = thumb ? thumb.url : '';
    var isMatch = !!item._pinnedMatch;
    var chipLabel = isMatch ? 'Matched' : 'Channel';
    var chipClass = 'channel-chip' + (isMatch ? ' channel-chip--match' : '');
    var cardMatchClass = isMatch ? ' result-card--channel-match' : '';

    if (namesOnly) {
      return (
        '<button class="result-card' + cardMatchClass + '" role="listitem" data-type="channel" data-channel-id="' +
        channelId +
        '" data-title="' +
        escapeHtml(title) +
        '" data-thumb="' +
        escapeHtml(thumbUrl) +
        '">' +
        '<span class="result-index">' +
        (index + 1) +
        '</span>' +
        '<span class="result-title">' +
        escapeHtml(title) +
        '</span>' +
        '<span class="' + chipClass + '">' + chipLabel + '</span>' +
        '</button>'
      );
    }

    return (
      '<button class="result-card result-card--channel' + cardMatchClass + '" role="listitem" data-type="channel" data-channel-id="' +
      channelId +
      '" data-title="' +
      escapeHtml(title) +
      '" data-thumb="' +
      escapeHtml(thumbUrl) +
      '">' +
      '<span class="channel-avatar-wrap">' +
      (thumbUrl ? '<img src="' + escapeHtml(thumbUrl) + '" alt="" loading="lazy">' : '') +
      '</span>' +
      '<span class="result-title">' +
      escapeHtml(title) +
      '</span>' +
      '<span class="' + chipClass + '">' + chipLabel + '</span>' +
      '</button>'
    );
  }

  function playlistCardHtml(item, index, namesOnly) {
    var playlistId = item.id;
    if (!playlistId || typeof playlistId !== 'string') return '';
    var title = (item.snippet && item.snippet.title) || 'Untitled playlist';
    var thumb = pickThumb(item.snippet);
    var thumbUrl = thumb ? thumb.url : '';
    var itemCount = (item.contentDetails && item.contentDetails.itemCount) || 0;
    var countLabel = itemCount + (itemCount === 1 ? ' video' : ' videos');
    var stackIcon =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h11a2 2 0 0 1 2 2v11"/></svg>';

    if (namesOnly) {
      return (
        '<button class="result-card" role="listitem" data-type="playlist" data-playlist-id="' +
        playlistId +
        '" data-title="' +
        escapeHtml(title) +
        '" data-thumb="' +
        escapeHtml(thumbUrl) +
        '">' +
        '<span class="result-index">' +
        (index + 1) +
        '</span>' +
        '<span class="result-title">' +
        escapeHtml(title) +
        '</span>' +
        '<span class="channel-chip">' + escapeHtml(countLabel) + '</span>' +
        '</button>'
      );
    }

    return (
      '<button class="result-card" role="listitem" data-type="playlist" data-playlist-id="' +
      playlistId +
      '" data-title="' +
      escapeHtml(title) +
      '" data-thumb="' +
      escapeHtml(thumbUrl) +
      '">' +
      '<span class="result-thumb">' +
      (thumbUrl ? '<img src="' + escapeHtml(thumbUrl) + '" alt="" loading="lazy" width="320" height="180">' : '') +
      '<span class="playlist-badge">' + stackIcon + escapeHtml(countLabel) + '</span>' +
      '</span>' +
      '<span class="result-title">' +
      escapeHtml(title) +
      '</span>' +
      '</button>'
    );
  }

  function cardsHtml(items, namesOnly, startIndex) {
    var offset = startIndex || 0;
    var html = '';
    items.forEach(function (item, i) {
      if (item._isPlaylist) {
        html += playlistCardHtml(item, offset + i, namesOnly);
      } else if (item.id && item.id.kind === 'youtube#channel') {
        html += channelCardHtml(item, offset + i, namesOnly);
      } else {
        html += videoCardHtml(item, offset + i, namesOnly);
      }
    });
    return html;
  }

  function itemsToGrid(items, namesOnly, startIndex) {
    return (
      '<div class="results-grid' + (namesOnly ? ' names-only' : '') + '" role="list">' +
      cardsHtml(items, namesOnly, startIndex) +
      '</div>'
    );
  }

  function ensureCardDelegation(container) {
    if (container.__qtDelegated) return;
    container.__qtDelegated = true;
    container.addEventListener('click', function (e) {
      var card = e.target.closest('.result-card');
      if (!card || !container.contains(card)) return;
      var type = card.getAttribute('data-type');
      if (type === 'channel') {
        openChannel(
          card.getAttribute('data-channel-id'),
          card.getAttribute('data-title'),
          card.getAttribute('data-thumb')
        );
      } else if (type === 'playlist') {
        openPlaylist(
          card.getAttribute('data-playlist-id'),
          card.getAttribute('data-title'),
          card.getAttribute('data-thumb')
        );
      } else {
        playVideo(card.getAttribute('data-video-id'), card.getAttribute('data-title'));
      }
    });
  }

  function renderResults(query, items) {
    if (!items.length) {
      els.resultsArea.innerHTML =
        '<div class="state-message">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<p>No results for &ldquo;' +
        escapeHtml(query) +
        '&rdquo;. Try another search.</p>' +
        '</div>';
      return;
    }

    var meta =
      '<div class="results-meta"><h2><strong>' +
      items.length +
      '</strong> results for &ldquo;' +
      escapeHtml(query) +
      '&rdquo;</h2></div>';

    els.resultsArea.innerHTML = meta + itemsToGrid(items, state.namesOnly, 0);
    ensureCardDelegation(els.resultsArea);
  }

  /* ---------- Channel view ---------- */

  function openChannel(channelId, title, thumbUrl) {
    if (!channelId) return;
    state.currentChannel = { id: channelId, title: title, thumb: thumbUrl };
    state.channelVideosNextPageToken = null;
    state.channelVideosRenderedCount = 0;
    state.channelPlaylistsNextPageToken = null;
    state.channelPlaylistsRenderedCount = 0;
    showView('channel');
    els.channelTitle.textContent = title || 'Channel';
    if (thumbUrl) {
      els.channelAvatar.src = thumbUrl;
      els.channelAvatar.alt = title ? title + ' avatar' : '';
      els.channelAvatar.style.visibility = 'visible';
    } else {
      els.channelAvatar.removeAttribute('src');
      els.channelAvatar.style.visibility = 'hidden';
    }
    els.channelSubtitle.textContent = state.dangerMode
      ? 'Danger mode is on — browse every video and playlist this channel has, a page at a time. Playback is still one video, no autoplay.'
      : "A short list of this channel's recent videos — still no feed, no autoplay, no infinite scroll.";

    els.channelVideosLoadMoreBtn.hidden = true;
    els.channelPlaylistsSection.hidden = true;
    els.channelPlaylistsArea.innerHTML = '';

    renderSkeleton(els.channelResultsArea, state.namesOnly);
    fetchChannelVideos(channelId, null);
    if (state.dangerMode) {
      fetchChannelPlaylists(channelId, null);
    }
  }

  function fetchChannelVideos(channelId, pageToken) {
    var endpoint = 'https://www.googleapis.com/youtube/v3/search';
    var maxResults = state.dangerMode ? 50 : state.resultCount;
    var params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'date',
      channelId: channelId,
      maxResults: String(maxResults),
      key: state.apiKey,
      fields:
        'nextPageToken,items(id/kind,id/videoId,snippet/title,snippet/thumbnails/medium/url,snippet/thumbnails/high/url)',
    });
    if (pageToken) params.set('pageToken', pageToken);

    fetch(endpoint + '?' + params.toString())
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            var msg = (body && body.error && body.error.message) || "Couldn't load this channel (" + res.status + ').';
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        state.channelVideosNextPageToken = state.dangerMode ? data.nextPageToken || null : null;
        renderChannelResults(data.items || [], !!pageToken);
        els.channelVideosLoadMoreBtn.hidden = !state.channelVideosNextPageToken;
      })
      .catch(function (err) {
        renderError(els.channelResultsArea, err.message);
      });
  }

  function renderChannelResults(items, append) {
    if (!append && !items.length) {
      els.channelResultsArea.innerHTML =
        '<div class="state-message">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<p>No videos found on this channel.</p>' +
        '</div>';
      return;
    }
    if (append) {
      var grid = els.channelResultsArea.querySelector('.results-grid');
      if (grid) {
        grid.insertAdjacentHTML('beforeend', cardsHtml(items, state.namesOnly, state.channelVideosRenderedCount));
      } else {
        els.channelResultsArea.innerHTML = itemsToGrid(items, state.namesOnly, state.channelVideosRenderedCount);
      }
    } else {
      els.channelResultsArea.innerHTML = itemsToGrid(items, state.namesOnly, 0);
    }
    state.channelVideosRenderedCount += items.length;
    ensureCardDelegation(els.channelResultsArea);
  }

  function fetchChannelPlaylists(channelId, pageToken) {
    var endpoint = 'https://www.googleapis.com/youtube/v3/playlists';
    var params = new URLSearchParams({
      part: 'snippet,contentDetails',
      channelId: channelId,
      maxResults: '50',
      key: state.apiKey,
      fields:
        'nextPageToken,items(id,contentDetails/itemCount,snippet/title,snippet/thumbnails/medium/url,snippet/thumbnails/high/url)',
    });
    if (pageToken) params.set('pageToken', pageToken);

    fetch(endpoint + '?' + params.toString())
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            var msg = (body && body.error && body.error.message) || "Couldn't load playlists (" + res.status + ').';
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        var items = (data.items || []).map(function (it) {
          it._isPlaylist = true;
          return it;
        });
        state.channelPlaylistsNextPageToken = data.nextPageToken || null;
        renderChannelPlaylists(items, !!pageToken);
        els.channelPlaylistsLoadMoreBtn.hidden = !state.channelPlaylistsNextPageToken;
      })
      .catch(function (err) {
        renderError(els.channelPlaylistsArea, err.message);
      });
  }

  function renderChannelPlaylists(items, append) {
    if (!append && !items.length) {
      els.channelPlaylistsSection.hidden = true;
      return;
    }
    els.channelPlaylistsSection.hidden = false;
    if (append) {
      var grid = els.channelPlaylistsArea.querySelector('.results-grid');
      if (grid) {
        grid.insertAdjacentHTML(
          'beforeend',
          cardsHtml(items, state.namesOnly, state.channelPlaylistsRenderedCount)
        );
      } else {
        els.channelPlaylistsArea.innerHTML = itemsToGrid(items, state.namesOnly, state.channelPlaylistsRenderedCount);
      }
    } else {
      els.channelPlaylistsArea.innerHTML = itemsToGrid(items, state.namesOnly, 0);
    }
    state.channelPlaylistsRenderedCount += items.length;
    ensureCardDelegation(els.channelPlaylistsArea);
  }

  els.channelVideosLoadMoreBtn.addEventListener('click', function () {
    if (!state.currentChannel || !state.channelVideosNextPageToken) return;
    fetchChannelVideos(state.currentChannel.id, state.channelVideosNextPageToken);
  });

  els.channelPlaylistsLoadMoreBtn.addEventListener('click', function () {
    if (!state.currentChannel || !state.channelPlaylistsNextPageToken) return;
    fetchChannelPlaylists(state.currentChannel.id, state.channelPlaylistsNextPageToken);
  });

  els.channelBackBtn.addEventListener('click', function () {
    showView('search');
  });

  /* ---------- Playlist view (danger mode only) ---------- */

  function openPlaylist(playlistId, title, thumbUrl) {
    if (!playlistId) return;
    state.currentPlaylist = { id: playlistId, title: title, thumb: thumbUrl };
    state.playlistVideosNextPageToken = null;
    state.playlistVideosRenderedCount = 0;
    showView('playlist');
    els.playlistTitle.textContent = title || 'Playlist';
    if (thumbUrl) {
      els.playlistAvatar.src = thumbUrl;
      els.playlistAvatar.alt = title ? title + ' thumbnail' : '';
      els.playlistAvatar.style.visibility = 'visible';
    } else {
      els.playlistAvatar.removeAttribute('src');
      els.playlistAvatar.style.visibility = 'hidden';
    }
    els.playlistLoadMoreBtn.hidden = true;
    renderSkeleton(els.playlistResultsArea, state.namesOnly);
    fetchPlaylistVideos(playlistId, null);
  }

  function fetchPlaylistVideos(playlistId, pageToken) {
    var endpoint = 'https://www.googleapis.com/youtube/v3/playlistItems';
    var params = new URLSearchParams({
      part: 'snippet',
      playlistId: playlistId,
      maxResults: '50',
      key: state.apiKey,
      fields:
        'nextPageToken,items(snippet/title,snippet/resourceId/kind,snippet/resourceId/videoId,snippet/thumbnails/medium/url,snippet/thumbnails/high/url)',
    });
    if (pageToken) params.set('pageToken', pageToken);

    fetch(endpoint + '?' + params.toString())
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (body) {
            var msg = (body && body.error && body.error.message) || "Couldn't load this playlist (" + res.status + ').';
            throw new Error(msg);
          });
        }
        return res.json();
      })
      .then(function (data) {
        var raw = data.items || [];
        var videos = raw
          .filter(function (it) {
            var rid = it.snippet && it.snippet.resourceId;
            var title = it.snippet && it.snippet.title;
            return (
              rid &&
              rid.kind === 'youtube#video' &&
              title !== 'Private video' &&
              title !== 'Deleted video'
            );
          })
          .map(function (it) {
            return {
              id: { kind: 'youtube#video', videoId: it.snippet.resourceId.videoId },
              snippet: it.snippet,
            };
          });
        state.playlistVideosNextPageToken = data.nextPageToken || null;
        renderPlaylistResults(videos, !!pageToken);
        els.playlistLoadMoreBtn.hidden = !state.playlistVideosNextPageToken;
      })
      .catch(function (err) {
        renderError(els.playlistResultsArea, err.message);
      });
  }

  function renderPlaylistResults(items, append) {
    if (!append && !items.length) {
      els.playlistResultsArea.innerHTML =
        '<div class="state-message">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
        '<p>No playable videos found in this playlist.</p>' +
        '</div>';
      return;
    }
    if (append) {
      var grid = els.playlistResultsArea.querySelector('.results-grid');
      if (grid) {
        grid.insertAdjacentHTML('beforeend', cardsHtml(items, state.namesOnly, state.playlistVideosRenderedCount));
      } else {
        els.playlistResultsArea.innerHTML = itemsToGrid(items, state.namesOnly, state.playlistVideosRenderedCount);
      }
    } else {
      els.playlistResultsArea.innerHTML = itemsToGrid(items, state.namesOnly, 0);
    }
    state.playlistVideosRenderedCount += items.length;
    ensureCardDelegation(els.playlistResultsArea);
  }

  els.playlistLoadMoreBtn.addEventListener('click', function () {
    if (!state.currentPlaylist || !state.playlistVideosNextPageToken) return;
    fetchPlaylistVideos(state.currentPlaylist.id, state.playlistVideosNextPageToken);
  });

  els.playlistBackBtn.addEventListener('click', function () {
    showView('channel');
  });

  /* ---------- Player ---------- */

  var ytApiPromise = null;
  function loadYouTubeApi() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise(function (resolve) {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }
      var prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prevReady === 'function') prevReady();
        resolve();
      };
      var tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
    return ytApiPromise;
  }

  function playVideo(videoId, title, startSeconds) {
    if (!videoId) return;
    state.playerReturnView = getVisibleView();
    showView('player');
    els.playerTitle.textContent = title || '';
    els.finishedCard.hidden = true;
    els.playerWrap.hidden = false;
    els.playerContainer.innerHTML = '';

    var mount = document.createElement('div');
    mount.id = 'yt-mount';
    els.playerContainer.appendChild(mount);

    var playerVars = {
      autoplay: 1,
      mute: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      playsinline: 1,
      fs: 1,
      origin: window.location.origin,
    };
    if (startSeconds && startSeconds > 0) {
      playerVars.start = startSeconds;
    }

    loadYouTubeApi().then(function () {
      state.player = new YT.Player('yt-mount', {
        videoId: videoId,
        playerVars: playerVars,
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    });
  }

  function onPlayerReady(event) {
    // Belt-and-suspenders: playerVars.mute=1 above is normally enough, but
    // explicitly muting via the JS API too guards against any embed context
    // (e.g. Shorts IDs, or browsers with stricter autoplay policies) where
    // the URL param alone doesn't reliably suppress sound on autoplay.
    try {
      event.target.mute();
    } catch (e) {}
  }

  function onPlayerStateChange(event) {
    if (window.YT && event.data === YT.PlayerState.ENDED) {
      showFinished();
    }
  }

  function showFinished() {
    destroyPlayer();
    els.playerWrap.hidden = true;
    els.finishedCard.hidden = false;
  }

  function destroyPlayer() {
    if (state.player) {
      try {
        state.player.destroy();
      } catch (e) {}
      state.player = null;
    }
    els.playerContainer.innerHTML = '';
  }

  function stopPlayback() {
    destroyPlayer();
    els.playerWrap.hidden = false;
    els.finishedCard.hidden = true;
  }

  els.playerBackBtn.addEventListener('click', function () {
    stopPlayback();
    var target = state.playerReturnView;
    if (target !== 'channel' && target !== 'playlist') target = 'search';
    showView(target);
  });

  /* ---------- Deep links (from the Quietube Redirector browser extension) ----------
     Supports:
       ?v=VIDEO_ID&t=147            (from youtube.com/watch, timestamp in seconds)
       ?v=VIDEO_ID&time_continue=147 (alternate timestamp param YouTube also uses)
       ?search_query=some+query     (from youtube.com/results) */

  function parseDeepLink() {
    var params = new URLSearchParams(window.location.search);
    var videoId = params.get('v');
    var startRaw = params.get('t') || params.get('time_continue') || params.get('start');
    var query = params.get('search_query') || params.get('q');
    return {
      videoId: videoId || null,
      start: parseTimeParam(startRaw),
      query: query || null,
    };
  }

  var deepLink = parseDeepLink();

  function resolveInitialView() {
    if (deepLink.videoId) {
      playVideo(deepLink.videoId, '', deepLink.start);
      return;
    }
    if (deepLink.query) {
      showView('search');
      els.searchInput.value = deepLink.query;
      runSearch(deepLink.query);
      return;
    }
    showView('search');
    els.searchInput.focus();
  }

  /* ---------- Init ---------- */

  if (hasKey()) {
    resolveInitialView();
  } else {
    showView('setup');
  }
})();
