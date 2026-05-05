const fs = require('fs');

/**
 * Generate formatted text content from playlist data.
 * Format: Song Name | Artist(s) | Album
 */
function generateTxtContent(playlistName, tracks) {
  const divider = '═'.repeat(70);
  const thinDivider = '─'.repeat(70);

  let lines = [];

  lines.push(divider);
  lines.push(`  ${playlistName}`);
  lines.push(`  ${tracks.length} tracks`);
  lines.push(`  Exported with Textify`);
  lines.push(divider);
  lines.push('');

  // Column headers
  lines.push(`  #    Song Name                        Artist(s)               Album`);
  lines.push(`  ${thinDivider}`);

  tracks.forEach((track, index) => {
    const num = String(index + 1).padStart(3, ' ');
    lines.push(`  ${num}.  ${track.name}`);
    lines.push(`        Artist: ${track.artists}`);
    lines.push(`        Album:  ${track.album}`);
    lines.push(`        URL:    ${track.url}`);
    lines.push('');
  });

  lines.push(divider);
  lines.push(`  End of playlist — ${tracks.length} tracks total`);
  lines.push(divider);

  return lines.join('\n');
}

/**
 * Write text content to a file.
 */
function saveTxtFile(content, filePath) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

module.exports = {
  generateTxtContent,
  saveTxtFile,
};
