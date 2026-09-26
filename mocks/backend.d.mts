export declare const MOCK_OTP_CODE: string;
export declare const MOCK_STAFF_PASSWORD: string;

export interface MockRequest {
  method: string;
  /** Path + query, e.g. `/api/v1/news?page=2`. */
  url: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockBackend {
  handle(req: MockRequest): MockResponse;
  db: unknown;
}

export declare function createMockBackend(fixtures: Record<string, unknown>): MockBackend;
