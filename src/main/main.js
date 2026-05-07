const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const spotify = require('./spotify');
const exporter = require('./exporter');
const store = require('./store');

let mainWindow;

const isMac = process.platform === 'darwin';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 700,
    frame: isMac ? true : false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  spotify.stopCallbackServer();
  app.quit();
});

// ── Window Controls ──────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ── Spotify Auth ─────────────────────────────────────────────
ipcMain.handle('spotify:connect', async (_event, clientId, clientSecret) => {
  try {
    const result = await spotify.authenticate(clientId, clientSecret, mainWindow);
    return { success: true, user: result.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('spotify:tryReconnect', async () => {
  return spotify.tryReconnect();
});

ipcMain.handle('spotify:disconnect', async () => {
  spotify.disconnect();
  store.set('playlists', []);
  return { success: true };
});

// ── Playlist Operations ──────────────────────────────────────
ipcMain.handle('spotify:importPlaylist', async (_event, playlistUrl) => {
  try {
    const playlist = await spotify.getPlaylistTracks(playlistUrl);
    return { success: true, playlist };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('file:selectText', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Textify Exports (.txt)',
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled || filePaths.length === 0) return { success: false, error: 'Cancelled' };
  return { success: true, filePaths };
});

ipcMain.handle('spotify:createPlaylistFromText', async (event, filePath, customName) => {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse the file
    const lines = content.split('\n');
    let playlistName = customName || 'Imported Playlist';
    const uris = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Try to find playlist name in header ONLY if customName wasn't provided
      if (!customName && i < 10 && line.trim() && !line.includes('═') && !line.includes('tracks') && !line.includes('Textify')) {
        playlistName = line.replace(/[\r\n]/g, '').trim();
      }

      // Extract URL
      const urlMatch = line.match(/URL:\s*(https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+)/);
      if (urlMatch) {
        const trackId = urlMatch[1].split('/track/')[1].split('?')[0];
        uris.push(`spotify:track:${trackId}`);
      }
    }

    if (uris.length === 0) {
      throw new Error('No valid Spotify URLs found in the text file.');
    }

    event.sender.send('import-progress', { status: 'Creating playlist...' });
    
    const user = await spotify.getCurrentUser();
    const newPlaylist = await spotify.createPlaylist(user.id, playlistName, 'Imported via Textify');

    event.sender.send('import-progress', { status: `Adding ${uris.length} tracks...` });
    
    await spotify.addTracksToPlaylist(newPlaylist.id, uris);

    // Fetch the final playlist details to return
    const fullPlaylist = await spotify.getPlaylistTracks(`https://open.spotify.com/playlist/${newPlaylist.id}`);

    return { success: true, playlist: fullPlaylist };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Playlist Persistence ─────────────────────────────────────
ipcMain.handle('spotify:delete-playlist', async (_event, playlistId) => {
  try {
    await spotify.deletePlaylist(playlistId);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('store:savePlaylists', (_event, playlists) => {
  store.set('playlists', playlists);
  return { success: true };
});
ipcMain.handle('store:loadPlaylists', () => {
  return store.get('playlists') || [];
});
ipcMain.handle('store:get', (_event, key) => {
  return store.get(key);
});
ipcMain.handle('store:set', (_event, key, value) => {
  store.set(key, value);
  return { success: true };
});

// ── Export ────────────────────────────────────────────────────
ipcMain.handle('export:saveTxt', async (_event, playlistName, tracks) => {
  try {
    const content = exporter.generateTxtContent(playlistName, tracks);
    const defaultName = playlistName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Playlist as Text',
      defaultPath: `${defaultName}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (canceled || !filePath) return { success: false, error: 'Cancelled' };

    exporter.saveTxtFile(content, filePath);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Shell helpers ────────────────────────────────────────────
ipcMain.on('shell:openExternal', (_event, url) => {
  shell.openExternal(url);
});
