import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Post,
    Request,
    UnauthorizedException,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ApiBearerAuth, ApiResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoginDto, LoginResponseDto, RegisterDto, ProfileDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

interface AuthenticatedRequest {
    user: { sub: number; email: string; role: string };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private usersService: UsersService,
    ) {}

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
}
