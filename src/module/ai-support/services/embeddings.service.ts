import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Embeddings } from '@langchain/core/embeddings';

type FastEmbedInstance = {
  embed: (texts: string[]) => Promise<number[][]>;
};

// Local deterministic fallback (FNV + seeded PRNG) so unit tests and
// offline dev work without downloading the onnx model.
function hashEmbedding(text: string, dims: number): number[] {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ (c + 31), 16777619);
  }
  const out: number[] = [];
  let seed = (h1 >>> 0) ^ (h2 >>> 0);
  for (let i = 0; i < dims; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    out.push((seed / 0xffffffff) * 2 - 1);
  }
  // L2 normalize for cosine
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

@Injectable()
export class EmbeddingsService extends Embeddings {
  private readonly logger = new Logger(EmbeddingsService.name);
  private instance: FastEmbedInstance | null = null;
  private initPromise: Promise<FastEmbedInstance | null> | null = null;
  private readonly dims = 1024;
  private useFallback = false;

  constructor(private readonly config: ConfigService) {
    super({});
  }

  private async load(): Promise<FastEmbedInstance | null> {
    if (this.instance) return this.instance;
    if (this.useFallback) return null;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const { FlagEmbedding, EmbeddingModel } =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('fastembed') as typeof import('fastembed');
          const model = await FlagEmbedding.init({
            // multilingual-e5-large: Vietnamese-capable, 1024 dims
            model: EmbeddingModel.MLE5Large,
            cacheDir: this.config.get<string>(
              'FASTEMBED_CACHE_PATH',
              './.fastembed_cache',
            ),
          });
          this.instance = model as unknown as FastEmbedInstance;
          this.logger.log('FastEmbed multilingual-e5-large ready');
          return this.instance;
        } catch (e) {
          this.logger.warn(
            `FastEmbed init failed, using hash fallback: ${String(e)}`,
          );
          this.useFallback = true;
          return null;
        }
      })();
    }
    return this.initPromise;
  }

  async embedQuery(text: string): Promise<number[]> {
    const docs = await this.embedDocuments([text]);
    return docs[0] ?? hashEmbedding(text, this.dims);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const inst = await this.load();
    if (!inst) return texts.map((t) => hashEmbedding(t, this.dims));
    try {
      const vecs = await inst.embed(texts);
      if (!vecs || vecs.length !== texts.length) {
        return texts.map((t) => hashEmbedding(t, this.dims));
      }
      return vecs;
    } catch (e) {
      this.logger.warn(`FastEmbed embed failed, fallback: ${String(e)}`);
      return texts.map((t) => hashEmbedding(t, this.dims));
    }
  }
}
