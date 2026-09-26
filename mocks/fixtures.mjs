/**
 * All mock fixtures, keyed by name. Imported by the Node mock server and by the dev-only Angular
 * mock interceptor (same files, review F6). Add a fixture: create mocks/fixtures/<name>.json and
 * list it here.
 */
import site from './fixtures/site.json' with { type: 'json' };
import roles from './fixtures/roles.json' with { type: 'json' };
import staff from './fixtures/staff.json' with { type: 'json' };
import redirects from './fixtures/redirects.json' with { type: 'json' };
import home from './fixtures/home.json' with { type: 'json' };
import pages from './fixtures/pages.json' with { type: 'json' };
import aboutItems from './fixtures/aboutItems.json' with { type: 'json' };
import workAreas from './fixtures/workAreas.json' with { type: 'json' };
import board from './fixtures/board.json' with { type: 'json' };
import testimonials from './fixtures/testimonials.json' with { type: 'json' };
import partners from './fixtures/partners.json' with { type: 'json' };
import documents from './fixtures/documents.json' with { type: 'json' };
import newsCategories from './fixtures/newsCategories.json' with { type: 'json' };
import posts from './fixtures/posts.json' with { type: 'json' };

export const fixtures = {
  site,
  roles,
  staff,
  redirects,
  home,
  pages,
  aboutItems,
  workAreas,
  board,
  testimonials,
  partners,
  documents,
  newsCategories,
  posts,
};
