// src/rewards/reward.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; // <-- TAMBAHKAN IMPORT INI
import { Member } from '../members/entities/member.entity';
import { RewardState } from './entities/reward-state.entity';
import { PayoutQueue } from './entities/payout-queue.entity';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);
  private readonly REWARD_CRITERIA = [
    { tier: 1, left: 1, center: 1, right: 1, value: 10 },
    { tier: 2, left: 5, center: 5, right: 5, value: 25 },
    { tier: 3, left: 15, center: 15, right: 15, value: 65 },
    { tier: 4, left: 50, center: 50, right: 50, value: 200 },
    { tier: 5, left: 150, center: 150, right: 150, value: 500 },
    { tier: 6, left: 450, center: 450, right: 450, value: 1500 },
    { tier: 7, left: 2450, center: 2450, right: 2450, value: 5000 },
    { tier: 8, left: 10450, center: 10450, right: 10450, value: 20000 },
    { tier: 9, left: 30450, center: 30450, right: 30450, value: 50000 },
    { tier: 10, left:80450, center: 80450, right: 80450, value: 125000 },
  ];

  constructor(
    @InjectRepository(Member) private readonly memberRepository: Repository<Member>,
    @InjectRepository(RewardState) private readonly rewardStateRepository: Repository<RewardState>,
    @InjectRepository(PayoutQueue) private readonly payoutQueueRepository: Repository<PayoutQueue>,
  ) {}

  async calculateAndAward(newMemberWallet: string) {
    this.logger.log(`Calculating rewards for new member: ${newMemberWallet}`);
    let currentUpline = await this.memberRepository.findOne({ where: { walletAddress: newMemberWallet.toLowerCase() } });

    for (let i = 0; i < 10 && currentUpline && currentUpline.referrerWallet; i++) {
      const upline = await this.memberRepository.findOne({ where: { walletAddress: currentUpline.referrerWallet.toLowerCase() } });
      if (!upline) break;

      const counts = { left: upline.totalLeft, center: upline.totalCenter, right: upline.totalRight };
      this.logger.log(`Checking upline ${upline.walletAddress} with counts: L=${counts.left}, C=${counts.center}, R=${counts.right}`);

      for (let j = this.REWARD_CRITERIA.length - 1; j >= 0; j--) {
        const criteria = this.REWARD_CRITERIA[j];
        if (counts.left >= criteria.left && counts.center >= criteria.center && counts.right >= criteria.right) {
          const existingReward = await this.rewardStateRepository.findOne({
            where: { walletAddress: upline.walletAddress, tier: criteria.tier }
          });
          if (!existingReward) {
            this.logger.log(`🏆 Upline ${upline.walletAddress} qualified for Tier A${criteria.tier}!`);
            await this.activateReward(upline.walletAddress, criteria.tier, criteria.value);
          }
          break;
        }
      }
      currentUpline = upline;
    }
  }

  private async activateReward(walletAddress: string, newTier: number, achievementValue: number) {
    await this.rewardStateRepository.update({ walletAddress }, { isActive: false });
    const newRewardState = this.rewardStateRepository.create({
      walletAddress,
      tier: newTier,
      isActive: true,
      firstQualifiedAt: new Date(),
      lastAchievementAt: new Date(),
      lastPayoutAt: new Date(),
      payoutCount: 1,
    });
    await this.rewardStateRepository.save(newRewardState);
    await this.payoutQueueRepository.save({
      toWalletAddress: walletAddress,
      amount: achievementValue,
      type: 'achievement',
      status: 'pending',
    });
  }

  async resetMemberRewards(walletAddress: string) {
    this.logger.log(`Resetting all rewards for renewed member: ${walletAddress}`);
    await this.rewardStateRepository.update({ walletAddress }, { isActive: false });
  }

  async findDueMonthlyPayouts() {
    this.logger.log('Checking for due monthly payouts...');
    const dueRewards = await this.rewardStateRepository.find({ where: { isActive: true } });
    for (const reward of dueRewards) {
      const criteria = this.REWARD_CRITERIA.find(c => c.tier === reward.tier);
      if (!criteria) continue;
      const nextPayoutDate = new Date(reward.lastPayoutAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (nextPayoutDate <= new Date()) {
        this.logger.log(`Monthly payout due for ${reward.walletAddress} (Tier A${reward.tier}).`);
        await this.payoutQueueRepository.save({
          toWalletAddress: reward.walletAddress,
          amount: criteria.value,
          type: 'monthly',
          status: 'pending',
        });
        reward.lastPayoutAt = new Date();
        reward.payoutCount += 1;
        await this.rewardStateRepository.save(reward);
      }
    }
  }
}