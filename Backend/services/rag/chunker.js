// Splits Markdown documents into retrieval chunks along H2/H3 sections.
// Each chunk carries its heading path so answers can cite where they came from.

const DEFAULT_MAX_CHARS = 900;

const splitLongSection = (paragraphs, maxChars) => {
  const parts = [];
  let current = [];
  let length = 0;
  for (const paragraph of paragraphs) {
    if (length + paragraph.length > maxChars && current.length > 0) {
      parts.push(current.join('\n\n'));
      // Overlap: carry the last paragraph into the next part for context.
      const last = current[current.length - 1];
      current = last.length < maxChars / 2 ? [last] : [];
      length = current.reduce((n, p) => n + p.length, 0);
    }
    current.push(paragraph);
    length += paragraph.length;
  }
  if (current.length > 0) parts.push(current.join('\n\n'));
  return parts;
};

const chunkMarkdown = (markdown, file, { maxChars = DEFAULT_MAX_CHARS } = {}) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let title = file;
  let h2 = null;
  let h3 = null;
  let buffer = [];
  const sections = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    buffer = [];
    if (!body) return;
    const heading = [h2, h3].filter(Boolean).join(' > ') || title;
    sections.push({ heading, body });
  };

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.*)$/.exec(line);
    if (match) {
      flush();
      const level = match[1].length;
      const text = match[2].trim();
      if (level === 1) { title = text; h2 = null; h3 = null; }
      if (level === 2) { h2 = text; h3 = null; }
      if (level === 3) { h3 = text; }
      continue;
    }
    buffer.push(line);
  }
  flush();

  const chunks = [];
  for (const section of sections) {
    const paragraphs = section.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const parts = section.body.length > maxChars ? splitLongSection(paragraphs, maxChars) : [paragraphs.join('\n\n')];
    parts.forEach((part, i) => {
      chunks.push({
        id: `${file}#${section.heading}#${i}`,
        file,
        title,
        heading: section.heading,
        // The heading path is embedded with the text: it carries most of the topical signal.
        text: `${title} — ${section.heading}\n${part}`,
      });
    });
  }
  return chunks;
};

module.exports = { chunkMarkdown };
