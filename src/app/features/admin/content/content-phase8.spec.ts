import { mediaUrl } from '../../../core/api/admin/content-api';
import { COLLECTIONS } from './crud/collections';
import { emptyModel, fieldKeys, modelFromRow, pick, toBody, validate } from './crud/crud-config';
import { isLive, reorderedIds } from './crud/crud-list';
import { applyTool } from './markdown/markdown-editor';
import { renderMarkdown } from './markdown/render-markdown';
import { uploadProblem } from './media/media-uploader';
import { newsQuery } from './news/news-list';
import { slugProblem } from './news/news-editor';
import { publicPathOf } from './pages/page-editor';

describe('CRUD config helpers', () => {
  const fields = COLLECTIONS['partners'].fields;

  it('expands bilingual fields into Ar/En keys', () => {
    expect(fieldKeys({ key: 'name', type: 'text', label: 'name', bilingual: true })).toEqual([
      'nameAr',
      'nameEn',
    ]);
    expect(Object.keys(emptyModel(fields))).toEqual([
      'category',
      'nameAr',
      'nameEn',
      'url',
      'logoAssetId',
    ]);
  });

  it('builds the body the DTOs accept: trimmed, empty optionals as null on update', () => {
    const model = { category: 'supporter', nameAr: '  اسم ', nameEn: '', url: '', logoAssetId: '' };
    expect(toBody(fields, model, 'create')).toEqual({
      category: 'supporter',
      nameAr: 'اسم',
      nameEn: null,
      url: null,
      logoAssetId: null,
    });
    const pages = COLLECTIONS['pages'].fields;
    const page = { ...emptyModel(pages), slug: 'about', titleAr: 'عن' };
    expect(toBody(pages, page, 'update')).not.toHaveProperty('slug');
    expect(toBody(pages, page, 'create')).toMatchObject({ slug: 'about', needsReview: false });
  });

  it('validates required Arabic, max length, digits and slugs like the API', () => {
    expect(validate(fields, { category: 'supporter', nameAr: '' })).toEqual({
      nameAr: ['required'],
    });
    expect(validate(COLLECTIONS['stats'].fields, { labelAr: 'x', value: '12a' })).toEqual({
      value: ['pattern'],
    });
    expect(
      validate(COLLECTIONS['docCategories'].fields, { slug: 'Bad Slug', nameAr: 'x' }),
    ).toEqual({ slug: ['slug'] });
    expect(validate(fields, { category: 'supporter', nameAr: 'x'.repeat(192) })).toEqual({
      nameAr: ['maxLength'],
    });
  });

  it('reads rows into the form and picks the UI language with an Arabic fallback', () => {
    const row = {
      id: '1',
      nameAr: 'أ',
      nameEn: null,
      category: 'government',
      url: null,
      logoAssetId: null,
    };
    expect(modelFromRow(fields, row)).toMatchObject({ nameEn: '', url: '' });
    expect(pick(row, 'name', 'en')).toBe('أ');
    expect(pick({ ...row, nameEn: 'A' }, 'name', 'en')).toBe('A');
  });
});

describe('CRUD list', () => {
  it('renumbers the whole list after a move', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(reorderedIds(rows, 0, 2).body).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'c', sortOrder: 1 },
      { id: 'a', sortOrder: 2 },
    ]);
  });

  it('knows visibility per collection type', () => {
    expect(isLive(COLLECTIONS['partners'], { id: '1', isPublished: false })).toBe(false);
    expect(isLive(COLLECTIONS['testimonials'], { id: '1', status: 'published' })).toBe(true);
    expect(isLive(COLLECTIONS['testimonials'], { id: '1', status: 'pending' })).toBe(false);
  });
});

describe('Markdown', () => {
  it('keeps the API allow-list only (no raw HTML, no javascript: links, headings from h2)', () => {
    const html = renderMarkdown(
      '# Title\n\n**b** <img src=x onerror="alert(1)"><script>alert(2)</script> [x](javascript:alert(3))',
    );
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<strong>b</strong>');
    expect(html).not.toMatch(/<img|<script|onerror|javascript:/);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('toolbar wraps the selection or prefixes lines', () => {
    expect(applyTool('a word b', 2, 6, { before: '**', after: '**' })).toEqual({
      text: 'a **word** b',
      start: 4,
      end: 8,
    });
    expect(applyTool('one\ntwo', 0, 7, { before: '- ', line: true }).text).toBe('- one\n- two');
  });
});

describe('news helpers', () => {
  it('turns filters into the admin query (booleans as 1/0)', () => {
    expect(newsQuery('legacy', ' q ', 2)).toMatchObject({ isLegacy: 1, q: 'q', page: 2 });
    expect(newsQuery('draft', null, 1)).toMatchObject({ published: false });
    expect(newsQuery('bogus', null, 0)).toEqual({ page: 1, limit: 20, q: null });
  });

  it('checks slugs like slugSchema + RESERVED_POST_SLUGS', () => {
    expect(slugProblem('annual-report-2024')).toBeNull();
    expect(slugProblem('Annual')).toBe('slug');
    expect(slugProblem('a--b')).toBe('slug');
    expect(slugProblem('categories')).toBe('reserved');
    expect(slugProblem('')).toBe('required');
  });
});

describe('media and pages helpers', () => {
  it('builds /files URLs with image variants only', () => {
    expect(mediaUrl({ publicId: 'p', kind: 'image' }, 'thumb')).toBe('/files/p/thumb');
    expect(mediaUrl({ publicId: 'p', kind: 'pdf' }, 'thumb')).toBe('/files/p');
  });

  it('checks uploads like the API (types and sizes)', () => {
    expect(uploadProblem({ type: 'image/svg+xml', size: 1 })).toBe('admin.media.errors.type');
    expect(uploadProblem({ type: 'image/png', size: 6 * 1024 * 1024 })).toBe(
      'admin.media.errors.imageSize',
    );
    expect(uploadProblem({ type: 'application/pdf', size: 1 }, 'image')).toBe(
      'admin.media.errors.imageOnly',
    );
    expect(uploadProblem({ type: 'application/pdf', size: 9 * 1024 * 1024 }, 'pdf')).toBeNull();
  });

  it('maps CMS page slugs to public paths', () => {
    expect(publicPathOf('home')).toBe('');
    expect(publicPathOf('work')).toBe('/work-areas');
    expect(publicPathOf('about')).toBe('/about');
  });
});
