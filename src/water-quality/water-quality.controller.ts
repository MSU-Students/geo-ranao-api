import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WaterQualityService } from './water-quality.service';
import { CreateWaterQualityReadingDto, CreateWaterQualityReadingsBulkDto } from './dto/create-water-quality-reading.dto';
import { ReviewStatus } from './entities/water-quality-reading.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewActionDto } from '../common/dto/review-action.dto';
import { UsersService } from '../users/users.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ActivitySeverity } from '../activity-log/entities/activity-log.entity';

interface AuthenticatedRequest {
  user: { sub: number; email: string; role: string };
}

// findAll runs behind OptionalJwtAuthGuard, so unlike every other handler
// here, req.user may genuinely be absent (a public, logged-out visitor).
interface OptionallyAuthenticatedRequest {
  user?: { sub: number; email: string; role: string };
}

@ApiTags('water-quality')
@ApiBearerAuth()
@Controller('water-quality/readings')
export class WaterQualityController {
  constructor(
    private readonly waterQualityService: WaterQualityService,
    private readonly usersService: UsersService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a single water quality reading, pending admin review' })
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateWaterQualityReadingDto) {
    const created = await this.waterQualityService.create(req.user.sub, dto);
    const actor = await this.usersService.findById(req.user.sub);
    await this.activityLogService.log(
      actor?.fullName ?? req.user.email,
      'Uploaded Water Quality Data',
      `Station ${created.siteId} — ${created.dateObserved}`,
    );
    return created;
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Submit many water quality readings from a parsed spreadsheet upload' })
  @UseGuards(JwtAuthGuard)
  async createBulk(@Request() req: AuthenticatedRequest, @Body() dto: CreateWaterQualityReadingsBulkDto) {
    const created = await this.waterQualityService.createBulk(req.user.sub, dto.rows);
    const uniqueSites = new Set(created.map((r) => r.siteId));
    const actor = await this.usersService.findById(req.user.sub);
    await this.activityLogService.log(
      actor?.fullName ?? req.user.email,
      'Uploaded Water Quality Data',
      `Bulk upload — ${created.length} reading${created.length === 1 ? '' : 's'} (${uniqueSites.size} site${uniqueSites.size === 1 ? '' : 's'})`,
    );
    return created;
  }

  // Optionally authenticated: a public, logged-out visitor gets approved
  // data only (same as a researcher), a researcher can additionally ask for
  // "mine" (including their own pending submissions), and an admin sees
  // everything regardless.
  @Get()
  @ApiOperation({ summary: 'List water quality readings — public/researchers see approved data (plus their own if logged in); admins see everything' })
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Request() req: OptionallyAuthenticatedRequest,
    @Query('status') status?: ReviewStatus,
    @Query('siteId') siteId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('mine') mine?: string,
  ) {
    if (mine === 'true' && req.user) {
      return this.waterQualityService.findAll({ researcherId: req.user.sub, status, siteId, dateFrom, dateTo });
    }
    if (req.user?.role === 'ADMIN') {
      return this.waterQualityService.findAll({ status, siteId, dateFrom, dateTo });
    }
    return this.waterQualityService.findAll({ status: ReviewStatus.APPROVED, siteId, dateFrom, dateTo });
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a single pending reading (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approve(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.waterQualityService.setReviewStatus(id, ReviewStatus.APPROVED, actor);
    await this.activityLogService.log(
      actor,
      'Water Quality Reading Approved',
      `Station ${updated.siteId} — ${updated.dateObserved}`,
      ActivitySeverity.POSITIVE,
    );
    return updated;
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a single pending reading (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.waterQualityService.setReviewStatus(id, ReviewStatus.REJECTED, actor, dto.reason);
    await this.activityLogService.log(
      actor,
      'Water Quality Reading Rejected',
      `Station ${updated.siteId} — ${updated.dateObserved}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return updated;
  }

  @Patch('batch/:batchId/approve')
  @ApiOperation({ summary: 'Approve every reading in a bulk-upload batch at once (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approveBatch(@Param('batchId') batchId: string, @Request() req: AuthenticatedRequest) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.waterQualityService.setBatchReviewStatus(batchId, ReviewStatus.APPROVED, actor);
    await this.activityLogService.log(
      actor,
      'Water Quality Batch Approved',
      `${updated.length} reading${updated.length === 1 ? '' : 's'}`,
      ActivitySeverity.POSITIVE,
    );
    return updated;
  }

  @Patch('batch/:batchId/reject')
  @ApiOperation({ summary: 'Reject every reading in a bulk-upload batch at once (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async rejectBatch(
    @Param('batchId') batchId: string,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.waterQualityService.setBatchReviewStatus(
      batchId,
      ReviewStatus.REJECTED,
      actor,
      dto.reason,
    );
    await this.activityLogService.log(
      actor,
      'Water Quality Batch Rejected',
      `${updated.length} reading${updated.length === 1 ? '' : 's'}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return updated;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a single (non-batch) water quality reading — e.g. to retract a bad upload (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const removed = await this.waterQualityService.remove(id);
    await this.activityLogService.log(
      actor,
      'Water Quality Reading Deleted',
      `Station ${removed.siteId} — ${removed.dateObserved}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return { message: 'Water quality reading deleted' };
  }

  @Delete('batch/:batchId')
  @ApiOperation({ summary: 'Permanently delete every reading in a bulk-upload batch at once — e.g. to retract a bad upload (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async removeBatch(
    @Param('batchId') batchId: string,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const removed = await this.waterQualityService.removeBatch(batchId);
    await this.activityLogService.log(
      actor,
      'Water Quality Batch Deleted',
      `${removed.length} reading${removed.length === 1 ? '' : 's'}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return { message: 'Water quality batch deleted' };
  }
}
