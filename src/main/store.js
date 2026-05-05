const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STORE_FILE = path.join(app.getPath('userData'), 'textify-config.json');

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8'));
    }
  } catch {
    // Corrupt file — ignore
  }
  return {};
}

function save(data) {
  try {
    const existing = load();
    const merged = { ...existing, ...data };
    fs.writeFileSync(STORE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Textify] Failed to save config:', err.message);
  }
}

function get(key) {
  return load()[key] ?? null;
}

function set(key, value) {
  save({ [key]: value });
}

function clear() {
  try {
    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
  } catch {}
}

module.exports = { load, save, get, set, clear };
