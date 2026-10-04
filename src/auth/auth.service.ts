import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserEntity, UserRole, AccountStatus } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { GoogleProfile } from './google.strategy';

const LOGIN_BLOCKED_MESSAGES: Partial<Record<AccountStatus, string>> = {
  [AccountStatus.PENDING]: 'Your account is still pending admin approval.',
  [AccountStatus.REJECTED]: 'Your researcher application was rejected.',
  [AccountStatus.SUSPENDED]: 'Your account access has been suspended.',
};

// The token handed back after a brand-new Google identity (no existing
// account by googleId or email) completes the OAuth round trip — just long
// enough to carry it to the "finish your profile" form (affiliation,
// purpose) without storing anything server-side in between. Signed with the
// same JWT secret as real login tokens but never accepted by JwtAuthGuard —
// the 'purpose' claim is what tells completeGoogleSignup() it's legitimate.
const GOOGLE_SIGNUP_TOKEN_PURPOSE = 'google-signup';
const GOOGLE_SIGNUP_TOKEN_TTL = '15m';

export type GoogleAuthOutcome =
  | { kind: 'login'; access_token: string; user: Omit<UserEntity, 'password'> }
  | { kind: 'blocked'; message: string }
  | { kind: 'needs-profile'; pendingToken: string; email: string; fullName: string };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private activityLogService: ActivityLogService,
  ) {}

  async registerUser(dto: {
    fullName: string;
    email: string;
    password: string;
    affiliation: string;
    departmentRole?: string;
    purposeOfRequest: string;
  }): Promise<Omit<UserEntity, 'password'>> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');
    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await this.usersService.create({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      affiliation: dto.affiliation,
      departmentRole: dto.departmentRole,
      purposeOfRequest: dto.purposeOfRequest,
      role: UserRole.RESEARCHER,
      status: AccountStatus.PENDING,
    });
    await this.activityLogService.log(
      created.fullName,
      'Submitted Application',
      `Applied as ${created.affiliation}`,
    );
    const { password, ...rest } = created;
    return rest;
  }

  async validateUser(email: string, pass: string): Promise<UserEntity | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    if (!user.password) {
      // Google-only account — bcrypt.compare() would throw on a null hash.
      throw new UnauthorizedException('This account signs in with Google — use the Google Sign-In button instead.');
    }
    const matches = await bcrypt.compare(pass, user.password);
    return matches ? user : null;
  }

  private async issueToken(user: UserEntity): Promise<string> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  async loginUser(user: UserEntity): Promise<{ access_token: string; user: Omit<UserEntity, 'password'> }> {
    const blockedMessage = LOGIN_BLOCKED_MESSAGES[user.status];
    if (blockedMessage) throw new ForbiddenException(blockedMessage);

    const access_token = await this.issueToken(user);
    const { password, ...rest } = user;
    return { access_token, user: rest };
  }

  // Called from the /auth/google/callback route with whatever GoogleStrategy
  // extracted from the Google profile. Three cases: this Google identity is
  // already linked to a row (log in); no googleId match but the email
  // matches an existing password-based account (link Google to it, then log
  // in — so someone who originally signed up with email/password can switch
  // to "Sign in with Google" later without creating a second account); or
  // neither matches, meaning this is a first-time signup that still needs
  // the fields Google doesn't provide (affiliation, purpose) — see
  // completeGoogleSignup.
  async findOrPrepareGoogleUser(profile: GoogleProfile): Promise<GoogleAuthOutcome> {
    let user = await this.usersService.findByGoogleId(profile.googleId);
    if (!user) {
      const existingByEmail = await this.usersService.findByEmail(profile.email);
      if (existingByEmail) {
        user = await this.usersService.update(existingByEmail.id, { googleId: profile.googleId });
      }
    }

    if (user) {
      const blockedMessage = LOGIN_BLOCKED_MESSAGES[user.status];
      if (blockedMessage) return { kind: 'blocked', message: blockedMessage };
      const access_token = await this.issueToken(user);
      const { password, ...rest } = user;
      return { kind: 'login', access_token, user: rest };
    }

    const pendingToken = await this.jwtService.signAsync(
      {
        purpose: GOOGLE_SIGNUP_TOKEN_PURPOSE,
        googleId: profile.googleId,
        email: profile.email,
        fullName: profile.fullName,
      },
      { expiresIn: GOOGLE_SIGNUP_TOKEN_TTL },
    );
    return { kind: 'needs-profile', pendingToken, email: profile.email, fullName: profile.fullName };
  }

  // Finishes the signup a brand-new Google identity started — same PENDING,
  // admin-reviewed outcome as the ordinary email/password registerUser()
  // above, just sourced from the short-lived pendingToken instead of a
  // password. Google sign-in never bypasses admin approval.
  async completeGoogleSignup(
    pendingToken: string,
    extra: { affiliation: string; departmentRole?: string; purposeOfRequest: string },
  ): Promise<Omit<UserEntity, 'password'>> {
    let payload: { purpose?: string; googleId?: string; email?: string; fullName?: string };
    try {
      payload = await this.jwtService.verifyAsync(pendingToken);
    } catch {
      throw new UnauthorizedException('Your Google sign-in session expired — please try again.');
    }
    if (payload.purpose !== GOOGLE_SIGNUP_TOKEN_PURPOSE || !payload.googleId || !payload.email) {
      throw new UnauthorizedException('Invalid Google sign-in session.');
    }

    const [existingByGoogleId, existingByEmail] = await Promise.all([
      this.usersService.findByGoogleId(payload.googleId),
      this.usersService.findByEmail(payload.email),
    ]);
    if (existingByGoogleId || existingByEmail) {
      throw new ConflictException('An account for this Google identity already exists — try logging in instead.');
    }

    const created = await this.usersService.create({
      fullName: payload.fullName ?? payload.email,
      email: payload.email,
      password: null,
      googleId: payload.googleId,
      affiliation: extra.affiliation,
      departmentRole: extra.departmentRole,
      purposeOfRequest: extra.purposeOfRequest,
      role: UserRole.RESEARCHER,
      status: AccountStatus.PENDING,
    });
    await this.activityLogService.log(
      created.fullName,
      'Submitted Application',
      `Applied as ${created.affiliation} (via Google)`,
    );
    const { password, ...rest } = created;
    return rest;
  }
}
