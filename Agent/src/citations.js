// Turns the model's [n] markers (or gpt-oss's 【n】) into a list of sources,
// using the handbook passages returned by search_handbook in this run.
export const extractSources = (answer, passages = []) => {
  const byN = new Map(passages.map((p) => [p.n, p.source]));
  const cited = new Set();
  const normalised = String(answer || '')
    .replace(/【\s*(\d+)\s*】/g, '[$1]')
    .replace(/\s?【[^】]*】/g, '');
  const cleaned = normalised.replace(/\s?\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, nums) => {
    const valid = nums.split(',').map((n) => Number(n.trim())).filter((n) => byN.has(n));
    if (!valid.length) return match;
    valid.forEach((n) => cited.add(n));
    return '';
  });
  const seen = new Set();
  const sources = [];
  [...cited]
    .sort((a, b) => a - b)
    .forEach((n) => {
      const source = byN.get(n);
      if (seen.has(source)) return;
      seen.add(source);
      const [file, heading] = source.split(' › ');
      sources.push({ file, heading });
    });
  return { answer: cleaned.trim(), sources };
};
