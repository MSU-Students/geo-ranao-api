
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService, User } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async registerUser(dto: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role?: 'VIEWER' | 'RESEARCHER' | 'ADMIN';
  }): Promise<Omit<User, 'password'>> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');
    const hashed = await bcrypt.hash(dto.password, 10);
    const role = dto.role ?? 'VIEWER';
    const isVerified = role === 'RESEARCHER' ? false : true;
    const created = await this.usersService.create({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      phoneNumber: dto.phoneNumber,
      role,
      isVerified,
    });
    const { password, ...rest } = created;
    return rest;
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const matches = await bcrypt.compare(pass, user.password);
    return matches ? user : null;
  }

  async loginUser(user: User): Promise<{ access_token: string }> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);
    return { access_token };
  }
}
