import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { SiteStore } from '../../core/site/site.store';
import { Icon } from '../../shared/ui/icon/icon';
import type { IconName } from '../../shared/ui/icon/icon-names';
import { Logo } from '../../shared/ui/logo/logo';

interface SocialLink {
  key: string;
  url: string;
  icon: IconName;
}

/** Only http(s) URLs from the API are rendered (backend C10 validates too). */
function safeUrl(url: string | null | undefined): string | null {
  return url && /^https:\/\//i.test(url.trim()) ? url.trim() : null;
}

/**
 * Site footer (prototype `siteFoot`): blurb, key links, services, contact (phone/email LTR),
 * social links that exist in settings, rights line. Lucide has no brand logos, so social links use
 * generic icons with the network name as the accessible label.
 */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink, TranslocoPipe, Icon, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block bg-(--footer-bg) text-(--footer-text)' },
  template: `
    <footer class="wrap pt-14 pb-7 md:pt-16">
      <div class="grid gap-10 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
        <div class="flex max-w-100 flex-col gap-4">
          <app-logo class="self-start" [height]="64" [alt]="settings()?.orgName ?? null" />
          <p class="leading-[1.9] text-(--footer-link)">
            {{ settings()?.footerBlurb ?? ('common.placeholder' | transloco) }}
          </p>
        </div>

        <nav class="flex flex-col gap-3 text-[15px]" [attr.aria-labelledby]="'f-key'">
          <h2 id="f-key" class="mb-1 text-lg font-semibold !text-(--footer-text)">
            {{ 'shell.footer.keyLinks' | transloco }}
          </h2>
          @for (l of keyLinks; track l.path) {
            <a class="footer-link" [routerLink]="locale.link(l.path)">{{ l.key | transloco }}</a>
          }
        </nav>

        <nav class="flex flex-col gap-3 text-[15px]" [attr.aria-labelledby]="'f-services'">
          <h2 id="f-services" class="mb-1 text-lg font-semibold !text-(--footer-text)">
            {{ 'shell.footer.services' | transloco }}
          </h2>
          @for (l of serviceLinks; track l.path) {
            <a class="footer-link" [routerLink]="locale.link(l.path)">{{ l.key | transloco }}</a>
          }
        </nav>

        <div class="flex flex-col gap-3 text-[15px]">
          <h2 class="mb-1 text-lg font-semibold !text-(--footer-text)">
            {{ 'shell.footer.contact' | transloco }}
          </h2>
          @if (contact()?.phone; as phone) {
            <a class="footer-link inline-flex items-center gap-2" [href]="'tel:' + telHref(phone)">
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
          @if (socials().length) {
            <ul
              class="m-0 mt-1 flex list-none flex-wrap gap-3 p-0"
              [attr.aria-label]="'shell.footer.social' | transloco"
            >
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
      </div>

      <div
        class="mt-10 flex flex-col gap-3 border-t border-(--footer-muted)/25 pt-6 text-sm text-(--footer-muted) md:flex-row md:items-center md:justify-between"
      >
        <p>{{ settings()?.rightsLine ?? ('common.placeholder' | transloco) }}</p>
      </div>
    </footer>
  `,
})
export class SiteFooter {
  protected readonly locale = inject(LocaleService);
  private readonly site = inject(SiteStore);
  protected readonly settings = computed(() => this.site.site()?.settings ?? null);
  protected readonly contact = computed(() => this.site.site()?.contact ?? null);

  protected readonly keyLinks = [
    { key: 'shell.footer.about', path: '/about' },
    { key: 'shell.footer.board', path: '/board' },
    { key: 'shell.footer.documents', path: '/documents' },
    { key: 'shell.footer.work', path: '/work-areas' },
  ];
  protected readonly serviceLinks = [
    { key: 'shell.footer.scholarships', path: '/scholarships' },
    { key: 'shell.footer.applyLink', path: '/apply' },
    { key: 'shell.portal', path: '/portal' },
    { key: 'shell.footer.news', path: '/news' },
  ];

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
