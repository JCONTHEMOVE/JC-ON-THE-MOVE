// Crypto-to-cash conversion service using Request Technologies
import axios from 'axios';

interface CashoutRequest {
  userId: string;
  tokenAmount: number;
  cashAmount: number;
  bankDetails: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
    bankName: string;
  };
}

interface RequestTechResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionId?: string;
  failureReason?: string;
}

export class CryptoCashoutService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.REQUEST_TECH_API_KEY || '';
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.request.network' 
      : 'https://api-sandbox.request.network';

    if (!this.apiKey) {
      console.warn('REQUEST_TECH_API_KEY not configured - cashout will be simulated');
    }
  }

  async initiateCashout(request: CashoutRequest): Promise<RequestTechResponse> {
    try {
      if (!this.apiKey) {
        // Simulate cashout for development
        return this.simulateCashout(request);
      }

      const response = await axios.post(
        `${this.baseUrl}/crypto-to-fiat`,
        {
          clientUserId: request.userId,
          amount: request.cashAmount,
          currency: 'USD',
          cryptoAmount: request.tokenAmount,
          cryptoCurrency: 'USDC', // Convert through USDC
          bankAccount: request.bankDetails,
          isCryptoToFiatAllowed: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.id,
        status: response.data.status,
        transactionId: response.data.transactionId
      };
    } catch (error) {
      console.error('Cashout initiation failed:', error);
      
      return {
        id: 'failed_' + Date.now(),
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkCashoutStatus(transactionId: string): Promise<RequestTechResponse> {
    try {
      if (!this.apiKey) {
        // Simulate status check for development
        return {
          id: transactionId,
          status: 'completed',
          transactionId: transactionId
        };
      }

      const response = await axios.get(
        `${this.baseUrl}/crypto-to-fiat/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return {
        id: response.data.id,
        status: response.data.status,
        transactionId: response.data.transactionId,
        failureReason: response.data.failureReason
      };
    } catch (error) {
      console.error('Status check failed:', error);
      
      return {
        id: transactionId,
        status: 'failed',
        failureReason: 'Status check failed'
      };
    }
  }

  private async simulateCashout(request: CashoutRequest): Promise<RequestTechResponse> {
    // Simulate processing delay
    const simulatedId = 'sim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    console.log(`[SIMULATION] Processing cashout for user ${request.userId}: $${request.cashAmount}`);
    
    return {
      id: simulatedId,
      status: 'pending',
      transactionId: simulatedId
    };
  }

  // Validate bank account details format
  validateBankDetails(bankDetails: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!bankDetails.accountNumber || bankDetails.accountNumber.length < 4) {
      errors.push('Valid account number is required');
    }

    if (!bankDetails.routingNumber || bankDetails.routingNumber.length !== 9) {
      errors.push('Valid 9-digit routing number is required');
    }

    if (!bankDetails.accountHolderName || bankDetails.accountHolderName.trim().length < 2) {
      errors.push('Account holder name is required');
    }

    if (!bankDetails.bankName || bankDetails.bankName.trim().length < 2) {
      errors.push('Bank name is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const cryptoCashoutService = new CryptoCashoutService();