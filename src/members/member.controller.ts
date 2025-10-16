// src/members/member.controller.ts
import { Controller, Post, Body, Get, Param, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { MemberService } from './member.service';
import { RegisterMemberDto } from './dto/register-member.dto';

@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  // --- Endpoint untuk registrasi member baru ---
  @Post('register')
  async register(@Body() registerDto: RegisterMemberDto): Promise<any> {
    try {
      const result = await this.memberService.processNewMember(registerDto);
      return {
        message: 'Registration successful! Please wait for confirmation.',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // --- Endpoint untuk cek status member ---
  @Get(':walletAddress/status')
  async getStatus(@Param('walletAddress') walletAddress: string): Promise<any> {
    try {
      const status = await this.memberService.getMemberStatus(walletAddress);
      return status;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}