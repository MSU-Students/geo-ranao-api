import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto, ProfileDto } from './dto';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}
    @Post('login')
    @ApiResponse({ status: 201, type: LoginResponseDto, description: 'The access token has been successfully generated.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' }) 
    login(@Body() signInDto: LoginDto) {
        return this.authService.signIn(signInDto.username, signInDto.password);
    }

    

    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @Get('profile')
    @ApiResponse({ status: 200, type: ProfileDto })
    getProfile(@Request() req: any) {
        return {
            id: req.user.sub,
            username: req.user.username
        };
    }

}
