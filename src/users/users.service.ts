import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async create(user: Partial<UserEntity>): Promise<UserEntity> {
    const created = this.usersRepo.create(user);
    return this.usersRepo.save(created);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async update(id: number, patch: Partial<UserEntity>): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, patch);
    return this.usersRepo.save(user);
  }

  async findResearchers(): Promise<UserEntity[]> {
    return this.usersRepo.find({
      where: { role: UserRole.RESEARCHER },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: number): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepo.remove(user);
    return user;
  }
}
