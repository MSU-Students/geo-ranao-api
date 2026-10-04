import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  fullName: string;
}

// passport-google-oauth20's Strategy throws at construction time if
// clientID/clientSecret/callbackURL are missing — placeholder values here
// let the app boot (and every other, unrelated route keep working) even
// before real Google OAuth credentials are set. AuthController checks
// `googleAuthConfigured` itself and refuses /auth/google with a clear error
// instead of ever actually reaching Google with these placeholders.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);
  static configured = false;

  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ??
      'http://localhost:3333/auth/google/callback';

    super({
      clientID: clientID ?? 'not-configured',
      clientSecret: clientSecret ?? 'not-configured',
      callbackURL,
      scope: ['email', 'profile'],
    });

    GoogleStrategy.configured = !!(clientID && clientSecret);
    if (!GoogleStrategy.configured) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google Sign-In will refuse requests until configured.',
      );
    }
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      // Shouldn't happen with the 'email' scope requested above, but
      // validate() has no clean way to reject — AuthController's callback
      // handler checks for this and responds with a clear error instead.
      throw new Error('Google account has no email address to sign in with.');
    }
    return {
      googleId: profile.id,
      email,
      fullName: profile.displayName || email,
    };
  }
}
