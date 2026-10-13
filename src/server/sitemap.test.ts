import { describe, expect, it } from 'vitest';
import { buildRobots, buildSitemap } from './sitemap';

describe('sitemap.xml', () => {
  const xml = buildSitemap('https://safeer-sa.org', {
    pages: [
      { slug: 'about', updatedAt: '2026-09-01T10:00:00Z' },
      { slug: 'work', updatedAt: '2026-08-01T00:00:00Z' },
    ],
    posts: [
      { slug: 'dates-distribution', updatedAt: '2020-07-30' },
      { slug: 'bad slug<', updatedAt: 'x' },
    ],
    categories: [{ slug: 'community' }],
  });

  it('lists every public route in both languages with hreflang alternates', () => {
    expect(xml).toContain('<loc>https://safeer-sa.org/ar</loc>');
    expect(xml).toContain('<loc>https://safeer-sa.org/en/work-areas</loc>');
    expect(xml).toContain('hreflang="x-default" href="https://safeer-sa.org/ar/about"');
    expect(xml).toContain('<lastmod>2026-09-01</lastmod>');
  });

  it('adds posts and skips unsafe slugs', () => {
    expect(xml).toContain('<loc>https://safeer-sa.org/ar/news/dates-distribution</loc>');
    expect(xml).not.toContain('bad slug');
  });

  it('no longer lists the removed routes (scholarships, apply, documents)', () => {
    expect(xml).not.toContain('/scholarships');
    expect(xml).not.toContain('/apply');
    expect(xml).not.toContain('/documents');
  });

  it('lists the governance pages: licences and each section (seeded ones without the API)', () => {
    expect(xml).toContain('<loc>https://safeer-sa.org/ar/governance/licences</loc>');
    expect(xml).toContain('<loc>https://safeer-sa.org/ar/about/org-structure</loc>');
    expect(xml).toContain('<loc>https://safeer-sa.org/en/governance/bylaws-policies</loc>');
    expect(xml).toContain('<loc>https://safeer-sa.org/ar/governance/committee-decisions</loc>');
    const fromApi = buildSitemap('https://safeer-sa.org', {
      pages: [],
      posts: [],
      categories: [],
      governanceSections: ['financial-reports', 'Bad slug', 'licences'],
    });
    expect(fromApi).toContain('<loc>https://safeer-sa.org/ar/governance/financial-reports</loc>');
    expect(fromApi).not.toContain('/governance/bylaws-policies');
    expect(fromApi).not.toContain('Bad slug');
    expect(fromApi.match(/governance\/licences</g)).toHaveLength(2);
  });

  it('still lists static routes when the index is unavailable', () => {
    expect(buildSitemap('https://safeer-sa.org', null)).toContain(
      '<loc>https://safeer-sa.org/en/contact</loc>',
    );
  });

  it('robots.txt disallows admin and points to the sitemap', () => {
    const robots = buildRobots('https://safeer-sa.org');
    expect(robots).toContain('Disallow: /ar/admin');
    expect(robots).not.toContain('portal');
    expect(robots).toContain('Sitemap: https://safeer-sa.org/sitemap.xml');
  });
});
