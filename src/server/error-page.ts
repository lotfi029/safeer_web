import type { NextFunction, Request, Response } from 'express';
import { buildCsp, cspHeaderName, createNonce } from './security-headers';

/** Static, script-free 500 page for failures outside Angular's own error handling. */
export const SERVER_ERROR_HTML = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>500</title></head><body><main><h1>حدث خطأ غير متوقع</h1><p>تعذّر عرض هذه الصفحة الآن. حاول مرة أخرى بعد قليل.</p><p lang="en" dir="ltr">Something went wrong. Please try again shortly.</p><p><a href="/ar">الرئيسية</a> · <a href="/en" lang="en">Home</a></p></main></body></html>`;

export function serverErrorHandler(isProduction: boolean) {
  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    console.error(`[ssr] ${req.method} ${req.originalUrl} failed:`, err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(cspHeaderName(isProduction), buildCsp(createNonce()));
    res.type('html').send(SERVER_ERROR_HTML);
  };
}
