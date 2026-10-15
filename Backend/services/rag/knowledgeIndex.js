// In-memory hybrid index over Backend/knowledge/*.md.
// Dense (embedding) and lexical (BM25) rankings are merged with reciprocal rank fusion.
// Embeddings are cached on disk keyed by content hash, so restarts only embed changed chunks.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { chunkMarkdown } = require('./chunker');
const { BM25 } = require('./bm25');
const embedder = require('./embedder');

const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'knowledge');
const CACHE_FILE = path.join(KNOWLEDGE_DIR, '.index', 'embeddings.json');
const RRF_K = 60;
const MIN_COSINE = 0.3;

const state = {
  chunks: [],
  vectors: null, // null when embeddings are unavailable (lexical-only mode)
  bm25: null,
  builtAt: null,
};
let buildPromise = null;

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const readCache = async () => {
  try {
    const cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
    return cache.model === embedder.MODEL ? cache.entries : {};
  } catch {
    return {};
  }
};

const writeCache = async (entries) => {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify({ model: embedder.MODEL, entries }));
};

const loadChunks = async () => {
  const files = (await fs.readdir(KNOWLEDGE_DIR)).filter((f) => f.endsWith('.md')).sort();
  const chunks = [];
  for (const file of files) {
    const markdown = await fs.readFile(path.join(KNOWLEDGE_DIR, file), 'utf8');
    chunks.push(...chunkMarkdown(markdown, file));
  }
  return chunks;
};

const embedChunks = async (chunks) => {
  const cached = await readCache();
  const entries = {};
  const missing = [];
  chunks.forEach((chunk) => {
    const hash = sha256(chunk.text);
    if (cached[hash]) entries[hash] = cached[hash];
    else missing.push({ hash, text: chunk.text });
  });

  for (let i = 0; i < missing.length; i += 16) {
    const batch = missing.slice(i, i + 16);
    const vectors = await embedder.embed(batch.map((m) => m.text));
    batch.forEach((m, j) => { entries[m.hash] = vectors[j]; });
  }
  if (missing.length > 0 || Object.keys(cached).length !== Object.keys(entries).length) {
    await writeCache(entries);
  }
  return { vectors: chunks.map((c) => entries[sha256(c.text)]), embedded: missing.length };
};

const doBuild = async () => {
  const started = Date.now();
  const chunks = await loadChunks();
  const bm25 = new BM25(chunks.map((c) => c.text));

  let vectors = null;
  let embedded = 0;
  try {
    ({ vectors, embedded } = await embedChunks(chunks));
  } catch (err) {
    console.warn(`Knowledge index: embeddings unavailable (${err.message}); using keyword search only.`);
  }

  Object.assign(state, { chunks, vectors, bm25, builtAt: new Date() });
  const stats = {
    chunks: chunks.length,
    files: [...new Set(chunks.map((c) => c.file))],
    newlyEmbedded: embedded,
    mode: vectors ? 'hybrid' : 'keyword-only',
    ms: Date.now() - started,
  };
  console.log(`Knowledge index ready: ${stats.chunks} chunks from ${stats.files.length} files (${stats.mode}, ${stats.ms} ms)`);
  return stats;
};

// Builds (or rebuilds) the index. Concurrent callers share one build.
const build = () => {
  if (!buildPromise) {
    buildPromise = doBuild().finally(() => { buildPromise = null; });
  }
  return buildPromise;
};

const ensureReady = async () => {
  if (buildPromise) await buildPromise;
  if (!state.bm25) await build();
};

/**
 * Returns up to `k` chunks relevant to the query: [{ chunk, score, cosine }].
 */
const search = async (query, k = 5) => {
  await ensureReady();
  if (state.chunks.length === 0) return [];

  const fused = new Map();
  const addRank = (index, rank) => fused.set(index, (fused.get(index) || 0) + 1 / (RRF_K + rank + 1));

  const lexical = state.bm25.search(query).slice(0, 20);
  lexical.forEach((r, rank) => addRank(r.index, rank));

  const cosines = new Map();
  if (state.vectors) {
    try {
      const [queryVector] = await embedder.embed([query]);
      const dense = state.vectors
        .map((v, index) => ({ index, score: v ? embedder.dot(queryVector, v) : -1 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      dense.forEach((r, rank) => {
        cosines.set(r.index, r.score);
        // Weak semantic matches only count when the lexical ranker also found them.
        if (r.score >= MIN_COSINE || fused.has(r.index)) addRank(r.index, rank);
      });
    } catch (err) {
      console.warn('Query embedding failed, using keyword results only:', err.message);
    }
  }

  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([index, score]) => ({ chunk: state.chunks[index], score, cosine: cosines.get(index) ?? null }));
};

const stats = () => ({
  chunks: state.chunks.length,
  mode: state.vectors ? 'hybrid' : 'keyword-only',
  builtAt: state.builtAt,
});

module.exports = { build, search, stats, KNOWLEDGE_DIR };
