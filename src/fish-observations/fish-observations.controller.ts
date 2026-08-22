import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { FishObservationsService } from './fish-observations.service';
import { CreateFishObservationDto } from './dto/create-fish-observation.dto';
import { FishCategory, ReviewStatus } from './entities/fish-observation.entity';
import { fishPhotoMulterOptions } from './multer.config';
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

function describe(observation: { speciesCommon?: string | null; speciesScientific?: string | null; category: string }): string {
  return observation.speciesCommon || observation.speciesScientific || `${observation.category} observation`;
}

@ApiTags('fish-observations')
@ApiBearerAuth()
@Controller('fish-observations')
export class FishObservationsController {
  constructor(
    private readonly fishObservationsService: FishObservationsService,
    private readonly usersService: UsersService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a fish observation (with optional photos), pending admin review' })
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('photos', 5, fishPhotoMulterOptions))
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateFishObservationDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const created = await this.fishObservationsService.create(req.user.sub, dto, files);
    const actor = await this.usersService.findById(req.user.sub);
    await this.activityLogService.log(
      actor?.fullName ?? req.user.email,
      'Uploaded Fish Observation',
      describe(created),
    );
    return created;
  }

  @Get()
  @ApiOperation({ summary: 'List fish observations — researchers see approved data plus their own; admins see everything' })
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: ReviewStatus,
    @Query('category') category?: FishCategory,
    @Query('mine') mine?: string,
  ) {
    if (mine === 'true') {
      return this.fishObservationsService.findAll({ researcherId: req.user.sub, status, category });
    }
    if (req.user.role === 'ADMIN') {
      return this.fishObservationsService.findAll({ status, category });
    }
    return this.fishObservationsService.findAll({ status: ReviewStatus.APPROVED, category });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Aggregate counts by category and conservation status' })
  @UseGuards(JwtAuthGuard)
  async summary(@Query('status') status?: ReviewStatus) {
    return this.fishObservationsService.summary(status ?? ReviewStatus.APPROVED);
  }

  // Deliberately unauthenticated, like a signed URL — <img> tags can't send a
  // Bearer header. The photo itself lives in a private Supabase Storage
  // bucket; this redirects to a freshly-minted, short-lived signed URL each
  // time, so the underlying bucket is never exposed directly.
  @Get(':id/photos/:photoId')
  @ApiOperation({ summary: 'Redirect to a signed URL for a fish observation photo (404 once past its retention window)' })
  async getPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId') photoId: string,
    @Res() res: Response,
  ) {
    const photo = await this.fishObservationsService.getPhoto(id, photoId);
    if (!photo) throw new NotFoundException('Photo not found or expired');
    const signedUrl = await this.fishObservationsService.getPhotoSignedUrl(photo);
    res.redirect(signedUrl);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending fish observation (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approve(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.fishObservationsService.setReviewStatus(id, ReviewStatus.APPROVED, actor);
    await this.activityLogService.log(
      actor,
      'Fish Observation Approved',
      describe(updated),
      ActivitySeverity.POSITIVE,
    );
    return updated;
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending fish observation (ADMIN only)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewActionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const admin = await this.usersService.findById(req.user.sub);
    const actor = admin?.fullName ?? req.user.email;
    const updated = await this.fishObservationsService.setReviewStatus(
      id,
      ReviewStatus.REJECTED,
      actor,
      dto.reason,
    );
    await this.activityLogService.log(
      actor,
      'Fish Observation Rejected',
      `${describe(updated)}${dto.reason ? ` — ${dto.reason}` : ''}`,
      ActivitySeverity.NEGATIVE,
    );
    return updated;
  }
}
