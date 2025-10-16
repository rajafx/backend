// src/members/dto/register-member.dto.ts

import { IsString, IsNotEmpty, IsEthereumAddress, IsIn, IsOptional } from 'class-validator';

export class RegisterMemberDto {
  @IsString()
  @IsNotEmpty()
  @IsEthereumAddress()
  walletAddress: string;

  @IsString()
  @IsOptional()
  @IsEthereumAddress()
  referrerWallet?: string;

  @IsString()
  @IsIn(['left', 'center', 'right'])
  @IsNotEmpty()
  position: 'left' | 'center' | 'right';
}