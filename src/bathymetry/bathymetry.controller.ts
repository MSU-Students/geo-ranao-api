import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BathymetryService } from './bathymetry.service';
import { CreateBathymetrySurveyDto } from './dto/create-bathymetry-survey.dto';
import { ReviewStatus } from './entities/bathymetry-survey.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewActionDto } from '../common/dto/review-action.dto';
import { UsersService } from '../users/users.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivitySeverity } from '../activity-log/entities/activity-log.entity';

interface AuthenticatedRequest {
  user: { sub: number; email: string; role: string };
}

@ApiTags('bathymetry')
@ApiBearerAuth()
@Controller('bathymetry/surveys')
export class BathymetryController {
  constructor(
    private readonly bathymetryService: BathymetryService,
    private readonly usersService: UsersService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a cleaned bathymetry survey (depth soundings), pending admin review' })
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateBathymetrySurveyDto) {
    const created = await this.bathymetryService.create(req.user.sub, dto);
    const actor = await this.usersService.findById(req.user.sub);
    await this.activityLogService.log(
      actor?.fullName ?? req.user.email,
      'Uploaded Bathymetry Survey',
      `${created.label} — ${created.pointCount} sounding${created.pointCount === 1 ? '' : 's'}`,
    );
    return created;
  }

  @Get()
  @ApiOperation({ summary: 'List bathymetry surveys — researchers see approved plus their own; admins see everything' })
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req: AuthenticatedRequest, @Query('status') status?: ReviewStatus, @Query('mine') mine?: string) {
    if (mine === 'true') {
      return this.bathymetryService.findAll({ researcherId: req.user.sub, status });
    }
    if (req.user.role === 'ADMIN') {
      return this.bathymetryService.findAll({ status });
    }
    return this.bathymetryService.findAll({ status: ReviewStatus.APPROVED });
  }

  @Get('active')
  @ApiOperation({ summary: 'The most recently approved bathymetry survey, if any — what the public map should render' })
  @UseGuards(JwtAuthGuard)
  async findActive() {
    return this.bathymetryService.findLatestApproved();
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending bathymetry survey (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approve(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.bathymetryService.setReviewStatus(id, ReviewStatus.APPROVED, actor);
    await this.activityLogService.log(
      actor,
      'Bathymetry Survey Approved',
      `${updated.label} — ${updated.pointCount} soundings`,
      ActivitySeverity.POSITIVE,
    );
    return updated;
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending bathymetry survey (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reject(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewActionDto, @Request() req: AuthenticatedRequest) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.bathymetryService.setReviewStatus(id, ReviewStatus.REJECTED, actor, dto.reason);
    await this.activityLogService.log(
      actor,
      'Bathymetry Survey Rejected',
      `${updated.label}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return updated;
  }
}
