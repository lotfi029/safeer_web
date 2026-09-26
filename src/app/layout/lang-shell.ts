import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Wraps every `/:lang` route. The `langResolver` has already loaded the strings and set
 * `<html lang dir>` + CDK Directionality before this renders (server and client).
 */
@Component({
  selector: 'app-lang-shell',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<router-outlet />',
})
export class LangShell {}
