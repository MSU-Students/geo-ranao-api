import { Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('cats')
export class CatsController {
    @Post()
  create(): string {
    return 'This action adds a new cat';
  }
    @Get()
    findAll(@Req() request: Request): string {
        return 'This action returns all cats';
    }
}
