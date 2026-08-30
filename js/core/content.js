let content = null;

export async function loadContent() {
  if (content) return content;
  const res = await fetch('content/en.json');
  content = await res.json();
  return content;
}
