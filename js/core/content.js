let content = null;

// Content packs are plain JSON. Adding a language means dropping in
// content/<code>.json and listing it under app.languages — no code change.
export async function loadContent(language) {
  if (content) return content;
  const code = language || 'en';
  content = await fetchPack(code);
  if (!content && code !== 'en') content = await fetchPack('en');
  if (!content) throw new Error('no content pack could be loaded');
  return content;
}

async function fetchPack(code) {
  try {
    const res = await fetch('content/' + code + '.json');
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}
