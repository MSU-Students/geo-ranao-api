import { ConfigService } from '@nestjs/config';

// No hardcoded fallback here on purpose. A missing JWT_SECRET used to fall
// back silently to a literal string committed in this repo's own source —
// once the repo is pushed to GitHub (see DEPLOYMENT.md), anyone reading the
// code would know that fallback and could forge valid tokens for any
// deployment that forgot to set the real secret. Failing loudly at startup
// catches a missing JWT_SECRET immediately instead of it becoming a live
// security hole discovered later.
export function requireJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Generate a real random secret (e.g. `openssl rand -base64 48`) ' +
        'and set it in the environment before starting the server.',
    );
  }
  return secret;
}
