import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SITE_ORIGIN } from '../config/site-origin';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: SITE_ORIGIN, useValue: 'https://safeer-sa.org' }],
    });
  });

  it('sets title, description, canonical, hreflang and JSON-LD', () => {
    const seo = TestBed.inject(SeoService);
    const doc = TestBed.inject(DOCUMENT);
    seo.set({
      title: 'الأخبار',
      description: 'desc',
      path: '/news',
      lang: 'ar',
      jsonLd: [{ '@context': 'https://schema.org', '@type': 'NGO', name: '</script><script>x' }],
    });
    expect(doc.title).toBe('الأخبار | جمعية سفير الدعوية');
    expect(doc.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('desc');
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://safeer-sa.org/ar/news',
    );
    expect(doc.querySelector('link[hreflang="en"]')?.getAttribute('href')).toBe(
      'https://safeer-sa.org/en/news',
    );
    expect(doc.querySelector('link[hreflang="x-default"]')?.getAttribute('href')).toBe(
      'https://safeer-sa.org/ar/news',
    );
    const ld = doc.querySelector('#app-jsonld')!;
    expect(ld.getAttribute('type')).toBe('application/ld+json');
    expect(ld.textContent).not.toContain('</script>');
    expect(JSON.parse(ld.textContent!).name).toBe('</script><script>x');
  });

  it('home canonical has no trailing path and noindex is honoured', () => {
    const seo = TestBed.inject(SeoService);
    const doc = TestBed.inject(DOCUMENT);
    seo.set({ title: 'Home', path: '/', lang: 'en', noindex: true });
    expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://safeer-sa.org/en',
    );
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(doc.querySelector('#app-jsonld')).toBeNull();
  });

  it('noindex() drops the previous page’s canonical, hreflang, OG, Twitter and JSON-LD (W19)', () => {
    const seo = TestBed.inject(SeoService);
    const doc = TestBed.inject(DOCUMENT);
    seo.set({
      title: 'News',
      description: 'desc',
      path: '/news',
      lang: 'en',
      image: '/files/x',
      jsonLd: [{ '@type': 'NGO' }],
    });
    seo.noindex('Student portal', 'en');
    expect(doc.title).toBe('Student portal | Safeer Association');
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(doc.querySelector('meta[name="description"]')).toBeNull();
    expect(doc.querySelector('meta[name="twitter:card"]')).toBeNull();
    expect(doc.querySelectorAll('meta[property^="og:"]')).toHaveLength(0);
    expect(doc.querySelectorAll('link[rel="canonical"], link[rel="alternate"]')).toHaveLength(0);
    expect(doc.querySelector('#app-jsonld')).toBeNull();
  });
});
