
import { Injectable, NotFoundException } from '@nestjs/common';

export type Role = 'VIEWER' | 'RESEARCHER' | 'ADMIN';

export interface User {
  id: number;
  fullName: string;
  email: string;
  password: string; // hashed
  phoneNumber?: string;
  role: Role;
  isVerified: boolean;
}

@Injectable()
export class UsersService {
  // Start with empty users array. Register an admin account via POST /auth/register
  private users: User[] = [];

  private nextId = 1;

  async create(user: Omit<User, 'id'>): Promise<User> {
    const newUser: User = { id: this.nextId++, ...user };
    this.users.push(newUser);
    return newUser;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((u) => u.email === email);
  }

  async findById(id: number): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }

  async update(id: number, patch: Partial<User>): Promise<User> {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new NotFoundException('User not found');
    this.users[idx] = { ...this.users[idx], ...patch };
    return this.users[idx];
  }

  // helper used by other code for listing (not exported)
  async all(): Promise<User[]> {
    return this.users.slice();
  }
}
