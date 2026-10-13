import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { RETIRED_ROUTES } from './public.routes';

@Component({ template: 'ok' })
class Page {}

describe('retired routes (W5, client-side navigation)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: ':lang',
            children: [
              { path: '', children: [...RETIRED_ROUTES, { path: '**', component: Page }] },
            ],
          },
        ]),
      ],
    });
  });

  const cases: [string, string][] = [
    ['/ar/apply', '/ar/contact'],
    ['/en/scholarships', '/en/contact'],
    ['/ar/portal', '/ar/contact'],
    ['/ar/portal/documents', '/ar/contact'],
    ['/ar/documents', '/ar/governance'],
    ['/ar/documents?category=meeting-minutes', '/ar/governance/general-assembly'],
    ['/en/documents?category=policies-regulations', '/en/governance/bylaws-policies'],
    ['/ar/documents?category=licences', '/ar/governance/licences'],
  ];
  for (const [from, to] of cases) {
    it(`${from} → ${to}`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(from);
      expect(TestBed.inject(Router).url).toBe(to);
    });
  }
});
