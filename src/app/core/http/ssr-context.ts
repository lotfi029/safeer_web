/** Per-request data handed from `server.ts` to the Angular app through `REQUEST_CONTEXT`. */
export interface SsrRequestContext {
  /** Client IP as resolved by Express `trust proxy` (sessions plan R3). */
  readonly clientIp?: string;
  /** Raw `Accept-Language` header of the visitor. */
  readonly acceptLanguage?: string;
}
