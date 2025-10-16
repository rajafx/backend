// src/rewards/entities/payout-queue.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('payout_queue') // Nama tabel di database
export class PayoutQueue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'to_wallet_address' }) // <-- Kolom di DB: to_wallet_address
  toWalletAddress: string;               // <-- Properti di class: toWalletAddress (camelCase)

  @Column({ name: 'amount' })
  amount: number;

  @Column({ name: 'status' })
  status: 'pending' | 'sent' | 'failed';

  @Column({ name: 'transaction_hash', nullable: true }) // <-- Kolom di DB: transaction_hash
  transactionHash: string;                             // <-- Properti di class: transactionHash (camelCase)

  @Column({ name: 'error_message', nullable: true }) // <-- Kolom di DB: error_message
  error: string;                                     // <-- Properti di class: error (camelCase)

  @CreateDateColumn({ name: 'created_at' }) // <-- Kolom di DB: created_at
  createdAt: Date;                           // <-- Properti di class: createdAt (camelCase)

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true }) // <-- Kolom di DB: sent_at
  sentAt: Date;                                                    // <-- Properti di class: sentAt (camelCase)
}