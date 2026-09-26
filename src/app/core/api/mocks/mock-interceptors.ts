import type { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { mockBackendInterceptor } from './mock-backend.interceptor';

/**
 * Interceptors that fake the API in `ng serve` (environment.useMocks). Replaced by
 * mock-interceptors.prod.ts in the production and e2e builds (angular.json fileReplacements).
 */
export const MOCK_INTERCEPTORS: HttpInterceptorFn[] = environment.useMocks ? [mockBackendInterceptor] : [];
