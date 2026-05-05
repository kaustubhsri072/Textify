const http = require('http');
const https = require('https');
const url = require('url');
const { shell } = require('electron');
const store = require('./store');

const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public';

let accessToken = null;
let refreshToken = null;
let clientId = null;
let clientSecret = null;
let callbackServer = null;
let tokenExpiry = 0;

// ── Helpers ──────────────────────────────────────────────────

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function extractPlaylistId(playlistUrl) {
  // Supports:
  //   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
  //   https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123
  //   spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const match = playlistUrl.match(/playlist[/:]([a-zA-Z0-9]+)/);
  if (!match) throw new Error('Invalid Spotify playlist URL. Please paste a valid playlist link.');
  return match[1];
}

// ── Auth ─────────────────────────────────────────────────────

function authenticate(id, secret, parentWindow) {
  clientId = id;
  clientSecret = secret;

  return new Promise((resolve, reject) => {
    // Start local callback server
    if (callbackServer) {
      try { callbackServer.close(); } catch {}
    }

    callbackServer = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url, true);

      if (parsed.pathname === '/callback') {
        const code = parsed.query.code;
        const error = parsed.query.error;

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getCallbackHtml(false, 'Authorization denied. You can close this tab.'));
          reject(new Error('Authorization denied by user.'));
          return;
        }

        if (code) {
          try {
            await exchangeCodeForToken(code);
            const user = await getCurrentUser();
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getCallbackHtml(true, `Connected as ${user.display_name}! You can close this tab.`));
            resolve({ user });
          } catch (err) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getCallbackHtml(false, 'Authentication failed. Please try again.'));
            reject(err);
          }
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    callbackServer.listen(8888, '127.0.0.1', () => {
      const authUrl =
        `https://accounts.spotify.com/authorize?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&show_dialog=true`;

      shell.openExternal(authUrl);
    });

    callbackServer.on('error', (err) => {
      reject(new Error(`Could not start callback server: ${err.message}`));
    });
  });
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  }).toString();

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const { statusCode, data } = await httpsRequest(
    {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );

  if (statusCode !== 200) {
    throw new Error(data.error_description || 'Failed to exchange authorization code.');
  }

  accessToken = data.access_token;
  refreshToken = data.refresh_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  // Persist credentials for auto-reconnect on next launch
  store.save({
    clientId,
    clientSecret,
    refreshToken,
  });
}

async function refreshAccessToken() {
  if (!refreshToken) throw new Error('No refresh token available. Please reconnect.');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString();

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const { statusCode, data } = await httpsRequest(
    {
      hostname: 'accounts.spotify.com',
      path: '/api/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );

  if (statusCode !== 200) {
    throw new Error('Token refresh failed. Please reconnect.');
  }

  accessToken = data.access_token;
  if (data.refresh_token) refreshToken = data.refresh_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
}

async function ensureToken() {
  if (!accessToken) throw new Error('Not connected. Please connect to Spotify first.');
  if (Date.now() >= tokenExpiry - 60000) {
    await refreshAccessToken();
  }
}

// ── API Calls ────────────────────────────────────────────────

async function spotifyGet(endpoint) {
  await ensureToken();

  const { statusCode, data } = await httpsRequest({
    hostname: 'api.spotify.com',
    path: endpoint,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (statusCode === 401) {
    await refreshAccessToken();
    return spotifyGet(endpoint);
  }

  if (statusCode >= 400) {
    throw new Error(data?.error?.message ? `Spotify API Error on ${endpoint}: ${data.error.message} (${statusCode})` : `Spotify API error (${statusCode}) on ${endpoint}`);
  }

  return data;
}

async function spotifyDelete(endpoint) {
  await ensureToken();

  const { statusCode, data } = await httpsRequest({
    hostname: 'api.spotify.com',
    path: endpoint,
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (statusCode === 401) {
    await refreshAccessToken();
    return spotifyDelete(endpoint);
  }

  if (statusCode >= 400) {
    throw new Error(data?.error?.message ? `Spotify API Error on ${endpoint}: ${data.error.message} (${statusCode})` : `Spotify API error (${statusCode}) on ${endpoint}`);
  }

  return data;
}

async function spotifyPost(endpoint, body) {
  await ensureToken();

  const postData = JSON.stringify(body);
  const { statusCode, data } = await httpsRequest({
    hostname: 'api.spotify.com',
    path: endpoint,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);

  if (statusCode === 401) {
    await refreshAccessToken();
    return spotifyPost(endpoint, body);
  }

  if (statusCode >= 400) {
    throw new Error(data?.error?.message ? `Spotify API Error on ${endpoint}: ${data.error.message} (${statusCode})` : `Spotify API error (${statusCode}) on ${endpoint}`);
  }

  return data;
}

async function getCurrentUser() {
  return spotifyGet('/v1/me');
}

async function getPlaylistTracks(playlistUrl) {
  const playlistId = extractPlaylistId(playlistUrl);
  console.log('[Textify] Importing playlist:', playlistId);

  // Get playlist — Spotify returns tracks as `items` at the top level
  const playlist = await spotifyGet(`/v1/playlists/${playlistId}`);

  const allTracks = [];

  // The Spotify API nests tracks in different ways depending on API version:
  //   playlist.tracks.items  (documented format)
  //   playlist.items.items   (observed — items is a paging object)
  //   playlist.items         (if items is directly an array)
  let trackItems = [];
  let nextUrl = null;

  if (Array.isArray(playlist.items)) {
    trackItems = playlist.items;
    nextUrl = playlist.next || null;
  } else if (playlist.items && Array.isArray(playlist.items.items)) {
    trackItems = playlist.items.items;
    nextUrl = playlist.items.next || null;
  } else if (playlist.tracks && Array.isArray(playlist.tracks.items)) {
    trackItems = playlist.tracks.items;
    nextUrl = playlist.tracks.next || null;
  }

  // Parse first page
  for (const item of trackItems) {
    const track = item?.track || item?.item || item;
    if (track && track.name) {
      allTracks.push({
        name: track.name,
        artists: (track.artists || []).map((a) => a.name).join(', ') || 'Unknown Artist',
        album: track.album?.name || 'Unknown Album',
        url: track.external_urls?.spotify || '',
      });
    }
  }

  // Handle pagination via next URL
  while (nextUrl) {
    const urlPath = nextUrl.replace('https://api.spotify.com', '');
    const page = await spotifyGet(urlPath);

    const pageItems = Array.isArray(page.items) ? page.items : [];
    for (const item of pageItems) {
      const track = item?.track || item?.item || item;
      if (track && track.name) {
        allTracks.push({
          name: track.name,
          artists: (track.artists || []).map((a) => a.name).join(', ') || 'Unknown Artist',
          album: track.album?.name || 'Unknown Album',
          url: track.external_urls?.spotify || '',
        });
      }
    }

    nextUrl = page.next || null;
  }

  console.log(`[Textify] Imported "${playlist.name}" — ${allTracks.length} tracks`);

  return {
    id: playlistId,
    name: playlist.name || 'Untitled Playlist',
    description: playlist.description || '',
    image: playlist.images?.[0]?.url || '',
    owner: playlist.owner?.display_name || 'Unknown',
    url: playlist.external_urls?.spotify || playlistUrl,
    totalTracks: allTracks.length,
    tracks: allTracks,
  };
}

function disconnect() {
  accessToken = null;
  refreshToken = null;
  clientId = null;
  clientSecret = null;
  tokenExpiry = 0;
  store.clear();
  stopCallbackServer();
}

/**
 * Try to reconnect using saved credentials.
 * Returns { success, user } or { success: false }.
 */
async function tryReconnect() {
  const saved = store.load();
  if (!saved.clientId || !saved.clientSecret || !saved.refreshToken) {
    return { success: false };
  }

  clientId = saved.clientId;
  clientSecret = saved.clientSecret;
  refreshToken = saved.refreshToken;
  tokenExpiry = 0; // Force refresh

  try {
    await refreshAccessToken();
    const user = await getCurrentUser();
    console.log('[Textify] Auto-reconnected as', user.display_name);
    return { success: true, user };
  } catch (err) {
    console.log('[Textify] Auto-reconnect failed:', err.message);
    // Clear bad credentials
    clientId = null;
    clientSecret = null;
    refreshToken = null;
    accessToken = null;
    return { success: false };
  }
}

function stopCallbackServer() {
  if (callbackServer) {
    try { callbackServer.close(); } catch {}
    callbackServer = null;
  }
}

function getCallbackHtml(success, message) {
  const color = success ? '#1DB954' : '#ff4444';
  return `<!DOCTYPE html>
<html>
<head>
  <title>Textify</title>
  <style>
    body {
      margin: 0; display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #0a0a0f; color: #fff;
      font-family: 'Segoe UI', sans-serif;
    }
    .card {
      text-align: center; padding: 3rem; border-radius: 16px;
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: ${color}; margin: 0 0 0.5rem; font-size: 1.5rem; }
    p { color: rgba(255,255,255,0.6); margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Connected!' : 'Error'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

async function createPlaylist(userId, name) {
  // As of Feb 2026, POST /v1/users/{user_id}/playlists is deprecated.
  // The correct endpoint is POST /v1/me/playlists.
  return spotifyPost(`/v1/me/playlists`, {
    name
  });
}

async function addTracksToPlaylist(playlistId, uris) {
  // Can only add 100 at a time
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    await spotifyPost(`/v1/playlists/${playlistId}/items`, { uris: chunk });
  }
}

async function deletePlaylist(playlistId) {
  return spotifyDelete(`/v1/playlists/${playlistId}/followers`);
}

module.exports = {
  authenticate,
  tryReconnect,
  getPlaylistTracks,
  disconnect,
  stopCallbackServer,
  getCurrentUser,
  createPlaylist,
  addTracksToPlaylist,
  deletePlaylist,
};
