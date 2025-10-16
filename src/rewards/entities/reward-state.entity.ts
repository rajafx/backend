// src/rewards/entities/reward-state.entity.ts
import { Entity, PrimaryColumn, Column, OneToOne } from 'typeorm';
import { Member } from '../../members/entities/member.entity';

@Entity('reward_states')
export class RewardState {
  @PrimaryColumn()
  walletAddress: string;

  @Column()
  tier: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  firstQualifiedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastAchievementAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastPayoutAt: Date;

  @Column({ default: 0 })
  payoutCount: number;

  @OneToOne(() => Member, (member) => member.rewardState)
  member: Member;
}