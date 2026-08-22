import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserEntity, AccountStatus } from './entities/user.entity';
import { ReviewActionDto } from '../common/dto/review-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivitySeverity } from '../activity-log/entities/activity-log.entity';

interface AuthenticatedRequest {
  user: { sub: number; email: string; role: string };
}

function toSafeUser(user: UserEntity): Omit<UserEntity, 'password'> {
  const { password, ...rest } = user;
  return rest;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private activityLogService: ActivityLogService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List researcher accounts (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findResearchers() {
    const researchers = await this.usersService.findResearchers();
    return researchers.map(toSafeUser);
  }

  private async actorName(req: AuthenticatedRequest): Promise<string> {
    const admin = await this.usersService.findById(req.user.sub);
    return admin?.fullName ?? req.user.email;
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: "Approve a researcher's pending application (ADMIN only)" })
  @ApiResponse({ status: 200, description: 'Researcher approved' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approve(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    const actor = await this.actorName(req);
    const updated = await this.usersService.update(id, {
      status: AccountStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedBy: actor,
      reviewNote: null,
    });
    await this.activityLogService.log(
      actor,
      'Account Approved',
      `Approved ${target.fullName} (${target.email})`,
      ActivitySeverity.POSITIVE,
    );
    return toSafeUser(updated);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: "Reject a researcher's pending application (ADMIN only)" })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    const actor = await this.actorName(req);
    const updated = await this.usersService.update(id, {
      status: AccountStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: actor,
      reviewNote: dto.reason ?? null,
    });
    await this.activityLogService.log(
      actor,
      'Account Rejected',
      `Rejected ${target.fullName}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return toSafeUser(updated);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: "Suspend an approved researcher's access (ADMIN only)" })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    const actor = await this.actorName(req);
    const updated = await this.usersService.update(id, {
      status: AccountStatus.SUSPENDED,
      reviewedAt: new Date(),
      reviewedBy: actor,
      reviewNote: dto.reason ?? null,
    });
    await this.activityLogService.log(
      actor,
      'Account Revoked',
      `Revoked ${target.fullName}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.WARNING,
    );
    return toSafeUser(updated);
  }

  @Patch(':id/reinstate')
  @ApiOperation({ summary: 'Reinstate a suspended researcher back to approved (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reinstate(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    const actor = await this.actorName(req);
    const updated = await this.usersService.update(id, {
      status: AccountStatus.APPROVED,
      reviewedAt: new Date(),
      reviewedBy: actor,
      reviewNote: null,
    });
    await this.activityLogService.log(
      actor,
      'Account Reinstated',
      `Reinstated ${target.fullName} (${target.email})`,
      ActivitySeverity.POSITIVE,
    );
    return toSafeUser(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Permanently delete a researcher's account (ADMIN only)" })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const actor = await this.actorName(req);
    const removed = await this.usersService.remove(id);
    await this.activityLogService.log(
      actor,
      'Account Deleted',
      `Deleted account for ${removed.fullName} (${removed.email})${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return { message: 'Account deleted' };
  }
}
