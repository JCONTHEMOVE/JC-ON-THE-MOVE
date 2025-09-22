// Anti-fraud and bot detection service for daily check-ins
import crypto from 'crypto';

interface DeviceFingerprint {
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
}

interface FraudCheckResult {
  riskScore: number; // 0-100
  blocked: boolean;
  reasons: string[];
  actionTaken: string;
}

interface CheckinAttempt {
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  timestamp: Date;
}

export class FraudDetectionService {
  private suspiciousIPs: Set<string> = new Set();
  private rateLimitMap: Map<string, number[]> = new Map();

  // Generate device fingerprint hash
  generateDeviceFingerprint(data: DeviceFingerprint): string {
    const fingerprintString = JSON.stringify({
      userAgent: data.userAgent,
      screenResolution: data.screenResolution || 'unknown',
      timezone: data.timezone || 'unknown',
      language: data.language || 'unknown',
      platform: data.platform || 'unknown'
    });
    
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  // Analyze check-in attempt for fraud indicators
  async analyzeCheckinAttempt(attempt: CheckinAttempt): Promise<FraudCheckResult> {
    let riskScore = 0;
    const reasons: string[] = [];

    // IP-based checks
    const ipRisk = this.checkIPRisk(attempt.ipAddress);
    riskScore += ipRisk.score;
    if (ipRisk.reasons.length > 0) {
      reasons.push(...ipRisk.reasons);
    }

    // Rate limiting checks
    const rateLimitRisk = this.checkRateLimit(attempt.userId, attempt.ipAddress);
    riskScore += rateLimitRisk.score;
    if (rateLimitRisk.reasons.length > 0) {
      reasons.push(...rateLimitRisk.reasons);
    }

    // User-Agent analysis
    const uaRisk = this.analyzeUserAgent(attempt.userAgent);
    riskScore += uaRisk.score;
    if (uaRisk.reasons.length > 0) {
      reasons.push(...uaRisk.reasons);
    }

    // Time pattern analysis
    const timeRisk = this.analyzeTimePattern(attempt.timestamp);
    riskScore += timeRisk.score;
    if (timeRisk.reasons.length > 0) {
      reasons.push(...timeRisk.reasons);
    }

    // Determine action based on risk score
    let actionTaken = 'allowed';
    let blocked = false;

    if (riskScore >= 80) {
      blocked = true;
      actionTaken = 'blocked';
    } else if (riskScore >= 60) {
      actionTaken = 'requires_verification';
    } else if (riskScore >= 40) {
      actionTaken = 'flagged';
    }

    return {
      riskScore: Math.min(riskScore, 100),
      blocked,
      reasons,
      actionTaken
    };
  }

  private checkIPRisk(ipAddress: string): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Check if IP is in suspicious list
    if (this.suspiciousIPs.has(ipAddress)) {
      score += 50;
      reasons.push('suspicious_ip');
    }

    // Check for common VPN/proxy IP patterns
    if (this.isVpnIP(ipAddress)) {
      score += 30;
      reasons.push('vpn_detected');
    }

    // Check for rate limiting on this IP
    const recentRequests = this.rateLimitMap.get(`ip:${ipAddress}`) || [];
    const recentCount = recentRequests.filter(time => Date.now() - time < 3600000).length; // 1 hour

    if (recentCount > 10) {
      score += 40;
      reasons.push('excessive_requests_from_ip');
    }

    return { score, reasons };
  }

  private checkRateLimit(userId: string, ipAddress: string): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    const now = Date.now();
    const oneHour = 3600000;
    const oneDay = 86400000;

    // Check user-specific rate limiting
    const userKey = `user:${userId}`;
    const userRequests = this.rateLimitMap.get(userKey) || [];
    const recentUserRequests = userRequests.filter(time => now - time < oneHour);

    if (recentUserRequests.length > 3) {
      score += 60;
      reasons.push('too_many_checkin_attempts');
    }

    // Update rate limit tracking
    const filteredRequests = userRequests.filter(time => now - time < oneDay);
    filteredRequests.push(now);
    this.rateLimitMap.set(userKey, filteredRequests);

    // Also track by IP
    const ipKey = `ip:${ipAddress}`;
    const ipRequests = this.rateLimitMap.get(ipKey) || [];
    const filteredIPRequests = ipRequests.filter(time => now - time < oneDay);
    filteredIPRequests.push(now);
    this.rateLimitMap.set(ipKey, filteredIPRequests);

    return { score, reasons };
  }

  private analyzeUserAgent(userAgent: string): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    if (!userAgent || userAgent.trim().length < 10) {
      score += 40;
      reasons.push('missing_or_invalid_user_agent');
    }

    // Check for common bot patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /postman/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        score += 70;
        reasons.push('bot_user_agent_detected');
        break;
      }
    }

    // Check for unusual user agent patterns
    if (userAgent.length > 500) {
      score += 20;
      reasons.push('abnormally_long_user_agent');
    }

    if (!userAgent.includes('Mozilla') && !userAgent.includes('Chrome') && !userAgent.includes('Safari') && !userAgent.includes('Firefox')) {
      score += 30;
      reasons.push('non_standard_user_agent');
    }

    return { score, reasons };
  }

  private analyzeTimePattern(timestamp: Date): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    const hour = timestamp.getHours();
    const minute = timestamp.getMinutes();
    const second = timestamp.getSeconds();

    // Flag very unusual hours (2-5 AM consistently might be automated)
    if (hour >= 2 && hour <= 5) {
      score += 15;
      reasons.push('unusual_time_pattern');
    }

    // Flag exact minute/second patterns that might indicate automation
    if (minute === 0 && second === 0) {
      score += 10;
      reasons.push('precise_timing_pattern');
    }

    return { score, reasons };
  }

  private isVpnIP(ipAddress: string): boolean {
    // Basic VPN/proxy detection - in production, you'd use a proper service
    const commonVpnRanges = [
      '10.0.',     // Private IP ranges often used by VPNs
      '172.16.',
      '192.168.',
    ];

    // Check against Tor exit nodes and known VPN providers
    // This is a simplified check - in production use services like IPQualityScore
    const knownVpnIPs: string[] = [
      // Add known VPN IP patterns here when available
    ];

    return commonVpnRanges.some(range => ipAddress.startsWith(range)) ||
           knownVpnIPs.includes(ipAddress);
  }

  // Add IP to suspicious list
  flagSuspiciousIP(ipAddress: string): void {
    this.suspiciousIPs.add(ipAddress);
  }

  // Clear old rate limit data periodically
  cleanup(): void {
    const oneDayAgo = Date.now() - 86400000;
    
    const entries = Array.from(this.rateLimitMap.entries());
    for (const [key, timestamps] of entries) {
      const filtered = timestamps.filter((time: number) => time > oneDayAgo);
      if (filtered.length === 0) {
        this.rateLimitMap.delete(key);
      } else {
        this.rateLimitMap.set(key, filtered);
      }
    }
  }

  // Get fraud statistics
  getStats(): { suspiciousIPCount: number; trackedKeys: number } {
    return {
      suspiciousIPCount: this.suspiciousIPs.size,
      trackedKeys: this.rateLimitMap.size
    };
  }
}

export const fraudDetectionService = new FraudDetectionService();

// Run cleanup every hour
setInterval(() => {
  fraudDetectionService.cleanup();
}, 3600000);