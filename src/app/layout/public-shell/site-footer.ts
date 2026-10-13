import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { GOVERNANCE_PATHS, governanceLinks } from '../../core/site/governance';
import { SiteStore } from '../../core/site/site.store';
import { Icon } from '../../shared/ui/icon/icon';
import type { IconName } from '../../shared/ui/icon/icon-names';
import { Logo } from '../../shared/ui/logo/logo';

interface SocialLink {
  key: string;
  url: string;
  icon: IconName;
}

/** How many governance sections the footer lists before Licences: main pages only. */
const FOOTER_SECTIONS = 3;

/** Phone width: the footer's link sections become an accordion. */
export const FOOTER_COMPACT_QUERY = '(max-width: 599.98px)';

/** Only http(s) URLs from the API are rendered (backend C10 validates too). */
function safeUrl(url: string | null | undefined): string | null {
  return url && /^https:\/\//i.test(url.trim()) ? url.trim() : null;
}

/**
 * Site footer: blurb and the social links that exist in settings, then three sections - main
 * pages, governance (W4) and contact (phone/email LTR) - then the rights line and the licence
 * number. Desktop: four columns; tablet: the about block as one row over three columns; phone:
 * the sections are an accordion. Lucide has no brand logos, so social links use generic icons
 * with the network name as the accessible label.
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, TranslocoPipe, Icon, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block bg-(--footer-bg) text-(--footer-text)' },
  template: `
    <footer class="wrap site-foot">
      <div class="sf-grid">
        <div class="sf-about">
          <app-logo class="sf-logo" [height]="64" [alt]="settings()?.orgName ?? null" />
          <p class="sf-blurb">
            {{ settings()?.footerBlurb ?? ('common.placeholder' | transloco) }}
          </p>
          @if (socials().length) {
            <ul class="sf-social" [attr.aria-label]="'shell.footer.social' | transloco">
              @for (s of socials(); track s.key) {
                <li>
                  <a
                    class="flex size-11 items-center justify-center rounded-btn border border-(--footer-muted)/40 text-(--footer-link) hover:text-(--footer-text)"
                    [href]="s.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    [attr.aria-label]="'shell.social.' + s.key | transloco"
                  >
                    <app-icon [name]="s.icon" [size]="18" />
                  </a>
                </li>
              }
            </ul>
          }
        </div>

        <!-- Main pages only; every page is in the header menu. On a phone each section is an
             accordion (compact()); on wider screens, on the server and without JS it is open. -->
        <details class="sf-sec" [attr.open]="compact() ? null : ''" (toggle)="keepOpen($event)">
          <summary [attr.tabindex]="compact() ? null : -1" (click)="lockWide($event)">
            <h2 id="f-key" class="sf-h">{{ 'shell.footer.keyLinks' | transloco }}</h2>
          </summary>
          <nav class="sf-links" aria-labelledby="f-key">
            @for (l of keyLinks; track l.path) {
              <a class="footer-link" [routerLink]="locale.link(l.path)">{{ l.key | transloco }}</a>
            }
          </nav>
        </details>

        <details class="sf-sec" [attr.open]="compact() ? null : ''" (toggle)="keepOpen($event)">
          <summary [attr.tabindex]="compact() ? null : -1" (click)="lockWide($event)">
            <h2 id="f-governance" class="sf-h">{{ 'shell.footer.governance' | transloco }}</h2>
          </summary>
          <nav class="sf-links" aria-labelledby="f-governance">
            @for (l of governance(); track l.key) {
              <a class="footer-link" [routerLink]="locale.link(l.path)">{{
                l.label ?? (l.labelKey! | transloco)
              }}</a>
            }
          </nav>
        </details>

        <details class="sf-sec" [attr.open]="compact() ? null : ''" (toggle)="keepOpen($event)">
          <summary [attr.tabindex]="compact() ? null : -1" (click)="lockWide($event)">
            <h2 class="sf-h">{{ 'shell.footer.contact' | transloco }}</h2>
          </summary>
          <div class="sf-links sf-contact">
            @if (contact()?.phone; as phone) {
              <a
                class="footer-link inline-flex items-center gap-2"
                [href]="'tel:' + telHref(phone)"
              >
                <app-icon name="phone" [size]="18" />
                <span class="sr-only">{{ 'shell.phone' | transloco }}:</span>
                <bdi class="ltr">{{ phone }}</bdi>
              </a>
            }
            @if (contact()?.email; as email) {
              <a class="footer-link inline-flex items-center gap-2" [href]="'mailto:' + email">
                <app-icon name="mail" [size]="18" />
                <span class="sr-only">{{ 'shell.email' | transloco }}:</span>
                <bdi class="ltr">{{ email }}</bdi>
              </a>
            }
            @if (contact()?.address; as address) {
              <p class="inline-flex items-start gap-2 text-(--footer-link)">
                <app-icon name="map-pin" [size]="18" class="mt-1" />
                <span class="sr-only">{{ 'shell.address' | transloco }}:</span>
                <span>{{ address }}</span>
              </p>
            }
          </div>
        </details>
      </div>

      <div class="sf-bottom">
        <p>{{ settings()?.rightsLine ?? ('common.placeholder' | transloco) }}</p>
        @if (licenceNo(); as no) {
          <a
            class="footer-link"
            [routerLink]="locale.link(licencesPath)"
            data-testid="footer-licence"
            >{{ 'shell.footer.licenceNo' | transloco: { no } }}</a
          >
        }
      </div>
    </footer>
  `,
})
export class SiteFooter {
  protected readonly locale = inject(LocaleService);
  private readonly site = inject(SiteStore);
  protected readonly settings = computed(() => this.site.site()?.settings ?? null);
  protected readonly contact = computed(() => this.site.site()?.contact ?? null);
  protected readonly licencesPath = GOVERNANCE_PATHS.licences;
  /** The licence number (site settings) for the bottom bar; hidden when unset. */
  protected readonly licenceNo = computed(() => this.settings()?.licenceNo?.trim() || null);
  /** The main governance sections (the first three) + Licences; the board has its own link. */
  protected readonly governance = computed(() => {
    const links = governanceLinks(this.site.sections(), { board: false });
    const sections = links.filter((l) => l.key !== 'licences').slice(0, FOOTER_SECTIONS);
    return [...sections, ...links.filter((l) => l.key === 'licences')];
  });

  /** Main pages only; the org structure and the rest are in the header's menus. */
  protected readonly keyLinks = [
    { key: 'shell.footer.about', path: '/about' },
    { key: 'shell.footer.board', path: '/board' },
    { key: 'shell.footer.work', path: '/work-areas' },
    { key: 'shell.footer.news', path: '/news' },
    { key: 'shell.footer.contactLink', path: '/contact' },
  ];

  /**
   * Phone width, known only in the browser. False on the server, so the prerendered footer has
   * every section open and works without JS.
   */
  protected readonly compact = signal(false);

  constructor() {
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const mq = document.defaultView?.matchMedia?.(FOOTER_COMPACT_QUERY);
      if (!mq) {
        return;
      }
      this.compact.set(mq.matches);
      const onChange = (e: MediaQueryListEvent) => this.compact.set(e.matches);
      mq.addEventListener('change', onChange);
      destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));
    });
  }

  /** On wider screens a section is not an accordion: its heading does nothing. */
  protected lockWide(event: Event): void {
    if (!this.compact()) {
      event.preventDefault();
    }
  }

  /** Belt and braces for lockWide: re-open a wide-screen section that closed anyway. */
  protected keepOpen(event: Event): void {
    const details = event.target as HTMLDetailsElement;
    if (!this.compact() && !details.open) {
      details.open = true;
    }
  }

  protected readonly socials = computed<SocialLink[]>(() => {
    const s = this.settings();
    if (!s) {
      return [];
    }
    const candidates: [string, string | null | undefined, IconName][] = [
      ['facebook', s.facebookUrl, 'share-2'],
      ['instagram', s.instagramUrl, 'image'],
      ['x', s.xUrl, 'message-circle'],
      ['youtube', s.youtubeUrl, 'monitor'],
      ['linkedin', s.linkedinUrl, 'briefcase'],
      ['whatsapp', s.whatsappUrl, 'phone'],
      ['tiktok', s.tiktokUrl, 'sparkles'],
    ];
    return candidates.flatMap(([key, url, icon]) => {
      const safe = safeUrl(url);
      return safe ? [{ key, url: safe, icon }] : [];
    });
  });

  protected telHref(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }
}
