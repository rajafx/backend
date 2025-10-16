// src/payouts/payout-executor.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PayoutQueue } from '../rewards/entities/payout-queue.entity';
import { ethers } from 'ethers';

// Minimal ABI untuk fungsi yang kita butuhkan: transfer dan decimals
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

@Injectable()
export class PayoutExecutorService implements OnModuleInit {
  private readonly logger = new Logger(PayoutExecutorService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private usdtContract: ethers.Contract;

  constructor(
    private configService: ConfigService,
    @InjectRepository(PayoutQueue)
    private readonly payoutQueueRepository: Repository<PayoutQueue>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Payout Executor Service...');
    const privateKey = this.configService.get<string>('PRIVATE_KEY_BACKEND');
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const usdtContractAddress = this.configService.get<string>('USDT_CONTRACT_ADDRESS');

    if (!privateKey || !rpcUrl || !usdtContractAddress) {
      this.logger.error('PayoutExecutorService is disabled. Missing PRIVATE_KEY_BACKEND, RPC_URL, or USDT_CONTRACT_ADDRESS in .env');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    this.usdtContract = new ethers.Contract(usdtContractAddress, ERC20_ABI, this.wallet);

    this.logger.log(`Payout Executor is ready. Using wallet: ${await this.wallet.getAddress()}`);
    this.logger.log(`USDT Contract Address: ${usdtContractAddress}`);
    
    setInterval(() => {
      this.processPendingPayouts();
    }, 5 * 60 * 1000);
  }

  async processPendingPayouts() {
    this.logger.log('Checking for pending payouts...');
    const pendingPayouts = await this.payoutQueueRepository.find({
      where: { status: 'pending' },
      // --- PERBAIKAN: Gunakan camelCase sesuai properti di entity ---
      order: { createdAt: 'ASC' },
      take: 10,
    });

    if (pendingPayouts.length === 0) {
      this.logger.log('No pending payouts to process.');
      return;
    }

    this.logger.log(`Found ${pendingPayouts.length} pending payouts to process.`);

    for (const payout of pendingPayouts) {
      try {
        await this.sendPayout(payout);
      } catch (error: any) {
        this.logger.error(`Failed to send payout to ${payout.toWalletAddress}. Error: ${error.message}`);
        await this.payoutQueueRepository.update(
          { id: payout.id },
          // --- PERBAIKAN: Gunakan camelCase sesuai properti di entity ---
          { status: 'failed', error: error.message },
        );
      }
    }
  }

  private async sendPayout(payout: PayoutQueue): Promise<string> {
    const decimals = await this.usdtContract.decimals();
    const amountInWei = ethers.parseUnits(payout.amount.toString(), decimals);
    const gasLimit = 100000;

    this.logger.log(`Sending ${payout.amount} USDT (${amountInWei.toString()} wei) to ${payout.toWalletAddress}`);

    const tx = await this.usdtContract.transfer(
      payout.toWalletAddress,
      amountInWei,
      {
        gasLimit: gasLimit,
      }
    );

    this.logger.log(`Payout transaction initiated. Tx Hash: ${tx.hash}`);

    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error(`Transaction ${tx.hash} was not confirmed.`);
    }

    this.logger.log(`Payout successful! Tx Hash: ${receipt.hash}`);

    await this.payoutQueueRepository.update(
      { id: payout.id },
      { 
        status: 'sent', 
        // --- PERBAIKAN: Gunakan camelCase sesuai properti di entity ---
        transactionHash: receipt.hash,
        // --- PERBAIKAN: Gunakan camelCase sesuai properti di entity ---
        sentAt: new Date(),
      },
    );

    return receipt.hash;
  }
}