import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../config/api-base-url';
import type {
  AboutItemKind,
  AboutItemsResponse,
  BoardMember,
  ContactRequest,
  Country,
  DocumentGroup,
  HomeResponse,
  NewsCategory,
  NewsletterRequest,
  OkResponse,
  Page,
  Paged,
  Partner,
  PartnerCategory,
  PostDetail,
  PostSummary,
  SiteResponse,
  SitemapIndex,
  TestimonialsResponse,
  WorkArea,
} from './models';

export interface NewsQuery {
  category?: string | null;
  q?: string | null;
  page?: number;
  limit?: number;
}

/**
 * Public (anonymous) endpoints. The locale interceptor adds `?lang=` + `Accept-Language`; public
 * GETs are the only requests the HTTP transfer cache carries.
 */
@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);

  site(): Observable<SiteResponse> {
    return this.http.get<SiteResponse>(`${API_PREFIX}/site`);
  }

  home(): Observable<HomeResponse> {
    return this.http.get<HomeResponse>(`${API_PREFIX}/home`);
  }

  page(slug: string): Observable<Page> {
    return this.http.get<Page>(`${API_PREFIX}/pages/${encodeURIComponent(slug)}`);
  }

  /** B18 (mocked until live). */
  aboutItems(kinds: AboutItemKind[]): Observable<AboutItemsResponse> {
    return this.http.get<AboutItemsResponse>(`${API_PREFIX}/about-items`, {
      params: { kind: kinds.join(',') },
    });
  }

  board(): Observable<BoardMember[]> {
    return this.http.get<BoardMember[]>(`${API_PREFIX}/board`);
  }

  workAreas(): Observable<WorkArea[]> {
    return this.http.get<WorkArea[]>(`${API_PREFIX}/work-areas`);
  }

  testimonials(): Observable<TestimonialsResponse> {
    return this.http.get<TestimonialsResponse>(`${API_PREFIX}/testimonials`);
  }

  partners(category?: PartnerCategory | null): Observable<Partner[]> {
    const params = category ? new HttpParams().set('category', category) : undefined;
    return this.http.get<Partner[]>(`${API_PREFIX}/partners`, { params });
  }

  documents(): Observable<DocumentGroup[]> {
    return this.http.get<DocumentGroup[]>(`${API_PREFIX}/documents`);
  }

  news(query: NewsQuery = {}): Observable<Paged<PostSummary>> {
    let params = new HttpParams();
    if (query.category) params = params.set('category', query.category);
    if (query.q) params = params.set('q', query.q);
    if (query.page && query.page > 1) params = params.set('page', query.page);
    if (query.limit) params = params.set('limit', query.limit);
    return this.http.get<Paged<PostSummary>>(`${API_PREFIX}/news`, { params });
  }

  featuredNews(): Observable<PostSummary | null> {
    return this.http.get<PostSummary | null>(`${API_PREFIX}/news/featured`);
  }

  newsCategories(): Observable<NewsCategory[]> {
    return this.http.get<NewsCategory[]>(`${API_PREFIX}/news-categories`);
  }

  post(slug: string, preview?: string | null): Observable<PostDetail> {
    const params = preview ? new HttpParams().set('preview', preview) : undefined;
    return this.http.get<PostDetail>(`${API_PREFIX}/news/${encodeURIComponent(slug)}`, { params });
  }

  countries(): Observable<Country[]> {
    return this.http.get<Country[]>(`${API_PREFIX}/meta/countries`);
  }

  /** B15 (mocked until live). */
  sitemapIndex(): Observable<SitemapIndex> {
    return this.http.get<SitemapIndex>(`${API_PREFIX}/sitemap-index`);
  }

  contact(body: ContactRequest): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/contact`, body);
  }

  newsletter(body: NewsletterRequest): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/newsletter`, body);
  }

  /** C27 (mocked until live). */
  newsletterConfirm(token: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/newsletter/confirm`, { token });
  }

  /** C27 (mocked until live). */
  newsletterUnsubscribe(token: string): Observable<OkResponse> {
    return this.http.post<OkResponse>(`${API_PREFIX}/newsletter/unsubscribe`, { token });
  }
}

/** Builds file URLs (`/files/*` is proxied, outside `/api/v1`). */
export function fileUrl(publicId: string, variant?: 'thumb' | 'card' | 'full'): string {
  const id = encodeURIComponent(publicId);
  return variant ? `/files/${id}/${variant}` : `/files/${id}`;
}
