import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Like JwtAuthGuard, but never rejects the request over a missing or invalid
// token — req.user is populated when a valid token is present, and left
// undefined otherwise. For endpoints that serve a public read-only view
// (the map, the dashboards) but still tailor their response for a logged-in
// researcher/admin (e.g. "show me my own pending submissions too").
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    return user;
  }
}
