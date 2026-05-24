import { Controller, Patch, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: "Validate a researcher's account (ADMIN only)" })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Researcher validated' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('validate-researcher/:id')
  async validateResearcher(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    if (!user) return { message: 'User not found' };
    if (user.role !== 'RESEARCHER') return { message: 'User is not a researcher' };
    await this.usersService.update(id, { isVerified: true });
    return { message: 'Researcher verified' };
  }
}
