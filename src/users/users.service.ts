
import { Injectable } from '@nestjs/common';

// This should be a real class/interface representing a user entity
export type User = {
    id: number;
    username: string;
    password: string;
};

@Injectable()
export class UsersService {
  private readonly users = [
    {
      id: 1,
      username: 'admin',
      password: 'changeme',
    },
    {
      id: 2,
      username: 'researcher',
      password: 'guess',
    },
  ] as User[];

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }
}
