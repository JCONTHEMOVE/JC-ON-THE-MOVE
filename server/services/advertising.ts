// Real advertising service for crypto faucet monetization
// Integrates with Bitmedia, Cointraffic networks and provides database persistence

import { db } from '../db';
import { adImpressions, adClicks, adCompletions } from '@shared/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

export interface AdNetwork {
  name: string;
  scriptUrl?: string;
  apiKey?: string;
  publisherId?: string;
  enabled: boolean;
}

export interface AdPlacement {
  id: string;
  network: string;
  type: 'banner' | 'video' | 'popup' | 'interstitial';
  size?: string;
  publisherId?: string;
  unitId?: string;
}

export interface AdRevenue {
  date: string;
  network: string;
  placement: string;
  impressions: number;
  clicks: number;
  revenue: number;
  cpm: number;
  ctr: number;
}

export class AdvertisingService {
  private adNetworks: Map<string, AdNetwork> = new Map();

  constructor() {
    this.initializeNetworks();
  }

  private initializeNetworks() {
    // Bitmedia - Premium crypto advertising network
    this.adNetworks.set('bitmedia', {
      name: 'Bitmedia',
      scriptUrl: 'https://js.bitmedia.io/btm.js',
      publisherId: process.env.BITMEDIA_PUBLISHER_ID,
      enabled: !!process.env.BITMEDIA_PUBLISHER_ID
    });

    // Cointraffic - High-paying crypto ads
    this.adNetworks.set('cointraffic', {
      name: 'Cointraffic',
      scriptUrl: 'https://cdn.cointraffic.io/js/cta.js',
      publisherId: process.env.COINTRAFFIC_PUBLISHER_ID,
      enabled: !!process.env.COINTRAFFIC_PUBLISHER_ID
    });

    // A-Ads - Anonymous crypto advertising
    this.adNetworks.set('aads', {
      name: 'A-Ads',
      scriptUrl: 'https://cdn.a-ads.com/js/aadf.js',
      publisherId: process.env.AADS_PUBLISHER_ID,
      enabled: !!process.env.AADS_PUBLISHER_ID
    });
  }

  /**
   * Get enabled ad networks
   */
  getEnabledNetworks(): AdNetwork[] {
    return Array.from(this.adNetworks.values()).filter(network => network.enabled);
  }

  /**
   * Generate real ad placement configuration for frontend
   */
  getAdPlacement(placementId: string, type: 'banner' | 'video' | 'popup' | 'interstitial' = 'banner'): AdPlacement | null {
    const enabledNetworks = this.getEnabledNetworks();
    if (enabledNetworks.length === 0) return null;

    // Select network based on priority (Bitmedia > Cointraffic > A-Ads)
    const selectedNetwork = enabledNetworks.find(n => n.name === 'Bitmedia') ||
                           enabledNetworks.find(n => n.name === 'Cointraffic') ||
                           enabledNetworks[0];

    const placement: AdPlacement = {
      id: placementId,
      network: selectedNetwork.name.toLowerCase(),
      type,
      size: this.getAdSize(type),
      publisherId: selectedNetwork.publisherId,
      unitId: `${placementId}_${type}`
    };

    return placement;
  }

  private getAdSize(type: string): string {
    switch (type) {
      case 'banner':
        return '728x90'; // Leaderboard
      case 'video':
        return '640x360'; // 16:9 video
      case 'popup':
        return '300x250'; // Medium rectangle
      case 'interstitial':
        return '320x480'; // Mobile interstitial
      default:
        return '300x250';
    }
  }

  /**
   * Track ad impression - now with real database persistence
   */
  async trackImpression(
    placementId: string, 
    network: string, 
    userId?: string, 
    sessionId?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    try {
      const placement = this.getAdPlacement(placementId);
      if (!placement) throw new Error('Invalid placement');

      const [impression] = await db.insert(adImpressions).values({
        userId: userId || null,
        sessionId: sessionId || `session_${Date.now()}`,
        placementId,
        network,
        adType: placement.type,
        adUnitId: placement.unitId,
        ipAddress,
        userAgent,
        revenue: '0', // Will be updated by network callbacks
        cpm: '0'
      }).returning();

      console.log(`✅ Ad impression tracked: ${impression.id} for ${placementId} on ${network}`);
      return impression.id;
    } catch (error) {
      console.error('Failed to track impression:', error);
      throw error;
    }
  }

  /**
   * Track ad click - now with real database persistence
   */
  async trackClick(
    impressionId: string,
    placementId: string, 
    network: string, 
    userId?: string,
    clickUrl?: string
  ): Promise<string> {
    try {
      const [click] = await db.insert(adClicks).values({
        impressionId,
        userId: userId || null,
        placementId,
        network,
        clickUrl,
        revenue: '0', // Will be updated by network callbacks
        cpc: '0'
      }).returning();

      console.log(`✅ Ad click tracked: ${click.id} for ${placementId} on ${network}`);
      return click.id;
    } catch (error) {
      console.error('Failed to track click:', error);
      throw error;
    }
  }

  /**
   * Track ad completion for faucet claim validation
   */
  async trackAdCompletion(
    userId: string,
    impressionId: string,
    sessionId: string,
    network: string,
    completionType: 'view' | 'click' | 'conversion' = 'view'
  ): Promise<string> {
    try {
      // Create ad completion with 1-hour expiry
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // SECURITY FIX: NEVER auto-verify completions - only webhooks can verify
      const [completion] = await db.insert(adCompletions).values({
        userId,
        impressionId,
        sessionId,
        network,
        completionType,
        verified: false, // NEVER auto-verify - only webhooks can set true
        verificationMethod: 'pending_webhook',
        revenue: '0.001', // Small revenue for demo
        expiresAt
      }).returning();

      console.log(`✅ Ad completion tracked: ${completion.id} for user ${userId}`);
      return completion.id;
    } catch (error) {
      console.error('Failed to track ad completion:', error);
      throw error;
    }
  }

  /**
   * SECURITY: Verify if user has completed required ad for faucet claim (WEBHOOK-ONLY)
   */
  async verifyAdCompletion(userId: string, sessionId: string): Promise<boolean> {
    try {
      // SECURITY FIX: Only accept webhook-verified completions for faucet claims
      const recentCompletion = await db.select()
        .from(adCompletions)
        .where(
          and(
            eq(adCompletions.userId, userId),
            eq(adCompletions.sessionId, sessionId),
            eq(adCompletions.verified, true),
            eq(adCompletions.verificationMethod, 'webhook'), // ONLY webhook verifications count!
            gte(adCompletions.expiresAt, new Date())
          )
        )
        .orderBy(desc(adCompletions.createdAt))
        .limit(1);

      const isVerified = recentCompletion.length > 0;
      console.log(`🔐 SECURITY: Faucet claim verification for ${userId}: ${isVerified ? 'APPROVED (webhook-verified)' : 'DENIED (no webhook verification)'}`);
      
      return isVerified;
    } catch (error) {
      console.error('Failed to verify ad completion:', error);
      return false;
    }
  }

  /**
   * Calculate estimated revenue for faucet funding
   */
  async getEstimatedRevenue(dailyImpressions: number): Promise<{ [network: string]: number }> {
    const revenue: { [network: string]: number } = {};

    // Estimated CPM rates for crypto ad networks (in USD)
    const estimatedCPM = {
      bitmedia: 2.50,    // $2.50 CPM - premium crypto traffic
      cointraffic: 2.00, // $2.00 CPM - quality crypto ads
      aads: 1.50         // $1.50 CPM - anonymous crypto ads
    };

    for (const [networkName, network] of this.adNetworks) {
      if (network.enabled) {
        const cpm = estimatedCPM[networkName as keyof typeof estimatedCPM] || 1.00;
        revenue[networkName] = (dailyImpressions / 1000) * cpm;
      }
    }

    return revenue;
  }

  /**
   * Get ad script tags for frontend integration
   */
  getAdScripts(): string[] {
    return this.getEnabledNetworks()
      .filter(network => network.scriptUrl)
      .map(network => network.scriptUrl!);
  }

  /**
   * Get Bitmedia ad code for real integration
   */
  getBitmediaAdCode(placementId: string, size: string = '728x90'): string {
    const network = this.adNetworks.get('bitmedia');
    if (!network?.enabled || !network.publisherId) return '';

    return `
      <div id="bitmedia-${placementId}" style="width:${size.split('x')[0]}px;height:${size.split('x')[1]}px;">
        <script>
          (function() {
            var s = document.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.src = 'https://js.bitmedia.io/btm.js?pid=${network.publisherId}&zone=${placementId}';
            s.onload = function() {
              // Track impression when ad loads
              fetch('/api/advertising/impression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  placementId: '${placementId}', 
                  network: 'bitmedia',
                  sessionId: window.adSessionId || 'session_' + Date.now()
                })
              });
            };
            var x = document.getElementsByTagName('script')[0];
            x.parentNode.insertBefore(s, x);
          })();
        </script>
      </div>
    `;
  }

  /**
   * Get Cointraffic ad code for real integration
   */
  getCointrafficAdCode(placementId: string, size: string = '728x90'): string {
    const network = this.adNetworks.get('cointraffic');
    if (!network?.enabled || !network.publisherId) return '';

    return `
      <div id="cointraffic-${placementId}" style="width:${size.split('x')[0]}px;height:${size.split('x')[1]}px;">
        <script>
          (function() {
            window.cointraffic_config = {
              publisher_id: '${network.publisherId}',
              zone_id: '${placementId}',
              size: '${size}'
            };
            var s = document.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.src = 'https://cdn.cointraffic.io/js/cta.js';
            s.onload = function() {
              // Track impression when ad loads
              fetch('/api/advertising/impression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  placementId: '${placementId}', 
                  network: 'cointraffic',
                  sessionId: window.adSessionId || 'session_' + Date.now()
                })
              });
            };
            var x = document.getElementsByTagName('script')[0];
            x.parentNode.insertBefore(s, x);
          })();
        </script>
      </div>
    `;
  }

  /**
   * SECURITY: Check if session has webhook-verified completion (prevents spoofing)
   */
  async checkWebhookVerifiedCompletion(sessionId: string): Promise<boolean> {
    try {
      const verifiedCompletion = await db.select()
        .from(adCompletions)
        .where(
          and(
            eq(adCompletions.sessionId, sessionId),
            eq(adCompletions.verified, true),
            eq(adCompletions.verificationMethod, 'webhook'), // Only webhook verifications count
            gte(adCompletions.expiresAt, new Date())
          )
        )
        .limit(1);

      return verifiedCompletion.length > 0;
    } catch (error) {
      console.error('Failed to check webhook verification:', error);
      return false;
    }
  }

  /**
   * SECURITY: Validate webhook signature using HMAC-SHA256 on raw body (prevents forgery)
   */
  private validateWebhookSignature(network: string, rawBody: Buffer, signature?: string): boolean {
    const crypto = require('crypto');
    
    if (!signature) {
      console.error(`❌ SECURITY: Missing webhook signature for ${network}`);
      return false;
    }
    
    // Get production webhook secrets (FAIL CLOSED if not configured)
    const secrets = {
      'bitmedia': process.env.BITMEDIA_WEBHOOK_SECRET,
      'cointraffic': process.env.COINTRAFFIC_WEBHOOK_SECRET
    };
    
    const secret = secrets[network as keyof typeof secrets];
    if (!secret) {
      console.error(`❌ SECURITY: No webhook secret configured for ${network} - REJECTING`);
      return false; // FAIL CLOSED - no demo mode allowed
    }
    
    try {
      // CRITICAL: Use raw body bytes exactly as vendor signed them
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody) // Use raw Buffer, not stringified JSON
        .digest('hex');
      
      // Expected format: "sha256=<hash>" (GitHub/standard format)
      const expectedHeader = `sha256=${expectedSignature}`;
      
      // Secure comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedHeader, 'utf8')
      );
      
      if (!isValid) {
        console.error(`❌ SECURITY: Invalid HMAC signature for ${network}`);
        console.error(`Expected: ${expectedHeader}`);
        console.error(`Received: ${signature}`);
        console.error(`Raw body length: ${rawBody.length} bytes`);
      } else {
        console.log(`✅ SECURITY: Valid HMAC signature verified for ${network}`);
      }
      
      return isValid;
    } catch (error) {
      console.error(`❌ SECURITY: Signature validation error for ${network}:`, error);
      return false;
    }
  }

  /**
   * SECURITY: Process real vendor webhook completion (secure method)
   */
  async processWebhookCompletion(network: string, webhookData: any, signature?: string, rawBody?: Buffer): Promise<void> {
    try {
      // SECURITY: Validate webhook signature first using raw body bytes
      if (!rawBody || !this.validateWebhookSignature(network, rawBody, signature)) {
        throw new Error(`Unauthorized webhook - invalid signature for ${network}`);
      }

      // Extract session/impression info from webhook
      const { sessionId, impressionId, eventType } = webhookData;
      
      if (!sessionId || !impressionId) {
        throw new Error('Invalid webhook data - missing session/impression ID');
      }

      // Update existing completion record to verified (don't create new)
      const updateResult = await db.update(adCompletions)
        .set({
          verified: true, // VERIFIED BY AUTHENTICATED WEBHOOK
          verificationMethod: 'webhook', // SECURE METHOD
          revenue: webhookData.revenue || '0.001'
        })
        .where(
          and(
            eq(adCompletions.sessionId, sessionId),
            eq(adCompletions.impressionId, impressionId),
            eq(adCompletions.network, network)
          )
        );

      console.log(`✅ SECURITY: Authenticated webhook verification for session ${sessionId}`);
    } catch (error) {
      console.error('Failed to process webhook completion:', error);
      throw error;
    }
  }

  /**
   * Check if advertising is properly configured
   */
  isConfigured(): boolean {
    return this.getEnabledNetworks().length > 0;
  }

  /**
   * Get real advertising statistics from database
   */
  async getAdvertisingStats(): Promise<{
    totalRevenue: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    rpm: number; // revenue per mille
  }> {
    try {
      const impressionStats = await db.select({
        count: sql<number>`COUNT(*)`,
        revenue: sql<number>`SUM(CAST(${adImpressions.revenue} AS DECIMAL))`
      }).from(adImpressions);

      const clickStats = await db.select({
        count: sql<number>`COUNT(*)`
      }).from(adClicks);

      const totalImpressions = impressionStats[0]?.count || 0;
      const totalClicks = clickStats[0]?.count || 0;
      const totalRevenue = impressionStats[0]?.revenue || 0;

      return {
        totalRevenue,
        totalImpressions,
        totalClicks,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        rpm: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0
      };
    } catch (error) {
      console.error('Failed to get advertising stats:', error);
      return {
        totalRevenue: 0,
        totalImpressions: 0,
        totalClicks: 0,
        ctr: 0,
        rpm: 0
      };
    }
  }
}

// Singleton instance
let advertisingService: AdvertisingService | null = null;

export function getAdvertisingService(): AdvertisingService {
  if (!advertisingService) {
    advertisingService = new AdvertisingService();
  }
  return advertisingService;
}