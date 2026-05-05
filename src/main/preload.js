const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('textifyAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Spotify
  connectSpotify: (clientId, clientSecret) =>
    ipcRenderer.invoke('spotify:connect', clientId, clientSecret),
  tryReconnect: () => ipcRenderer.invoke('spotify:tryReconnect'),
  disconnectSpotify: () => ipcRenderer.invoke('spotify:disconnect'),

  // Playlists
  importPlaylist: (url) => ipcRenderer.invoke('spotify:importPlaylist', url),
  deletePlaylist: (playlistId) => ipcRenderer.invoke('spotify:delete-playlist', playlistId),
  selectTextFile: () => ipcRenderer.invoke('file:selectText'),
  createPlaylistFromText: (filePath, playlistName) => ipcRenderer.invoke('spotify:createPlaylistFromText', filePath, playlistName),
  onImportProgress: (callback) => {
    ipcRenderer.on('import-progress', (_event, data) => callback(data));
  },

  // Export
  saveTxt: (playlistName, tracks) =>
    ipcRenderer.invoke('export:saveTxt', playlistName, tracks),

  // Persistence
  savePlaylists: (playlists) =>
    ipcRenderer.invoke('store:savePlaylists', playlists),
  loadPlaylists: () =>
    ipcRenderer.invoke('store:loadPlaylists'),
  setStore: (key, value) => ipcRenderer.invoke('store:set', key, value),
  getStore: (key) => ipcRenderer.invoke('store:get', key),

  // Shell
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
});
