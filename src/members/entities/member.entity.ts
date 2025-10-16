// src/members/entities/member.entity.ts
import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { RewardState } from '../../rewards/entities/reward-state.entity';
import { SponsorStructure } from './sponsor-structure.entity';

@Entity('members')
export class Member {
  @PrimaryColumn({ unique: true, type: 'varchar' })
  walletAddress: string;

  @Column({ nullable: true, type: 'int' })
  nftTokenId: number;

  @Column({ nullable: true, type: 'varchar' })
  referrerWallet: string;

  @Column({ type: 'varchar', nullable: true })
  left: string;
  @Column({ type: 'varchar', nullable: true })
  center: string;
  @Column({ type: 'varchar', nullable: true })
  right: string;

  @Column({ type: 'int', default: 0 })
  totalLeft: number;
  @Column({ type: 'int', default: 0 })
  totalCenter: number;
  @Column({ type: 'int', default: 0 })
  totalRight: number;
  @Column({ type: 'int', default: 0 })
  totalDirectReferrals: number;

  @Column({ type: 'int', default: 0 })
  spillCount: number;

  @Column({ type: 'timestamp' })
  activatedAt: Date;

  @Column({ type: 'timestamp' })
  expiryAt: Date;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ type: 'int', default: 0 })
  currentRank: number;

  @Column({ type: 'varchar', nullable: true })
  position: 'left' | 'center' | 'right';

  @OneToOne(() => RewardState, (rewardState) => rewardState.member)
  rewardState: RewardState;

  @OneToMany(() => SponsorStructure, (sponsorStructure) => sponsorStructure.member)
  sponsorStructures: SponsorStructure[];
}