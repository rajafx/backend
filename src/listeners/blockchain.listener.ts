// src/listeners/blockchain.listener.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { MemberService } from '../members/member.service';

// ABI yang kamu berikan
const BILLIONUP_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "referrer", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "position", "type": "string" }
    ],
    "name": "MemberActivated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" }
    ],
    "name": "MembershipRenewed",
    "type": "event"
  },
  // ... ABI lainnya juga bisa ditambahkan di sini jika perlu
];

@Injectable()
export class BlockchainListenerService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainListenerService.name);
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor(
    private configService: ConfigService,
    private readonly memberService: MemberService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Blockchain Listener...');
    
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const contractAddress = this.configService.get<string>('CONTRACT_ADDRESS');

    if (!rpcUrl || !contractAddress) {
      this.logger.error('RPC_URL or CONTRACT_ADDRESS is not defined in .env file!');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, BILLIONUP_ABI, this.provider);

    this.setupEventListeners();
    
    this.logger.log('Blockchain Listener is running and listening for events on contract: ' + contractAddress);
  }

  private setupEventListeners() {
    // Listener untuk event MemberActivated
    this.contract.on('MemberActivated', async (user, referrer, position, event) => {
      this.logger.log(`🎉 EVENT CAUGHT: MemberActivated!`);
      this.logger.log(`   User: ${user}`);
      this.logger.log(`   Referrer: ${referrer}`);
      this.logger.log(`   Position: ${position}`);
      this.logger.log(`   Transaction Hash: ${event.transactionHash}`);
      
      // PERBAIKAN: Memetakan data dari event ke struktur RegisterMemberDto
      try {
        const registrationData = {
          walletAddress: user,          // Memetakan 'user' -> 'walletAddress'
          referrerWallet: referrer,    // Memetakan 'referrer' -> 'referrerWallet'
          position: position,          // Properti 'position' sudah sesuai
        };

        await this.memberService.processNewMember(registrationData);
        this.logger.log(`✅ Successfully processed new member: ${user}`);
      } catch (error) {
        this.logger.error(`❌ Failed to process new member: ${user}`, error);
      }
    });

    // Listener untuk event MembershipRenewed
    this.contract.on('MembershipRenewed', async (user, event) => {
      this.logger.log(`🔄 EVENT CAUGHT: MembershipRenewed!`);
      this.logger.log(`   User: ${user}`);
      this.logger.log(`   Transaction Hash: ${event.transactionHash}`);
      
      // TODO: Nanti kita akan panggil RewardService.resetMemberRewards() di sini
      this.logger.log(`TODO: Implement reward reset for user: ${user}`);
    });

    this.logger.log('Event listeners for MemberActivated and MembershipRenewed have been set up.');
  }
}