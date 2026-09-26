/**
 * All mock fixtures, keyed by name. Imported by the Node mock server and by the dev-only Angular
 * mock interceptor (same files, review F6). Add a fixture: create mocks/fixtures/<name>.json and
 * list it here.
 */
import site from './fixtures/site.json' with { type: 'json' };
import roles from './fixtures/roles.json' with { type: 'json' };
import staff from './fixtures/staff.json' with { type: 'json' };

export const fixtures = { site, roles, staff };
