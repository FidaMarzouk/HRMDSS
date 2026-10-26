// Local sentence embeddings (no API key needed; Groq has no embeddings endpoint).
// The ONNX model is downloaded from Hugging Face on first use and cached locally.

const MODEL = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

let extractorPromise = null;

let loaded = false;

const getExtractor = () => {
  if (!extractorPromise) {
    const { pipeline } = require('@huggingface/transformers');
    extractorPromise = pipeline('feature-extraction', MODEL, { dtype: 'fp32' })
      .then((extractor) => {
        loaded = true;
        return extractor;
      })
      .catch((err) => {
        extractorPromise = null; // allow a later retry
        throw err;
      });
  }
  return extractorPromise;
};

// Returns L2-normalized vectors, so cosine similarity is a dot product.
const embed = async (texts) => {
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
};

const dot = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

// Starts loading the model (downloading it the first time) without waiting for it.
const warm = () => {
  getExtractor().catch((err) => console.warn('Embedding model unavailable:', err.message));
};

module.exports = { MODEL, embed, dot, warm, isReady: () => loaded };
