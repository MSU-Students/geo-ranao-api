import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Post,
    Request,
    Res,
    UnauthorizedException,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ApiBearerAuth, ApiResponse, ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { LoginDto, LoginResponseDto, RegisterDto, ProfileDto, CompleteGoogleSignupDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleConfiguredGuard } from './guards/google-configured.guard';
import type { GoogleProfile } from './google.strategy';

interface AuthenticatedRequest {
    user: { sub: number; email: string; role: string };
}

interface GoogleAuthenticatedRequest {
    user: GoogleProfile;
}

// Same local-dev fallback as main.ts's CORS origin resolution — kept here
// too rather than imported, since main.ts doesn't export it and pulling it
// out into a shared module for one constant isn't worth the indirection.
const LOCAL_DEV_FRONTEND_URL = 'http://localhost:9000';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private usersService: UsersService,
        private configService: ConfigService,
    ) {}

    // FRONTEND_URL can be a comma-separated list (see main.ts's CORS origin
    // resolution, e.g. a production URL plus a Vercel preview URL) — a
    // redirect target needs exactly one, so this takes the first.
    private frontendUrl(): string {
        const raw = this.configService.get<string>('FRONTEND_URL') ?? LOCAL_DEV_FRONTEND_URL;
        return raw.split(',')[0]!.trim();
    }

    @Post('register')
    @ApiOperation({ summary: 'Register a new researcher account (pending admin approval)' })
    @ApiResponse({ status: 201, description: 'User registered' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.registerUser({
            fullName: dto.fullName,
            email: dto.email,
            password: dto.password,
            affiliation: dto.affiliation,
            departmentRole: dto.departmentRole,
            purposeOfRequest: dto.purposeOfRequest,
        });
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @ApiOperation({ summary: 'Login with email/password' })
    @ApiResponse({ status: 200, type: LoginResponseDto })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    @ApiResponse({ status: 403, description: 'Account not approved (pending / rejected / suspended)' })
    async login(@Body() dto: LoginDto) {
        const user = await this.authService.validateUser(dto.email, dto.password);
        if (!user) throw new UnauthorizedException('Invalid email or password');
        return this.authService.loginUser(user);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @ApiOperation({ summary: "Get the logged-in user's current profile (reflects live status)" })
    @ApiResponse({ status: 200, type: ProfileDto })
    async getProfile(@Request() req: AuthenticatedRequest) {
        const user = await this.usersService.findById(req.user.sub);
        if (!user) throw new NotFoundException('User not found');
        const { password, ...rest } = user;
        return rest;
    }

    // Browser-navigated, not an API call a frontend script fetches — hidden
    // from Swagger (ApiExcludeEndpoint) since "click this button to redirect
    // to Google" isn't something to try from the Swagger UI.
    @Get('google')
    @ApiExcludeEndpoint()
    @UseGuards(GoogleConfiguredGuard, AuthGuard('google'))
    googleAuth() {
        // Never reached — AuthGuard('google') intercepts and redirects to
        // Google's consent screen before this body would run.
    }

    @Get('google/callback')
    @ApiExcludeEndpoint()
    @UseGuards(AuthGuard('google'))
    async googleAuthCallback(@Request() req: GoogleAuthenticatedRequest, @Res() res: Response) {
        const outcome = await this.authService.findOrPrepareGoogleUser(req.user);
        const base = this.frontendUrl();

        if (outcome.kind === 'login') {
            res.redirect(`${base}/auth/google/complete?token=${encodeURIComponent(outcome.access_token)}`);
            return;
        }
        if (outcome.kind === 'blocked') {
            res.redirect(`${base}/auth/google/complete?error=${encodeURIComponent(outcome.message)}`);
            return;
        }
        // 'needs-profile' — no account exists yet for this Google identity.
        // Hands off to the ordinary signup page rather than a separate one,
        // pre-filled with what Google already verified (email, name) and
        // asking only for the fields Google can't provide (affiliation,
        // purpose) — see SignupPage.vue's googleToken handling.
        const params = new URLSearchParams({
            googleToken: outcome.pendingToken,
            email: outcome.email,
            fullName: outcome.fullName,
        });
        res.redirect(`${base}/auth/signup?${params.toString()}`);
    }

    @HttpCode(HttpStatus.CREATED)
    @Post('google/complete-profile')
    @ApiOperation({ summary: 'Finish a Google sign-up by supplying the fields Google does not provide (pending admin approval)' })
    @ApiResponse({ status: 201, description: 'User registered' })
    async completeGoogleSignup(@Body() dto: CompleteGoogleSignupDto) {
        return this.authService.completeGoogleSignup(dto.pendingToken, {
            affiliation: dto.affiliation,
            departmentRole: dto.departmentRole,
            purposeOfRequest: dto.purposeOfRequest,
        });
    }
}
