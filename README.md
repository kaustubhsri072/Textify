# Textify 🎵📝

Convert your Spotify playlists into beautifully formatted text files — and bring them back.

## What is this?

Textify is a desktop app I built that bridges the gap between Spotify playlists and plain text. The idea came from wanting a way to take a large playlist that contains hundreds of my favorite songs and create sub playlists based on genre or mood. I'm not particularly good at curating playlists so this tool is perfect for people like who have large playlists but want to make curated playlists for specific scenarios like late night drives, workouts, etc.

Basically, the core loop of the app is: **Export playlist → edit/sort with AI → import new playlists back to Spotify.**

> **Heads up:** You need a Spotify Premium account and your own Spotify Developer credentials to use this. More on that below.

## Features

- **Import by Link** — Paste any Spotify playlist URL and pull all the tracks into Textify instantly. Handles pagination so even 1000+ track playlists work fine.
- **Export to .txt** — Download any imported playlist as a clean, formatted text file with track names, artists, albums, and Spotify URLs.
- **Import from .txt** — Take a Textify-formatted `.txt` file (maybe one you edited or had AI reorganize) and create a brand new Spotify playlist from it automatically.
- **Batch Import** — Select multiple `.txt` files at once and import them all in one go. You get to rename each playlist before it's created.
- **Smart Deletion** — Playlists you imported via link are only removed from Textify locally (your Spotify stays untouched). Playlists you created via `.txt` import *will* be deleted from Spotify too, since Textify created them.
- **Auto-Reconnect** — Credentials are saved locally so you don't have to log in every time you open the app.
- **Interactive Tutorial** — First-time users get a guided spotlight walkthrough of the UI so you're not lost.
- **Custom Titlebar** — Frameless window with custom minimize/maximize/close buttons because why not.

## How the AI Workflow Works

This is the part that makes Textify more than just a backup tool:

1. Import your big messy playlist into Textify
2. Export it to a `.txt` file
3. Feed that file to ChatGPT / Claude / whatever and ask it to sort, filter, or split your tracks (there's a pre-built prompt you can copy from the app)
4. Save the AI's output as a `.txt` file
5. Import it back into Textify → it creates a fresh playlist on your Spotify

It's basically a way to let AI curate your music without giving it access to your Spotify account.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- A [Spotify Premium](https://www.spotify.com/premium/) account
- Your own Spotify Developer app credentials (free to create)

### Setting Up Spotify Credentials

**Note:** You need a Spotify Premium account and your own Spotify Developer credentials to use this. More on that below.

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Set the Redirect URI to `http://127.0.0.1:8888/callback`
4. Grab your **Client ID** and **Client Secret**

The app walks you through this during the setup flow too, so don't worry if you haven't done this before.

### Installation

```bash
# Clone the repo
git clone https://github.com/kaustubhsri072/Textify.git
cd Textify

# Install dependencies
npm install

# Run the app
npm start
```

That's it. Electron handles the rest.

### Building for Distribution

```bash
# Windows
npm run build

# macOS
npm run build:mac
```

Builds go to the `dist/` folder. Uses `electron-builder` under the hood.

## Project Structure

```
Textify/
├── assets/
│   └── icon.png                 # App icon
├── src/
│   ├── main/
│   │   ├── main.js              # Electron main process — window setup, IPC handlers
│   │   ├── preload.js           # Preload script — exposes safe APIs to renderer
│   │   ├── spotify.js           # All Spotify API logic — auth, import, create, delete
│   │   ├── exporter.js          # Generates and saves .txt file content
│   │   └── store.js             # Simple JSON persistence for credentials & playlists
│   └── renderer/
│       ├── index.html           # Main UI markup
│       ├── styles.css           # All the styling
│       └── app.js               # Frontend logic — state management, UI rendering, tutorial
├── package.json
└── README.md
```

## Tech Stack

| What | Why |
|------|-----|
| [Electron](https://www.electronjs.org/) | Cross-platform desktop app framework |
| HTML / CSS / JS | Vanilla frontend — no React, no framework overhead |
| [Spotify Web API](https://developer.spotify.com/documentation/web-api) | Playlist data, track search, playlist creation |
| Node.js `http` / `https` | OAuth callback server + API requests (no axios/fetch deps) |

No external HTTP libraries. The Spotify auth flow uses a local HTTP server on port 8888 to catch the OAuth callback, and all API requests go through Node's built-in `https` module. Kept dependencies minimal on purpose.

## How Auth Works (briefly)

1. User enters Client ID + Secret in the setup screen
2. App opens Spotify's auth page in the browser
3. User approves → Spotify redirects to `localhost:8888/callback` with an auth code
4. App exchanges the code for access + refresh tokens
5. Tokens are stored locally via `store.js` for auto-reconnect on next launch
6. Access token auto-refreshes when it's about to expire

## Known Issues / Limitations

- The Spotify API has rate limits — importing a massive number of playlists back-to-back might hit those. There's no retry logic built in yet.
- The `.txt` parser is fairly strict. If you manually edit the exported file, make sure the `URL: https://open.spotify.com/track/...` lines stay intact or it won't be able to find the tracks.
- Only works with playlist links, not album links or artist pages.
- No dark/light mode toggle — it's dark mode only (looks better tbh).

## Future Ideas

- [ ] Drag and drop `.txt` files to import
- [ ] Search/filter within imported playlists
- [ ] Export to other formats (CSV, JSON)
- [ ] Album and liked songs support
- [ ] Shareable playlist snapshots
- [ ] Integrated AI model to create playlists in the app

## License

MIT — do whatever you want with it.
