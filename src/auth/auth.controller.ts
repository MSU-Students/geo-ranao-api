import { Body, Controller, Get, Post, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { LoginDto, LoginResponseDto, RegisterDto, ProfileDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered' })
    async register(@Body() dto: RegisterDto) {
        return this.authService.registerUser(dto as any);
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @ApiOperation({ summary: 'Login with email/password' })
    @ApiResponse({ status: 200, type: LoginResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async login(@Body() dto: LoginDto) {
        const user = await this.authService.validateUser(dto.email, dto.password);
        if (!user) return { message: 'Invalid credentials' };
        return this.authService.loginUser(user as any);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('profile')
    @ApiResponse({ status: 200, type: ProfileDto })
    getProfile(@Request() req: any) {
        const u = req.user;
        return { id: u.sub, email: u.email, role: u.role };
    }
}
