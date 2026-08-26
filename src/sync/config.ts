/**
 * Turn whatever was pasted into the VITE_FIREBASE_CONFIG secret into a config object.
 * Accepts: pure JSON; `const firebaseConfig = { apiKey: "…", … };`; or the console's whole snippet
 * (with `import { initializeApp } …` lines and comments around it).
 */
export function parseFirebaseConfig(raw: string | undefined | null): Record<string, string> | null {
  if (!raw) return null
  const text = raw.replace(/\/\/[^\n]*/g, '')             // strip // comments (they can contain braces/quotes)
  // prefer the object assigned to firebaseConfig; otherwise any flat {…} that mentions apiKey
  const candidates: string[] = []
  const named = /firebaseConfig\s*=\s*(\{[^{}]*\})/.exec(text)
  if (named) candidates.push(named[1])
  for (const m of text.matchAll(/\{[^{}]*\}/g)) if (/apiKey/.test(m[0])) candidates.push(m[0])
  for (const c of candidates) {
    const obj = relaxedJson(c)
    if (obj && typeof obj.apiKey === 'string' && typeof obj.projectId === 'string') return obj
  }
  return null
}

function relaxedJson(s: string): Record<string, string> | null {
  try { return JSON.parse(s) } catch { /* fall through */ }
  const fixed = s
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')   // quote bare keys
    .replace(/'/g, '"')                                          // single → double quotes
    .replace(/,\s*}/g, '}')                                      // trailing comma
  try { return JSON.parse(fixed) } catch { return null }
}
