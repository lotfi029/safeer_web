import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import type { NewsCategory, Page, Paged, PostDetail, PostSummary } from '../../../core/api/models';
import { PublicApi } from '../../../core/api/public-api';
import { loadCritical, type Loaded } from '../../../core/data/loaded';

// Resolvers live apart from the page components: public.routes.ts imports them statically, so this
// file lands in the initial bundle while the components stay in their lazy chunks.

export const NEWS_PAGE_SIZE = 6;

export interface NewsFilters {
  category: string | null;
  q: string | null;
  page: number;
}

export interface NewsListData {
  page: Page;
  list: Paged<PostSummary>;
  categories: NewsCategory[];
  featured: PostSummary | null;
  filters: NewsFilters;
}

/** Filters live in the URL (`?category=&q=&page=`), so every SSR'd list page is crawlable. */
export function newsFilters(route: ActivatedRouteSnapshot): NewsFilters {
  const qp = route.queryParamMap;
  const page = Number.parseInt(qp.get('page') ?? '', 10);
  return {
    category: qp.get('category')?.trim() || null,
    q: qp.get('q')?.trim().slice(0, 100) || null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/**
 * Critical: page meta + the list. Secondary (degrade to empty, F8): categories and featured. An
 * unknown `?category=` is a 400 from the API (C42), rendered as not-found (404), never a 500.
 */
export const newsListResolver: ResolveFn<Loaded<NewsListData>> = (route) => {
  const api = inject(PublicApi);
  const filters = newsFilters(route);
  const unfiltered = !filters.category && !filters.q && filters.page === 1;
  return loadCritical(
    forkJoin({
      page: api.page('news'),
      list: api.news({ ...filters, limit: NEWS_PAGE_SIZE }),
      categories: api.newsCategories().pipe(catchError(() => of([] as NewsCategory[]))),
      featured: unfiltered
        ? api.featuredNews().pipe(catchError(() => of(null)))
        : of<PostSummary | null>(null),
      filters: of(filters),
    }),
    (problem) => !!filters.category && problem.status === 400,
  );
};

export interface ArticleData {
  post: PostDetail;
  categories: NewsCategory[];
  preview: boolean;
}

/** Critical: the post (404 → not-found page with status 404). `?preview=` is passed through. */
export const articleResolver: ResolveFn<Loaded<ArticleData>> = (route) => {
  const api = inject(PublicApi);
  const slug = route.paramMap.get('slug') ?? '';
  const preview = route.queryParamMap.get('preview');
  return loadCritical(
    forkJoin({
      post: api.post(slug, preview),
      categories: api.newsCategories().pipe(catchError(() => of([] as NewsCategory[]))),
      preview: of(!!preview),
    }),
  );
};
