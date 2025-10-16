// src/members/dto/get-member-status.dto.ts
import { IsString, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class GetMemberStatusDto {
  @IsString()
  status: 'active' | 'expired' | 'not_registered';

  @IsString()
  walletAddress: string;

  @IsOptional()
  @IsNumber()
  nftTokenId?: number;

  @IsOptional()
  @IsDateString()
  expiryAt?: string;

  @IsOptional()
  @IsNumber()
  currentRank?: number;

  @IsOptional()
  @IsString()
  referralLink?: string;
}