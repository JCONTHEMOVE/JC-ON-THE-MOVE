// FaucetPay API service - provides integration with FaucetPay.io

interface FaucetPayBalance {
  status: number;
  message: string;
  currency: string;
  balance: string; // in satoshis
  balance_bitcoin?: string; // in regular format
}

interface FaucetPaySendResponse {
  status: number;
  message: string;
  rate_limit_remaining?: number;
  currency: string;
  balance: string;
  balance_bitcoin?: string;
  payout_id: number;
  payout_user_hash: string;
}

interface FaucetPayCurrencies {
  status: number;
  message: string;
  currencies: string[];
  currencies_names: Array<{
    name: string;
    acronym: string;
  }>;
}

interface FaucetPayCheckAddress {
  status: number;
  message: string;
  payout_user_hash?: string;
}

interface FaucetPayError {
  status: number;
  message: string;
}

export class FaucetPayService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://faucetpay.io/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, data: Record<string, any>): Promise<any> {
    // Use URLSearchParams instead of FormData for Node.js compatibility
    const formData = new URLSearchParams();
    formData.append('api_key', this.apiKey);
    
    // Add all other parameters
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        formData.append(key, value.toString());
      }
    }

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new Error(`FaucetPay API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    // Check for API-level errors
    if (result.status !== 200) {
      throw new Error(`FaucetPay error (${result.status}): ${result.message}`);
    }

    return result;
  }

  /**
   * Get faucet balance for a specific currency
   */
  async getBalance(currency: string = 'BTC'): Promise<FaucetPayBalance> {
    return await this.makeRequest('balance', { currency });
  }

  /**
   * Get list of supported currencies
   */
  async getCurrencies(): Promise<FaucetPayCurrencies> {
    return await this.makeRequest('currencies', {});
  }

  /**
   * Check if an address belongs to a FaucetPay user
   */
  async checkAddress(address: string, currency: string = 'BTC'): Promise<FaucetPayCheckAddress> {
    return await this.makeRequest('checkaddress', { address, currency });
  }

  /**
   * Send payment to a user
   */
  async sendPayment(params: {
    amount: number; // in satoshis
    to: string; // address or email
    currency?: string;
    referral?: boolean;
    ipAddress?: string;
  }): Promise<FaucetPaySendResponse> {
    const { amount, to, currency = 'BTC', referral = false, ipAddress } = params;
    
    const data: Record<string, any> = {
      amount,
      to,
      currency,
      referral,
    };

    if (ipAddress) {
      data.ip_address = ipAddress;
    }

    return await this.makeRequest('send', data);
  }

  /**
   * Get recent payout history
   */
  async getPayouts(currency: string = 'BTC', count: number = 50): Promise<any> {
    return await this.makeRequest('payouts', { currency, count });
  }

  /**
   * Get list of available faucets
   */
  async getFaucetList(): Promise<any> {
    return await this.makeRequest('listv1/faucetlist', {});
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Validate API key by testing with a balance request
   */
  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.getBalance();
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Helper method to convert satoshis to regular Bitcoin amount
   */
  static satoshisToBitcoin(satoshis: number): number {
    return satoshis / 100000000; // 1 BTC = 100,000,000 satoshis
  }

  /**
   * Helper method to convert regular Bitcoin amount to satoshis
   */
  static bitcoinToSatoshis(bitcoin: number): number {
    return Math.floor(bitcoin * 100000000);
  }

  /**
   * Helper method to get minimum claim amount for a currency
   */
  static getMinimumClaimAmount(currency: string): number {
    // Default minimum amounts in smallest units (satoshis, gwei, etc.)
    const minimums: Record<string, number> = {
      'BTC': 1, // 1 satoshi
      'ETH': 1, // 1 gwei
      'LTC': 1, // 1 litoshi  
      'DOGE': 1, // 1 koinu
      'BCH': 1, // 1 satoshi
      'DASH': 1, // 1 duff
      'DGB': 1, // 1 satoshi
      'TRX': 1, // 1 sun
    };
    
    return minimums[currency] || 1;
  }

  /**
   * Helper method to format amount for display
   */
  static formatAmount(amount: number, currency: string): string {
    const decimals = currency === 'BTC' ? 8 : 6;
    const divisor = currency === 'BTC' ? 100000000 : 1000000;
    return (amount / divisor).toFixed(decimals);
  }
}

// Create singleton instance (will be initialized when API key is available)
let faucetPayService: FaucetPayService | null = null;

export function getFaucetPayService(): FaucetPayService | null {
  if (!faucetPayService && process.env.FAUCETPAY_API_KEY) {
    faucetPayService = new FaucetPayService(process.env.FAUCETPAY_API_KEY);
  }
  return faucetPayService;
}

export function initializeFaucetPayService(apiKey: string): FaucetPayService {
  faucetPayService = new FaucetPayService(apiKey);
  return faucetPayService;
}