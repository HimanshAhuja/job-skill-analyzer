import path from 'node:path';
import { pipeline, env } from '@huggingface/transformers';

// Use ./models if the model is cached there; otherwise it is downloaded once
// from the Hugging Face hub (Xenova/all-MiniLM-L6-v2, 384-d embeddings).
env.localModelPath = path.join(process.cwd(), 'models') + path.sep;

let extractor: Promise<any> | null = null;

/** Returns a normalised 384-dimensional sentence embedding for the text. */
export async function embed(text: string): Promise<number[]> {
  extractor ??= pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
  const model = await extractor;
  const out = await model(text.slice(0, 5000), { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}
