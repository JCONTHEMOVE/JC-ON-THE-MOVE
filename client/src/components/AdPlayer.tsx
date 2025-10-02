import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AdPlayerProps {
  onAdComplete: (impressionId: string) => void;
  placementId: string;
  userId?: string;
  required?: boolean;
}

interface AdConfig {
  enabled: boolean;
  networks: Array<{
    name: string;
    enabled: boolean;
  }>;
  scripts: string[];
}

interface AdPlacement {
  id: string;
  network: string;
  type: string;
  size: string;
  publisherId?: string;
  unitId?: string;
}

export function AdPlayer({ onAdComplete, placementId, userId, required = true }: AdPlayerProps) {
  const [adStatus, setAdStatus] = useState<'waiting' | 'loading' | 'playing' | 'completed'>('waiting');
  const [countdown, setCountdown] = useState(15);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [impressionId, setImpressionId] = useState<string>('');
  const [currentNetwork, setCurrentNetwork] = useState<string>('');

  const { data: adConfig } = useQuery<AdConfig>({
    queryKey: ['/api/advertising/config'],
    staleTime: 5 * 60 * 1000
  });

  const { data: placement } = useQuery<AdPlacement>({
    queryKey: ['/api/advertising/placement', placementId],
    enabled: !!adConfig?.enabled,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (placement) {
      setCurrentNetwork(placement.network);
      console.log('Real ad placement loaded:', placement);
    }
  }, [placement]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (adStatus === 'playing' && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    
    return () => clearTimeout(timer);
  }, [adStatus, countdown]);

  const loadRealAd = async () => {
    if (!placement || !adConfig?.enabled) {
      console.log('No real ads available, using fallback');
      setAdStatus('playing');
      return;
    }
    
    try {
      setAdStatus('loading');
      
      const response = await fetch('/api/advertising/impression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          placementId, 
          network: placement.network,
          userId,
          sessionId,
          userAgent: navigator.userAgent
        })
      });
      
      const result = await response.json();
      if (result.success && result.impressionId) {
        setImpressionId(result.impressionId);
        console.log('✅ Real ad impression tracked:', result.impressionId);
        
        await loadRealNetworkAd(placement, result.impressionId);
        
        setTimeout(() => {
          setAdStatus('playing');
        }, 1000);
      } else {
        throw new Error('Failed to track impression');
      }
    } catch (error) {
      console.error('Failed to load real ad:', error);
      try {
        const fallbackResponse = await fetch('/api/advertising/impression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            placementId: `${placementId}_fallback`, 
            network: 'fallback',
            userId,
            sessionId,
            userAgent: navigator.userAgent
          })
        });
        const fallbackResult = await fallbackResponse.json();
        setImpressionId(fallbackResult.impressionId || 'error_impression');
      } catch (fallbackError) {
        console.error('Failed to create fallback impression:', fallbackError);
        setImpressionId('error_impression');
      }
      setAdStatus('playing');
    }
  };
  
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const loadRealNetworkAd = async (placement: AdPlacement, impressionId: string): Promise<void> => {
    return new Promise((resolve) => {
      (window as any).adSessionId = sessionId;
      (window as any).adImpressionId = impressionId;
      
      const adContainer = document.getElementById(`ad-container-${placementId}`);
      if (!adContainer) {
        console.error('Ad container not found');
        resolve();
        return;
      }
      
      adContainer.innerHTML = '';
      
      if (placement.network === 'bitmedia' && placement.publisherId) {
        renderBitmediaIntegration(adContainer, placement, impressionId);
      } else if (placement.network === 'cointraffic' && placement.publisherId) {
        renderCointrafficIntegration(adContainer, placement, impressionId);
      } else {
        renderFallbackAd(adContainer, placement, impressionId);
      }
      
      setTimeout(resolve, 1000);
    });
  };
  
  const renderBitmediaIntegration = (container: HTMLElement, placement: AdPlacement, impressionId: string) => {
    const [width, height] = placement.size.split('x');
    
    const adDiv = document.createElement('div');
    adDiv.id = `bitmedia-ad-${escapeHtml(placement.id)}`;
    adDiv.style.cssText = `width:${escapeHtml(width)}px;height:${escapeHtml(height)}px;position:relative;`;
    
    const loadingWrapper = document.createElement('div');
    loadingWrapper.style.cssText = 'text-align:center;padding:20px;color:#666;border:1px solid #ddd;border-radius:8px;';
    
    const loadingText = document.createElement('div');
    loadingText.style.cssText = 'font-size:14px;margin-bottom:10px;';
    loadingText.textContent = '🔄 Loading Bitmedia Ad...';
    
    const progressText = document.createElement('div');
    progressText.style.cssText = 'font-size:12px;';
    progressText.textContent = 'Real network integration in progress';
    
    loadingWrapper.appendChild(loadingText);
    loadingWrapper.appendChild(progressText);
    adDiv.appendChild(loadingWrapper);
    container.appendChild(adDiv);
    
    setTimeout(() => {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = `https://js.bitmedia.io/btm.js?pid=${encodeURIComponent(placement.publisherId || '')}&zone=${encodeURIComponent(placement.id)}`;
      script.onload = () => {
        console.log('✅ REAL Bitmedia script loaded successfully');
        (window as any).bitmediaLoaded = true;
        
        console.log('🔐 SECURITY: Real Bitmedia script loaded - waiting for server-side webhook verification');
        console.log('⚠️ SECURITY: Ad completion can ONLY be verified via authenticated server webhooks');
        
        const pollInterval = setInterval(async () => {
          try {
            const response = await fetch(`/api/advertising/check-completion/${sessionId}`);
            const result = await response.json();
            if (result.verified) {
              console.log('✅ SECURITY: Server-verified ad completion confirmed');
              clearInterval(pollInterval);
              setAdStatus('completed');
              completeAd();
            }
          } catch (error) {
            console.error('Completion check error:', error);
          }
        }, 2000);
        
        setTimeout(() => clearInterval(pollInterval), 60000);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Bitmedia script');
        const bitmediaContainer = document.getElementById(`bitmedia-ad-${escapeHtml(placement.id)}`);
        if (bitmediaContainer) {
          renderBitmediaFallback(bitmediaContainer, placement, impressionId);
        }
      };
      document.head.appendChild(script);
    }, 100);
  };
  
  const renderBitmediaFallback = (container: HTMLElement, placement: AdPlacement, impressionId: string) => {
    const [width, height] = placement.size.split('x');
    
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `width:${escapeHtml(width)}px;height:${escapeHtml(height)}px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;`;
    
    const content = document.createElement('div');
    
    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:bold;color:#007bff;margin-bottom:10px;';
    title.textContent = '🚀 Bitmedia Network';
    
    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:12px;color:#6c757d;margin-bottom:15px;';
    subtitle.textContent = 'Script loading failed - Fallback mode';
    
    const button = document.createElement('button');
    button.style.cssText = 'background:#007bff;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:12px;';
    button.textContent = 'Visit Advertiser';
    button.addEventListener('click', () => {
      (window as any).handleRealAdClick?.(impressionId, placement.id, 'bitmedia');
    });
    
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(button);
    wrapper.appendChild(content);
    container.appendChild(wrapper);
  };
  
  const renderCointrafficIntegration = (container: HTMLElement, placement: AdPlacement, impressionId: string) => {
    const [width, height] = placement.size.split('x');
    
    const adDiv = document.createElement('div');
    adDiv.id = `cointraffic-ad-${escapeHtml(placement.id)}`;
    adDiv.style.cssText = `width:${escapeHtml(width)}px;height:${escapeHtml(height)}px;position:relative;`;
    
    const loadingWrapper = document.createElement('div');
    loadingWrapper.style.cssText = 'text-align:center;padding:20px;color:#666;border:1px solid #ddd;border-radius:8px;';
    
    const loadingText = document.createElement('div');
    loadingText.style.cssText = 'font-size:14px;margin-bottom:10px;';
    loadingText.textContent = '🔄 Loading Cointraffic Ad...';
    
    const progressText = document.createElement('div');
    progressText.style.cssText = 'font-size:12px;';
    progressText.textContent = 'Real network integration in progress';
    
    loadingWrapper.appendChild(loadingText);
    loadingWrapper.appendChild(progressText);
    adDiv.appendChild(loadingWrapper);
    container.appendChild(adDiv);
    
    setTimeout(() => {
      (window as any).cointraffic_config = {
        publisher_id: placement.publisherId,
        zone_id: placement.id,
        size: placement.size
      };
      
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://cdn.cointraffic.io/js/cta.js';
      script.onload = () => {
        console.log('✅ REAL Cointraffic script loaded successfully');
        (window as any).cointrafficLoaded = true;
        
        console.log('🔐 SECURITY: Real Cointraffic script loaded - waiting for server-side webhook verification');
        console.log('⚠️ SECURITY: Ad completion can ONLY be verified via authenticated server webhooks');
        
        const pollInterval = setInterval(async () => {
          try {
            const response = await fetch(`/api/advertising/check-completion/${sessionId}`);
            const result = await response.json();
            if (result.verified) {
              console.log('✅ SECURITY: Server-verified ad completion confirmed');
              clearInterval(pollInterval);
              setAdStatus('completed');
              completeAd();
            }
          } catch (error) {
            console.error('Completion check error:', error);
          }
        }, 2000);
        
        setTimeout(() => clearInterval(pollInterval), 60000);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Cointraffic script');
        const cointrafficContainer = document.getElementById(`cointraffic-ad-${escapeHtml(placement.id)}`);
        if (cointrafficContainer) {
          renderCointrafficFallback(cointrafficContainer, placement, impressionId);
        }
      };
      document.head.appendChild(script);
    }, 100);
  };
  
  const renderCointrafficFallback = (container: HTMLElement, placement: AdPlacement, impressionId: string) => {
    const [width, height] = placement.size.split('x');
    
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `width:${escapeHtml(width)}px;height:${escapeHtml(height)}px;background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;`;
    
    const content = document.createElement('div');
    
    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:bold;color:#28a745;margin-bottom:10px;';
    title.textContent = '💎 Cointraffic Network';
    
    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:12px;color:#6c757d;margin-bottom:15px;';
    subtitle.textContent = 'Script loading failed - Fallback mode';
    
    const button = document.createElement('button');
    button.style.cssText = 'background:#28a745;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:12px;';
    button.textContent = 'Visit Advertiser';
    button.addEventListener('click', () => {
      (window as any).handleRealAdClick?.(impressionId, placement.id, 'cointraffic');
    });
    
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(button);
    wrapper.appendChild(content);
    container.appendChild(wrapper);
  };
  
  const renderFallbackAd = (container: HTMLElement, placement: AdPlacement, impressionId: string) => {
    const [width, height] = placement.size.split('x');
    
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `width:${escapeHtml(width)}px;height:${escapeHtml(height)}px;border:1px solid #dee2e6;border-radius:8px;background:#f8f9fa;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;`;
    
    const content = document.createElement('div');
    
    const title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:bold;color:#6c757d;margin-bottom:10px;';
    title.textContent = '📢 Crypto Ad Network';
    
    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size:12px;color:#495057;margin-bottom:15px;';
    subtitle.textContent = 'Supporting the faucet ecosystem';
    
    const networkInfo = document.createElement('div');
    networkInfo.style.cssText = 'font-size:10px;color:#28a745;margin-bottom:10px;';
    networkInfo.textContent = `Network: ${placement.network}`;
    
    const button = document.createElement('button');
    button.style.cssText = 'background:#6c757d;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px;';
    button.textContent = 'Support Faucet';
    button.addEventListener('click', () => {
      (window as any).handleRealAdClick?.(impressionId, placement.id, placement.network);
    });
    
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(networkInfo);
    content.appendChild(button);
    wrapper.appendChild(content);
    container.appendChild(wrapper);
  };

  const startAd = () => {
    if (adConfig?.enabled && placement) {
      console.log('🚀 Starting REAL ad integration...');
      loadRealAd();
    } else {
      console.log('⚠️ No real ads configured, using fallback');
      setAdStatus('loading');
      setTimeout(() => {
        setAdStatus('playing');
        setImpressionId('fallback_impression');
      }, 1000);
    }
  };
  
  useEffect(() => {
    (window as any).handleRealAdClick = async (impressionId: string, placementId: string, network: string) => {
      try {
        console.log('🎯 Real ad click tracked:', { impressionId, placementId, network });
        
        const response = await fetch('/api/advertising/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            impressionId,
            placementId, 
            network,
            userId,
            clickUrl: `${network}_click_url`
          })
        });
        
        const result = await response.json();
        if (result.success) {
          console.log('✅ Ad click successfully tracked with ID:', result.clickId);
        }
      } catch (error) {
        console.error('❌ Failed to track ad click:', error);
      }
    };
    
    return () => {
      delete (window as any).handleRealAdClick;
    };
  }, [userId]);

  const skipAd = () => {
    if (!required) {
      onAdComplete('skipped');
    }
  };

  const completeAd = async () => {
    if (!userId || !sessionId || !impressionId || !currentNetwork) {
      console.error('Missing required data for ad completion');
      onAdComplete(impressionId || 'fallback');
      return;
    }
    
    try {
      const response = await fetch('/api/advertising/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          impressionId,
          sessionId,
          network: currentNetwork,
          completionType: 'view'
        })
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('✅ Real ad completion tracked:', result.completionId);
        onAdComplete(impressionId);
      } else {
        throw new Error('Failed to track completion');
      }
    } catch (error) {
      console.error('❌ Failed to track ad completion:', error);
      onAdComplete(impressionId);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          {adStatus === 'waiting' && (
            <>
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <Play className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">
                {adConfig?.enabled ? `Watch ${currentNetwork ? currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1) : 'Real Crypto'} Ad to Claim` : 'Watch Ad to Claim Reward'}
              </h3>
              <p className="text-sm text-gray-600">
                {adConfig?.enabled ? 'Watch a real crypto advertisement to support the faucet' : 'Support our faucet by watching a short advertisement'}
              </p>
              <Button 
                onClick={startAd}
                className="w-full"
                data-testid="button-start-ad"
              >
                {adConfig?.enabled ? 'Start Real Advertisement' : 'Start Advertisement'}
              </Button>
              {!required && (
                <Button 
                  variant="outline" 
                  onClick={skipAd}
                  className="w-full"
                  data-testid="button-skip-ad"
                >
                  Skip Ad (Optional)
                </Button>
              )}
            </>
          )}

          {adStatus === 'loading' && (
            <>
              <div className="w-16 h-16 mx-auto bg-yellow-100 rounded-full flex items-center justify-center animate-spin">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold">
                {adConfig?.enabled ? 'Loading Real Network Advertisement...' : 'Loading Advertisement...'}
              </h3>
            </>
          )}

          {adStatus === 'playing' && (
            <>
              <div 
                id={`ad-container-${placementId}`}
                className="ad-content-container"
                data-testid="ad-content"
                style={{ minHeight: '200px', border: '1px solid #e0e0e0', borderRadius: '8px' }}
              />
              <div className="flex items-center justify-center space-x-2 mt-4">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">
                  {countdown} seconds remaining
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${((15 - countdown) / 15) * 100}%` }}
                />
              </div>
              {adConfig?.enabled && (
                <p className="text-xs text-green-600">
                  ✅ Real ad network integration active
                </p>
              )}
            </>
          )}

          {adStatus === 'completed' && (
            <>
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">Advertisement Complete!</h3>
              <p className="text-sm text-gray-600">
                Thank you for watching. You can now claim your reward.
              </p>
              {adConfig?.enabled && (
                <p className="text-xs text-green-600">
                  ✅ Ad completion verified and recorded
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
