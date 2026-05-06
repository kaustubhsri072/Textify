/* ═══════════════════════════════════════════════════════════
   Textify — App Logic
   ═══════════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────────
const state = {
  currentView: 'setup', // 'setup' | 'main'
  setupStep: 1,
  isConnected: false,
  userName: '',
  playlists: [], // { id, name, image, owner, totalTracks, tracks, url }
  selectedPlaylistId: null,
  hasSeenTutorial: false,
  isTutorialMode: false,
};

// ─── DOM References ──────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Views
const viewSetup = $('#view-setup');
const viewMain = $('#view-main');

// Setup
const steps = $$('.step');
const setupSteps = $$('.setup-step');
const btnNextStep1 = $('#btn-next-step1');
const btnBackStep2 = $('#btn-back-step2');
const btnNextStep2 = $('#btn-next-step2');
const btnGoMain = $('#btn-go-main');
const btnRetry = $('#btn-retry');
const inputClientId = $('#input-client-id');
const inputClientSecret = $('#input-client-secret');
const btnToggleSecret = $('#btn-toggle-secret');
const connectStatus = $('#connect-status');
const connectSuccess = $('#connect-success');
const connectError = $('#connect-error');
const connectErrorMsg = $('#connect-error-msg');
const userDisplayName = $('#user-display-name');

// Main
const inputPlaylistUrl = $('#input-playlist-url');
const btnImport = $('#btn-import');
const playlistList = $('#playlist-list');
const sidebarEmpty = $('#sidebar-empty');
const playlistCount = $('#playlist-count');
const trackDisplay = $('#track-display');
const mainEmpty = $('#main-empty');
const trackView = $('#track-view');
const playlistCover = $('#playlist-cover');
const playlistTitle = $('#playlist-title');
const playlistMeta = $('#playlist-meta');
const trackList = $('#track-list');
const btnDownloadTxt = $('#btn-download-txt');
const sidebarUserName = $('#sidebar-user-name');
const btnDisconnect = $('#btn-disconnect');
const btnImportTxt = $('#btn-import-txt');
const btnHelpTxt = $('#btn-help-txt');
const helpModal = $('#help-modal');
const btnCloseHelp = $('#btn-close-help');
const btnCopyPrompt = $('#btn-copy-prompt');

const nameModal = $('#name-modal');
const inputNewPlaylistName = $('#input-new-playlist-name');
const btnConfirmName = $('#btn-confirm-name');
const btnCancelName = $('#btn-cancel-name');

// Dynamic Tutorial
const tutorialOverlay = $('#tutorial-overlay');
const tutorialTooltip = $('#tutorial-tooltip');
const tooltipTitle = $('#tooltip-title');
const tooltipText = $('#tooltip-text');
const btnTutorialNext = $('#btn-tutorial-next');

const tutorialSteps = [
  { title: 'Welcome to Textify', text: 'Your Spotify library, now AI-powered. Let\'s take a quick tour of the core features.', target: null },
  { title: '1. Smart Import', text: 'Paste a Spotify playlist link here to pull all tracks instantly.', target: '.import-main-group' },
  { title: '2. The AI Bridge', text: 'Export your playlists to .txt to start your AI sorting workflow.', target: '#btn-download-txt' },
  { title: '3. Import Results', text: 'Once the AI has curated your files, bring them back into Spotify here.', target: '#btn-import-txt' },
  { title: 'Final Step: Expert Help', text: 'You MUST click the highlighted "?" button to see our expert AI prompts and finish the tour.', target: '#btn-help-txt' }
];

let currentTutorialStep = 0;

const loadingOverlay = $('#loading-overlay');
const loadingText = $('#loading-text');
const toastContainer = $('#toast-container');

// ─── Window Controls ─────────────────────────────────────────
$('#btn-minimize').addEventListener('click', () => textifyAPI.minimize());
$('#btn-maximize').addEventListener('click', () => textifyAPI.maximize());
$('#btn-close').addEventListener('click', () => textifyAPI.close());

// ─── Setup: Step Navigation ─────────────────────────────────
function goToStep(stepNum) {
  state.setupStep = stepNum;

  // Update step indicators
  steps.forEach((el) => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (s === stepNum) el.classList.add('active');
    if (s < stepNum) el.classList.add('completed');
  });

  // Show correct step content
  setupSteps.forEach((el) => el.classList.remove('active'));
  $(`#setup-step-${stepNum}`).classList.add('active');
}

// Step 1 → Step 2
btnNextStep1.addEventListener('click', () => goToStep(2));

// Step 2 → Step 1
btnBackStep2.addEventListener('click', () => goToStep(1));

// Step 2 → Step 3 (Connect)
btnNextStep2.addEventListener('click', async () => {
  const clientId = inputClientId.value.trim();
  const clientSecret = inputClientSecret.value.trim();

  if (!clientId || !clientSecret) {
    showToast('Please enter both Client ID and Client Secret', 'error');
    return;
  }

  goToStep(3);

  // Reset step 3 state
  connectStatus.classList.remove('hidden');
  connectSuccess.classList.add('hidden');
  connectError.classList.add('hidden');

  const result = await textifyAPI.connectSpotify(clientId, clientSecret);

  if (result.success) {
    state.isConnected = true;
    state.userName = result.user.display_name || 'User';

    connectStatus.classList.add('hidden');
    connectSuccess.classList.remove('hidden');
    userDisplayName.textContent = state.userName;
  } else {
    connectStatus.classList.add('hidden');
    connectError.classList.remove('hidden');
    connectErrorMsg.textContent = result.error || 'Unknown error occurred';
  }
});

// Retry connection
btnRetry.addEventListener('click', () => goToStep(2));

// Go to main view
btnGoMain.addEventListener('click', () => {
  switchToMainView();
});

// Toggle password visibility
btnToggleSecret.addEventListener('click', () => {
  const input = inputClientSecret;
  input.type = input.type === 'password' ? 'text' : 'password';
});

// Copy redirect URI
$('#btn-copy-uri').addEventListener('click', () => {
  navigator.clipboard.writeText('http://127.0.0.1:8888/callback');
  showToast('Redirect URI copied!', 'success');
});

// Open Spotify dashboard
$('#link-spotify-dashboard').addEventListener('click', (e) => {
  e.preventDefault();
  textifyAPI.openExternal('https://developer.spotify.com/dashboard');
});

// ─── View Switching ──────────────────────────────────────────
function switchToMainView() {
  state.currentView = 'main';
  viewSetup.classList.remove('active');
  viewMain.classList.add('active');
  sidebarUserName.textContent = state.userName;
  
  // Check for onboarding
  if (!state.hasSeenTutorial) {
    startOnboarding();
  }
}

function switchToSetupView() {
  state.currentView = 'setup';
  viewMain.classList.remove('active');
  viewSetup.classList.add('active');
  goToStep(1);
}

// ─── Playlist Import ─────────────────────────────────────────
btnImport.addEventListener('click', importPlaylist);
inputPlaylistUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') importPlaylist();
});

async function importPlaylist() {
  const url = inputPlaylistUrl.value.trim();
  if (!url) {
    showToast('Please paste a Spotify playlist link', 'error');
    return;
  }

  // Check if already imported
  const existingId = extractPlaylistIdFromUrl(url);
  if (existingId && state.playlists.find((p) => p.id === existingId)) {
    showToast('This playlist is already imported', 'error');
    selectPlaylist(existingId);
    return;
  }

  showLoading('Importing playlist...');

  const result = await textifyAPI.importPlaylist(url);

  hideLoading();

  if (result.success) {
    result.playlist.source = 'link';
    state.playlists.push(result.playlist);
    inputPlaylistUrl.value = '';
    
    // Save to persistent storage
    textifyAPI.savePlaylists(state.playlists);
    
    renderSidebar();
    selectPlaylist(result.playlist.id);
    showToast(`Imported "${result.playlist.name}" (${result.playlist.totalTracks} tracks)`, 'success');
  } else {
    showToast(result.error || 'Failed to import playlist', 'error');
  }
}

async function importFromText() {
  const result = await textifyAPI.selectTextFile();
  if (!result.success) return; // Cancelled

  const files = result.filePaths;
  const total = files.length;
  let successCount = 0;
  let lastPlaylistId = null;

  showLoading(`Preparing to import ${total} files...`);

  // Listen for progress updates
  textifyAPI.onImportProgress((data) => {
    loadingText.textContent = data.status;
  });

  for (let i = 0; i < total; i++) {
    const filePath = files[i];
    const fileName = filePath.split(/[\\/]/).pop().replace('.txt', '');
    
    // Ask for name
    const chosenName = await requestPlaylistName(fileName);
    if (!chosenName) continue; // Skip if cancelled

    showLoading(`Importing ${chosenName}...`);
    
    const importResult = await textifyAPI.createPlaylistFromText(filePath, chosenName);
    
    if (importResult.success) {
      importResult.playlist.source = 'text-import';
      state.playlists.push(importResult.playlist);
      lastPlaylistId = importResult.playlist.id;
      successCount++;
    } else {
      showToast(`Failed to import ${fileName}: ${importResult.error}`, 'error');
    }
  }

  hideLoading();

  if (successCount > 0) {
    textifyAPI.savePlaylists(state.playlists);
    renderSidebar();
    if (lastPlaylistId) selectPlaylist(lastPlaylistId);
    showToast(`Successfully imported ${successCount} playlists!`, 'success');
  }
}

function extractPlaylistIdFromUrl(url) {
  const match = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// ─── Sidebar Rendering ──────────────────────────────────────
function renderSidebar() {
  playlistCount.textContent = state.playlists.length;

  // Clear old items
  playlistList.querySelectorAll('.playlist-item').forEach((el) => el.remove());

  if (state.playlists.length === 0) {
    sidebarEmpty.classList.remove('hidden');
    return;
  }

  sidebarEmpty.classList.add('hidden');

  state.playlists.forEach((pl) => {
    const item = document.createElement('div');
    item.className = `playlist-item${pl.id === state.selectedPlaylistId ? ' active' : ''}`;
    item.dataset.id = pl.id;
    
    item.innerHTML = `
      <div class="playlist-item-inner">
        <div class="playlist-item-main">
          <img class="playlist-item-cover" src="${pl.image || ''}" alt="" onerror="this.style.background='var(--bg-tertiary)'" />
          <div class="playlist-item-info">
            <div class="playlist-item-name">${escapeHtml(pl.name)}</div>
            <div class="playlist-item-meta">${pl.totalTracks} tracks · ${escapeHtml(pl.owner)}</div>
          </div>
        </div>
        <button class="playlist-options-btn" title="Options">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="12" cy="5" r="1" fill="currentColor" />
            <circle cx="12" cy="19" r="1" fill="currentColor" />
          </svg>
        </button>
        <button class="playlist-delete-confirm-btn" title="Confirm Delete">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    `;

    const mainPart = item.querySelector('.playlist-item-main');
    const optionsBtn = item.querySelector('.playlist-options-btn');
    const deleteBtn = item.querySelector('.playlist-delete-confirm-btn');

    mainPart.addEventListener('click', (e) => {
      if (item.classList.contains('confirm-delete')) {
        item.classList.remove('confirm-delete');
        return;
      }
      selectPlaylist(pl.id);
    });

    optionsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other delete confirms
      playlistList.querySelectorAll('.playlist-item.confirm-delete').forEach(other => {
        if (other !== item) other.classList.remove('confirm-delete');
      });
      item.classList.toggle('confirm-delete');
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      try {
        // Only delete from Spotify if the playlist was created via text import
        if (pl.source === 'text-import') {
          showLoading('Removing from Spotify...');
          const result = await textifyAPI.deletePlaylist(pl.id);
          
          if (!result.success) {
            showToast(result.error || 'Failed to delete from Spotify', 'error');
            hideLoading();
            return;
          }
        }

        // Update local state
        state.playlists = state.playlists.filter((p) => p.id !== pl.id);
        
        if (state.selectedPlaylistId === pl.id) {
          state.selectedPlaylistId = null;
          trackView.classList.add('hidden');
          mainEmpty.classList.remove('hidden');
        }
        
        // Persist local changes
        textifyAPI.savePlaylists(state.playlists);
        renderSidebar();
        
        if (pl.source === 'text-import') {
          showToast(`Deleted "${pl.name}" from Spotify`, 'success');
        } else {
          showToast(`Removed "${pl.name}" from Textify`, 'success');
        }
      } catch (err) {
        showToast('Error removing playlist', 'error');
      } finally {
        hideLoading();
      }
    });

    playlistList.appendChild(item);
  });
}

// ─── Playlist Selection ──────────────────────────────────────
function selectPlaylist(id) {
  state.selectedPlaylistId = id;
  const pl = state.playlists.find((p) => p.id === id);
  if (!pl) return;

  // Update sidebar active state
  playlistList.querySelectorAll('.playlist-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  // Show track view
  mainEmpty.classList.add('hidden');
  trackView.classList.remove('hidden');

  // Populate header
  playlistCover.src = pl.image || '';
  playlistCover.onerror = function () {
    this.style.background = 'var(--bg-tertiary)';
  };
  playlistTitle.textContent = pl.name;
  playlistMeta.textContent = `${pl.totalTracks} tracks · by ${pl.owner}`;

  // Render tracks
  trackList.innerHTML = '';
  pl.tracks.forEach((track, i) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.style.animationDelay = `${Math.min(i * 20, 500)}ms`;
    row.innerHTML = `
      <span class="col-num">${i + 1}</span>
      <span class="col-name" title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</span>
      <span class="col-artist" title="${escapeHtml(track.artists)}">${escapeHtml(track.artists)}</span>
      <span class="col-album" title="${escapeHtml(track.album)}">${escapeHtml(track.album)}</span>
    `;
    trackList.appendChild(row);
  });
}

// ─── Download .txt ───────────────────────────────────────────
btnDownloadTxt.addEventListener('click', async () => {
  const pl = state.playlists.find((p) => p.id === state.selectedPlaylistId);
  if (!pl) return;

  const result = await textifyAPI.saveTxt(pl.name, pl.tracks);
  if (result.success) {
    showToast(`Saved "${pl.name}.txt"`, 'success');
  } else if (result.error !== 'Cancelled') {
    showToast(result.error || 'Failed to save file', 'error');
  }
});

// ─── Help & Import .txt ─────────────────────────────────────
btnHelpTxt.addEventListener('click', () => {
  helpModal.style.opacity = '1';
  helpModal.classList.remove('hidden');
  
  if (state.isTutorialMode) {
    finishOnboarding();
  }
});

btnCloseHelp.addEventListener('click', () => {
  helpModal.style.opacity = '0';
  setTimeout(() => helpModal.classList.add('hidden'), 200);
});

btnCopyPrompt.addEventListener('click', () => {
  const promptText = $('#ai-prompt-text').textContent;
  navigator.clipboard.writeText(promptText);
  showToast('AI Prompt copied to clipboard!', 'success');
});

btnImportTxt.addEventListener('click', importFromText);

// ─── Disconnect ──────────────────────────────────────────────
btnDisconnect.addEventListener('click', async () => {
  await textifyAPI.disconnectSpotify();
  state.isConnected = false;
  state.userName = '';
  state.playlists = [];
  state.selectedPlaylistId = null;
  switchToSetupView();
  showToast('Disconnected from Spotify', 'success');
});

// ─── Loading Overlay ─────────────────────────────────────────
function showLoading(text = 'Loading...') {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

function requestPlaylistName(defaultName) {
  return new Promise((resolve) => {
    nameModal.classList.remove('hidden');
    inputNewPlaylistName.value = defaultName;
    inputNewPlaylistName.focus();
    inputNewPlaylistName.select();

    const handleConfirm = () => {
      const name = inputNewPlaylistName.value.trim() || defaultName;
      cleanup();
      resolve(name);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      nameModal.classList.add('hidden');
      btnConfirmName.removeEventListener('click', handleConfirm);
      btnCancelName.removeEventListener('click', handleCancel);
    };

    btnConfirmName.addEventListener('click', handleConfirm);
    btnCancelName.addEventListener('click', handleCancel);
    
    // Quick enter/esc
    inputNewPlaylistName.onkeydown = (e) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') handleCancel();
    };
  });
}

// ─── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

// Helper for rounded rect SVG path
function getRoundedRectPath(x, y, w, h, r) {
  // Clamp radius
  r = Math.min(r, w / 2, h / 2);
  return `M ${x + r},${y} h ${w - 2 * r} a ${r},${r} 0 0 1 ${r},${r} v ${h - 2 * r} a ${r},${r} 0 0 1 -${r},${r} h -${w - 2 * r} a ${r},${r} 0 0 1 -${r},-${r} v -${h - 2 * r} a ${r},${r} 0 0 1 ${r},-${r} z`;
}

function getCirclePath(cx, cy, r) {
  // Clockwise sweep (1,1) to cut through CCW outer path
  return `M ${cx},${cy - r} a ${r},${r} 0 1,1 0,${2 * r} a ${r},${r} 0 1,1 0,-${2 * r} z`;
}

// ─── Utility ─────────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Dynamic Spotlight Tutorial ───────────────────────────────
function startOnboarding() {
  state.isTutorialMode = true;
  currentTutorialStep = 0;
  tutorialOverlay.classList.add('active');
  tutorialTooltip.classList.remove('hidden');
  
  setTimeout(() => {
    tutorialTooltip.classList.add('active');
    moveTutorial(0);
  }, 100);
}


function moveTutorial(stepIndex) {
  const step = tutorialSteps[stepIndex];
  if (!step) return;

  tooltipTitle.textContent = step.title;
  tooltipText.textContent = step.text;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const outer = `M 0,0 V ${h} H ${w} V 0 Z`; // CCW outer path

  // Titlebar controls area (exposed)
  const controls = $('.titlebar-controls').getBoundingClientRect();
  const cPad = 5;
  const titlebarHole = getRoundedRectPath(controls.left - cPad, controls.top - cPad, controls.width + cPad * 2, controls.height + cPad * 2, 4);

  if (step.target) {
    const targetEl = $(step.target);
    const rect = targetEl.getBoundingClientRect();
    const padding = 8;
    
    let hole = '';
    if (step.target === '#btn-help-txt') {
      // CIRCLE for ? button
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const r = Math.max(rect.width, rect.height) / 2 + 5;
      hole = getCirclePath(cx, cy, r);
    } else {
      // ROUNDED RECT for others
      const r = step.target === '.import-bar' ? 24 : 12; // Match search bar curvature
      hole = getRoundedRectPath(rect.left - padding, rect.top - padding, rect.width + padding * 2, rect.height + padding * 2, r);
    }

    tutorialOverlay.style.clipPath = `path('${outer} ${titlebarHole} ${hole}')`;

    // Position Tooltip
    const tooltipRect = tutorialTooltip.getBoundingClientRect();
    const arrow = tutorialTooltip.querySelector('.tooltip-arrow');
    
    // Safety check for target visibility
    if (rect.width === 0) {
      tutorialTooltip.style.top = '50%';
      tutorialTooltip.style.left = '50%';
      tutorialTooltip.style.transform = 'translate(-50%, -50%)';
      arrow.classList.add('hidden');
      return;
    }

    let top = rect.bottom + 25;
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

    // Boundary checks for tooltip
    if (left < 20) left = 20;
    if (left + tooltipRect.width > window.innerWidth - 20) left = window.innerWidth - tooltipRect.width - 20;
    if (top + tooltipRect.height > window.innerHeight - 20) top = rect.top - tooltipRect.height - 25;

    tutorialTooltip.style.top = `${top}px`;
    tutorialTooltip.style.left = `${left}px`;
    tutorialTooltip.style.transform = 'none';

    // Center arrow to target element
    arrow.classList.remove('hidden');
    const targetCenter = rect.left + rect.width / 2;
    const arrowLeft = targetCenter - left;
    arrow.style.left = `${arrowLeft}px`;

    // Last step handling
    if (stepIndex === tutorialSteps.length - 1) {
      btnTutorialNext.classList.add('hidden');
      btnHelpTxt.classList.add('tutorial-highlight');
      showToast('Click the highlighted "?" button!', 'info');
    } else {
      btnTutorialNext.classList.remove('hidden');
      btnHelpTxt.classList.remove('tutorial-highlight');
    }
  } else {
    // Welcome step
    tutorialOverlay.style.clipPath = `path('${outer} ${titlebarHole}')`;
    
    tutorialTooltip.style.top = '50%';
    tutorialTooltip.style.left = '50%';
    tutorialTooltip.style.transform = 'translate(-50%, -50%)';
    
    // Hide arrow on welcome step
    const arrow = tutorialTooltip.querySelector('.tooltip-arrow');
    arrow.classList.add('hidden');
    btnTutorialNext.classList.remove('hidden');
  }
}

btnTutorialNext.addEventListener('click', () => {
  currentTutorialStep++;
  if (currentTutorialStep < tutorialSteps.length) {
    moveTutorial(currentTutorialStep);
  }
});

window.addEventListener('resize', () => {
  if (state.isTutorialMode) {
    moveTutorial(currentTutorialStep);
  }
});

async function finishOnboarding() {
  state.isTutorialMode = false;
  state.hasSeenTutorial = true;
  tutorialOverlay.style.opacity = '0';
  tutorialTooltip.classList.remove('active');
  btnHelpTxt.classList.remove('tutorial-highlight');
  
  setTimeout(() => {
    tutorialOverlay.classList.remove('active');
    tutorialTooltip.classList.add('hidden');
  }, 400);
  
  await textifyAPI.setStore('hasSeenTutorial', true);
  showToast('Welcome to Textify!', 'success');
}

// ─── Auto-reconnect on launch ────────────────────────────────
async function init() {
  const result = await textifyAPI.tryReconnect();
  
  // Check for onboarding
  const hasSeenTutorial = await textifyAPI.getStore('hasSeenTutorial');
  state.hasSeenTutorial = !!hasSeenTutorial;

  if (result.success) {
    state.isConnected = true;
    state.userName = result.user.display_name || 'User';
    
    // Load saved playlists
    const savedPlaylists = await textifyAPI.loadPlaylists();
    if (savedPlaylists && savedPlaylists.length > 0) {
      state.playlists = savedPlaylists;
      renderSidebar();
    }

    switchToMainView();
  }
}

init();
