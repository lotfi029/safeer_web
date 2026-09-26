import type { HttpInterceptorFn } from '@angular/common/http';

/** Production/e2e: no mock code is bundled (scripts/check-prod-artifact.mjs verifies it). */
export const MOCK_INTERCEPTORS: HttpInterceptorFn[] = [];
