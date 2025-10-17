// src/members/member.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from './entities/member.entity';
import { SponsorStructure } from './entities/sponsor-structure.entity';
import { GetMemberStatusDto } from './dto/get-member-status.dto';
import { RegisterMemberDto } from './dto/register-member.dto';
import { RewardService } from '../rewards/reward.service';
import { PayoutQueue } from '../rewards/entities/payout-queue.entity';

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(SponsorStructure)
    private readonly sponsorStructureRepository: Repository<SponsorStructure>,
    private readonly rewardService: RewardService,
  ) {}

  async getMemberStatus(walletAddress: string): Promise<GetMemberStatusDto> {
    const member = await this.memberRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!member) {
      this.logger.debug(`Member with wallet ${walletAddress.toLowerCase()} not found.`);
      return { status: 'not_registered', walletAddress: walletAddress.toLowerCase() };
    }

    const now = new Date();
    const isActive = now < member.expiryAt;
    const status: 'active' | 'expired' = isActive ? 'active' : 'expired';

    return {
      status,
      walletAddress: member.walletAddress,
      nftTokenId: member.nftTokenId,
      expiryAt: member.expiryAt.toISOString(),
      currentRank: member.currentRank,
      referralLink: `https://billionup.ai?ref=${member.walletAddress}`,
    };
  }

  // --- POST: Proses Registrasi Member Baru ---
  async processNewMember(eventData: RegisterMemberDto): Promise<{ status: string; message: string }> {
    const { walletAddress, referrerWallet, position } = eventData;
    const userAddress = walletAddress.toLowerCase();
    const referrerAddressLower = referrerWallet ? referrerWallet.toLowerCase() : null;

    this.logger.log(`Processing new member: ${userAddress}`);

    const existingMember = await this.memberRepository.findOne({
      where: { walletAddress: userAddress },
    });

    if (existingMember) {
      this.logger.warn(`Member ${userAddress} already exists. Skipping.`);
      throw new BadRequestException('This wallet address is already registered.');
    }

    const BACKEND_SIGNER_ADDRESS = (process.env.BACKEND_SIGNER_ADDRESS || '0x11997E4536c87A1994b944800bD0775575fCe3ea').toLowerCase();
    let finalSponsor = BACKEND_SIGNER_ADDRESS;

    if (referrerAddressLower) {
      const referrer = await this.memberRepository.findOne({ where: { walletAddress: referrerAddressLower } });
      if (referrer) {
        this.logger.log(`Valid referrer found: ${referrerAddressLower}. Using as sponsor.`);
        finalSponsor = referrer.walletAddress;
      } else {
        this.logger.warn(`Referrer ${referrerAddressLower} not found. Falling back to default developer wallet.`);
      }
    } else {
      this.logger.log(`No referrer provided. Using default developer wallet as sponsor.`);
    }

    const { finalSponsor: foundSponsor, finalPosition } = await this.findPlacementAndSave(
      userAddress,
      finalSponsor,
      position,
    );

    finalSponsor = foundSponsor;

    await this.saveSponsorStructure(userAddress, finalSponsor, finalPosition);
    await this.updateAllUplineCounts(finalSponsor, finalPosition);
    
    try {
      await this.rewardService.calculateAndAward(finalSponsor);
      this.logger.log(`Rewards calculated and awarded for sponsor: ${finalSponsor}`);
    } catch (error) {
      this.logger.error(`Failed to calculate rewards for sponsor ${finalSponsor}: ${error.message}`);
    }

    this.logger.log(`Successfully processed new member: ${userAddress} under ${finalSponsor} at ${finalPosition}`);
    
    return {
      status: 'success',
      message: 'Registration successful! Welcome to BillionUp!',
    };
  }

  // --- POST: Proses Renewal ---
  async processRenewal(walletAddress: string): Promise<{ status: string; message: string }> {
    this.logger.log(`Processing renewal for member: ${walletAddress}`);
    const member = await this.memberRepository.findOne({ where: { walletAddress: walletAddress.toLowerCase() } });
    if (!member) {
      this.logger.error(`Member ${walletAddress} not found for renewal.`);
      throw new NotFoundException('Member not found for renewal.');
    }
    
    member.expiryAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    member.status = 'active';
    member.currentRank = 0;
    await this.memberRepository.save(member);
    
    await this.rewardService.resetMemberRewards(walletAddress);
    
    this.logger.log(`Member ${walletAddress} renewed successfully.`);
    
    return {
      status: 'success',
      message: 'Membership renewed successfully!',
    };
  }

  // --- Helper Functions ---
  private async findPlacementAndSave(
    newUserAddress: string,
    initialReferrerAddress: string,
    requestedPosition: 'left' | 'center' | 'right',
  ): Promise<{ finalSponsor: string; finalPosition: 'left' | 'center' | 'right' }> {
    
    const BACKEND_SIGNER_ADDRESS = (process.env.BACKEND_SIGNER_ADDRESS || '0x11997E4536c87A1994b944800bD0775575fCe3ea').toLowerCase();

    // --- LOGIKA GENESIS: Jika referrer adalah wallet dev, langsung tempatkan di bawahnya ---
    if (initialReferrerAddress.toLowerCase() === BACKEND_SIGNER_ADDRESS) {
      this.logger.log('🚀 Placing member under the developer (genesis) wallet.');
      await this.saveMemberAndPlaceUnder(newUserAddress, initialReferrerAddress, requestedPosition);
      return { finalSponsor: initialReferrerAddress, finalPosition: requestedPosition };
    }

    // --- LOGIKA NORMAL: Cari referrer di database dan lakukan spillover ---
    const initialReferrer = await this.memberRepository.findOne({ where: { walletAddress: initialReferrerAddress } });
    if (!initialReferrer) {
      // Seharusnya tidak terjadi karena sudah di-filter di processNewMember, tapi sebagai jaga-jaga
      this.logger.error(`Initial referrer ${initialReferrerAddress} not found in DB. This should not happen.`);
      throw new NotFoundException(`Initial referrer ${initialReferrerAddress} not found.`);
    }

    // Lakukan penempatan normal dengan logika spillover
    if (!initialReferrer[requestedPosition]) {
      await this.saveMemberAndPlaceUnder(newUserAddress, initialReferrer.walletAddress, requestedPosition);
      return { finalSponsor: initialReferrer.walletAddress, finalPosition: requestedPosition };
    }

    const searchQueue: Member[] = [initialReferrer];
    const visited = new Set<string>([initialReferrer.walletAddress]);
    while (searchQueue.length > 0) {
      const currentNode = searchQueue.shift()!;
      if (currentNode.spillCount === 0) {
        if (!currentNode[requestedPosition]) {
          await this.saveMemberAndPlaceUnder(newUserAddress, currentNode.walletAddress, requestedPosition);
          await this.memberRepository.increment({ walletAddress: currentNode.walletAddress }, 'spillCount', 1);
          this.logger.log(`Spillover: Placed ${newUserAddress} under ${currentNode.walletAddress} at ${requestedPosition}`);
          return { finalSponsor: currentNode.walletAddress, finalPosition: requestedPosition };
        }
        const nextNodeAddress = currentNode[requestedPosition];
        if (nextNodeAddress && !visited.has(nextNodeAddress)) {
          const nextNode = await this.memberRepository.findOne({ where: { walletAddress: nextNodeAddress } });
          if (nextNode) {
            visited.add(nextNode.walletAddress);
            searchQueue.push(nextNode);
          }
        }
      }
    }

    this.logger.error(`Could not find a placement for ${newUserAddress}. Placing under initial referrer as a fallback.`);
    await this.saveMemberAndPlaceUnder(newUserAddress, initialReferrer.walletAddress, requestedPosition);
    return { finalSponsor: initialReferrer.walletAddress, finalPosition: requestedPosition };
  }

  private async saveMemberAndPlaceUnder(newUserAddress: string, sponsorAddress: string, position: 'left' | 'center' | 'right') {
    const newMember = this.memberRepository.create({
      walletAddress: newUserAddress,
      referrerWallet: sponsorAddress,
      position: position,
      activatedAt: new Date(),
      expiryAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: 'active',
      currentRank: 0,
    });
    await this.memberRepository.save(newMember);
    await this.memberRepository.update({ walletAddress: sponsorAddress }, { [position]: newUserAddress });
  }

  private async saveSponsorStructure(newUserAddress: string, sponsorAddress: string, position: 'left' | 'center' | 'right') {
    let currentSponsor: string | null = sponsorAddress;
    let level = 1;
    do {
      await this.sponsorStructureRepository.save({
        walletAddress: newUserAddress,
        sponsorWallet: currentSponsor,
        level: level,
        position: position,
      });
      const sponsorMember = await this.memberRepository.findOne({ where: { walletAddress: currentSponsor } });
      currentSponsor = sponsorMember?.referrerWallet || null;
      level++;
    } while (currentSponsor);
  }

  private async updateAllUplineCounts(sponsorWallet: string, position: 'left' | 'center' | 'right') {
    let currentUpline = await this.memberRepository.findOne({ where: { walletAddress: sponsorWallet } });
    const positionColumn = `total${position.charAt(0).toUpperCase() + position.slice(1)}`;
    while (currentUpline) {
      await this.memberRepository.increment({ walletAddress: currentUpline.walletAddress }, positionColumn, 1);
      await this.memberRepository.increment({ walletAddress: currentUpline.walletAddress }, 'totalDirectReferrals', 1);

      if (!currentUpline.referrerWallet) break;
      currentUpline = await this.memberRepository.findOne({ where: { walletAddress: currentUpline.referrerWallet.toLowerCase() } });
    }
  }
}