// Minimal BM25 lexical ranking, used alongside embeddings so exact terms
// ("12:30", "Emergency Leave", "punch-in") are matched reliably.

const STOPWORDS = new Set(('a an and are as at be by can do does for from how i if in is it its my me of on or ' +
  'our so that the their there this to was we what when where which who why will with you your ' +
  'le la les de des du un une et en est pour que qui dans').split(' '));

// Light suffix stripping so "booking"/"booked"/"books" all match "book".
const stem = (t) => {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
};

const tokenize = (text) =>
  (text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+(?::[0-9]+)?/g) || [])
    .filter((t) => !STOPWORDS.has(t))
    .map(stem);

class BM25 {
  constructor(documents, { k1 = 1.5, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docs = documents.map((d) => {
      const tokens = tokenize(d);
      const tf = new Map();
      tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      return { tf, length: tokens.length };
    });
    this.avgLength = this.docs.reduce((n, d) => n + d.length, 0) / Math.max(1, this.docs.length);
    this.df = new Map();
    this.docs.forEach((d) => d.tf.forEach((_, t) => this.df.set(t, (this.df.get(t) || 0) + 1)));
  }

  idf(term) {
    const n = this.docs.length;
    const df = this.df.get(term) || 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  // Returns [{ index, score }] sorted by descending score, zero scores omitted.
  search(query) {
    const terms = [...new Set(tokenize(query))];
    const results = [];
    this.docs.forEach((doc, index) => {
      let score = 0;
      for (const term of terms) {
        const f = doc.tf.get(term);
        if (!f) continue;
        const norm = f * (this.k1 + 1) / (f + this.k1 * (1 - this.b + this.b * doc.length / this.avgLength));
        score += this.idf(term) * norm;
      }
      if (score > 0) results.push({ index, score });
    });
    return results.sort((a, b) => b.score - a.score);
  }
}

module.exports = { BM25, tokenize };
