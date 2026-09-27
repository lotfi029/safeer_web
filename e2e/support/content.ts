import { randomInt } from 'node:crypto';
import sharp from 'sharp';
import { usingMockApi } from './env';
import { setupAdmin } from './real-api';

/** A unique small PNG (the API dedupes identical uploads by checksum and sniffs real image bytes). */
export async function uniquePng(name = `e2e-${randomInt(1e8, 1e9)}.png`) {
  const buffer = await sharp({
    create: {
      width: 64,
      height: 40,
      channels: 3,
      background: { r: randomInt(0, 255), g: randomInt(0, 255), b: randomInt(0, 255) },
    },
  })
    .png()
    .toBuffer();
  return { name, mimeType: 'image/png', buffer };
}

/** A minimal, unique PDF. */
export function uniquePdf(name = `e2e-${randomInt(1e8, 1e9)}.pdf`) {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(
      `%PDF-1.4\n%${randomInt(1e8, 1e9)}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`,
    ),
  };
}

/** Letters only (the API's person-name rule); a unique Latin tag. */
export function tagOf(prefix: string): string {
  return `${prefix} ${String(randomInt(1e6, 1e7)).replace(/[0-9]/g, (d) => 'abcdefghij'[Number(d)])}`;
}

/** Content rows through the admin API (setup and cleanup around UI steps). */
export const content = {
  async create<T = { id: string }>(endpoint: string, body: object): Promise<T> {
    return (await setupAdmin()).post<T>(`admin/${endpoint}`, body);
  },
  async remove(endpoint: string, id: string): Promise<void> {
    await (await setupAdmin()).del(`admin/${endpoint}/${id}`).catch(() => undefined);
  },
  async list<T = { id: string }>(endpoint: string, params: Record<string, string | number> = {}) {
    return (await setupAdmin()).get<{ data: T[]; total: number }>(`admin/${endpoint}`, {
      limit: 100,
      ...params,
    });
  },
  async patch<T = { id: string }>(endpoint: string, id: string, body: object): Promise<T> {
    return (await setupAdmin()).patch<T>(`admin/${endpoint}/${id}`, body);
  },
};

// ---------------------------------------------------------------- public content setups (both backends)

const created: Array<[string, string]> = [];

/** Deletes what the helpers below created (call from afterAll). */
export async function cleanupContent(): Promise<void> {
  if (usingMockApi) return;
  for (const [endpoint, id] of created.splice(0).reverse()) await content.remove(endpoint, id);
}

/** Real API: at least one published testimonial quote (the dev seed has none). Mock: the fixtures have them. */
export async function ensurePublishedTestimonial(): Promise<void> {
  if (usingMockApi) return;
  const row = await content.create<{ id: string }>('testimonials', {
    quoteAr: '[نص شهادة منشورة]',
    authorName: tagOf('Author'),
    status: 'published',
  });
  created.push(['testimonials', row.id]);
}

/** Real API: more published stories than one public page (6). Mock: the fixtures have enough. */
export async function ensureNewsPages(pageSize = 6): Promise<void> {
  if (usingMockApi) return;
  const cats = await content.list<{ id: string }>('news-categories');
  const published = await content.list('news', { published: 'true', isLegacy: 0 });
  for (let i = published.total; i <= pageSize; i++) {
    const row = await content.create<{ id: string }>('news', {
      titleAr: `[${tagOf('Story')}]`,
      categoryId: cats.data[0].id,
      publishedOn: '2020-01-01',
      isPublished: true,
    });
    created.push(['news', row.id]);
  }
}

/**
 * An unpublished story with a cover and a preview token. Real API: created through the admin API
 * (the body tries to smuggle HTML, which the API and the client must both strip). Mock: the
 * fixture draft `draft-preview` and its fixed token.
 */
export async function draftWithPreview(): Promise<{ slug: string; token: string }> {
  if (usingMockApi) return { slug: 'draft-preview', token: 'mock-preview' };
  const admin = await setupAdmin();
  const png = await uniquePng();
  const res = await admin.ctx.post('admin/media', {
    multipart: { file: { name: png.name, mimeType: png.mimeType, buffer: png.buffer } },
    headers: { 'x-csrf-token': admin.csrf },
  });
  const asset = (await res.json()) as { id: string };
  await admin.patch(`admin/media/${asset.id}`, { altAr: '[غلاف]' });
  const cats = await content.list<{ id: string }>('news-categories');
  const post = await admin.post<{ id: string; slug: string }>('admin/news', {
    titleAr: '[مسودة]',
    titleEn: tagOf('Draft'),
    categoryId: cats.data[0].id,
    coverAssetId: asset.id,
    bodyAr: 'Text <img src=x onerror="window.__xss=1"><script>window.__xss=2</script>',
    bodyEn: 'Text <img src=x onerror="window.__xss=1"><script>window.__xss=2</script>',
  });
  created.push(['media', asset.id], ['news', post.id]);
  const { token } = await admin.get<{ token: string }>('admin/preview-token', {
    collection: 'posts',
    id: post.id,
  });
  return { slug: post.slug, token };
}
