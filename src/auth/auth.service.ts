import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { UserEntity, UserRole, AccountStatus } from '../users/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ActivityLogService } from '../activity-log/activity-log.service';

const LOGIN_BLOCKED_MESSAGES: Partial<Record<AccountStatus, string>> = {
  [AccountStatus.PENDING]: 'Your account is still pending admin approval.',
  [AccountStatus.REJECTED]: 'Your researcher application was rejected.',
  [AccountStatus.SUSPENDED]: 'Your account access has been suspended.',
};

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
    const matches = await bcrypt.compare(pass, user.password);
    return matches ? user : null;
  }

  async loginUser(user: UserEntity): Promise<{ access_token: string; user: Omit<UserEntity, 'password'> }> {
    const blockedMessage = LOGIN_BLOCKED_MESSAGES[user.status];
    if (blockedMessage) throw new ForbiddenException(blockedMessage);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);
    const { password, ...rest } = user;
    return { access_token, user: rest };
  }
}
