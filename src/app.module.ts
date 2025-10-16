// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';

// Import Semua Entity
import { Member } from './members/entities/member.entity';
import { SponsorStructure } from './members/entities/sponsor-structure.entity';
import { RewardState } from './rewards/entities/reward-state.entity';
import { PayoutQueue } from './rewards/entities/payout-queue.entity';

// Import Semua Controller
import { MemberController } from './members/member.controller';

// Import Semua Service
import { MemberService } from './members/member.service';
import { RewardService } from './rewards/reward.service';
import { BlockchainListenerService } from './listeners/blockchain.listener';
import { PayoutExecutorService } from './payouts/payout-executor.service';

@Module({
  imports: [
    // Modul untuk membaca file .env
    ConfigModule.forRoot({ isGlobal: true }),
    
    // Modul untuk koneksi ke database PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    
    // Daftarkan semua entity agar bisa digunakan oleh TypeORM
    TypeOrmModule.forFeature([
      Member,
      SponsorStructure,
      RewardState,
      PayoutQueue,
    ]),
  ],
  controllers: [
    // Daftarkan semua controller API
    MemberController,
  ],
  providers: [
    // Daftarkan semua service (logika bisnis)
    MemberService,
    RewardService,
    BlockchainListenerService,
    PayoutExecutorService,
  ],
})
export class AppModule {}