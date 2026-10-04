import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleStrategy } from '../google.strategy';

// Runs before AuthGuard('google') on /auth/google — without this, a missing
// GOOGLE_CLIENT_ID/SECRET would send the browser to Google with a literal
// "not-configured" client_id (see GoogleStrategy), landing on a confusing
// Google-branded error page instead of a clear message from this server.
@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  canActivate(): boolean {
    if (!GoogleStrategy.configured) {
      throw new ServiceUnavailableException(
        'Google Sign-In is not configured on this server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing).',
      );
    }
    return true;
  }
}
