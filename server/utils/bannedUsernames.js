const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "config", "banned_usernames.txt");

let cached = null;
let cachedMtime = 0;

function loadBanned() {
  try {
    const stat = fs.statSync(FILE);
    const mtime = stat.mtimeMs;

    if (cached && mtime === cachedMtime) return cached;

    const raw = fs.readFileSync(FILE, "utf8");
    cached = new Set(
      raw
        .split(/\r?\n/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    cachedMtime = mtime;
    return cached;
  } catch {
    cached = new Set();
    cachedMtime = 0;
    return cached;
  }
}

function isBannedUsername(name) {
  if (!name || typeof name !== "string") return false;
  const banned = loadBanned();
  return banned.has(name.trim().toLowerCase());
}

module.exports = { isBannedUsername };