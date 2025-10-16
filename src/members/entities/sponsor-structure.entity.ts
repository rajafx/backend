// src/members/entities/sponsor-structure.entity.ts
import { Entity, PrimaryColumn, Column, ManyToOne } from 'typeorm';
import { Member } from './member.entity';

@Entity('sponsor_structure')
export class SponsorStructure {
  @PrimaryColumn()
  wallet_address: string;

  @PrimaryColumn()
  sponsor_wallet: string;

  @PrimaryColumn()
  level: number;

  @Column({ type: 'varchar' })
  position: 'left' | 'center' | 'right';

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToOne(() => Member, (member) => member.sponsorStructures)
  member: Member;
}