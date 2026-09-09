const { execFileSync } = require('child_process')

// Read a remote URL from the git repository containing the current working
// directory. Prefers "origin", falls back to the first configured remote.
// Returns undefined outside a git repository, when no remote is configured,
// or when git is unavailable.
function git (args) {
  try {
    const out = execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.trim() || undefined
  } catch (err) {
    // non-zero exit means "not found" for the config lookups below
    if (err.status !== undefined) return undefined
    // git missing from PATH, or not executable
    if (err.code === 'ENOENT' || err.code === 'EACCES') return undefined
    throw err
  }
}

module.exports = function originUrl () {
  const origin = git(['config', '--get', 'remote.origin.url'])
  if (origin) return origin
  // no origin: fall back to whichever remote comes first, e.g. "upstream"
  const first = git(['config', '--get-regexp', '^remote\\..+\\.url$'])
  return first ? first.split('\n')[0].split(' ').slice(1).join(' ') || undefined : undefined
}
