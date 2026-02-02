'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { buildServerUrl } from '@/lib/api';
import { useSystemStatus, getStatusColor, StatusLevel } from '@/hooks/useSystemStatus';
import { useAuth } from '@/hooks/useAuth';
import { BRAND, PRIMARY_HOSTNAME } from '@/lib/brand';

type KeyName = 'openai' | 'meshy';
type KeyMetaState = Record<KeyName, { present: boolean }>;
type ValidationState = Record<KeyName, { validating: boolean; result?: { ok: boolean; message?: string; error?: string } }>;

type LLMProvider = 'openai-cloud' | 'local-compatible';
type LLMConfig = {
  provider: LLMProvider;
  baseUrl?: string;
  baseUrlHost?: string;
  keyConfigured: boolean;
  updatedAt: string;
};

const SETUP_STEPS = [
  { id: 'pin', title: 'Set Owner PIN', description: 'Secure admin access to settings' },
  { id: 'https', title: 'Trust HTTPS Certificate', description: 'Enable secure mic/camera access' },
  { id: 'remote', title: 'Remote Access', description: 'Optional - access AKIOR from anywhere' },
  { id: 'llm', title: 'Configure LLM Provider', description: 'Required for voice assistant and AI features' },
  { id: 'meshy', title: 'Configure Meshy API Key', description: 'Optional - enables 3D model generation' },
] as const;

function StatusBadge({ level }: { level: StatusLevel }) {
  const color = getStatusColor(level);
  const labels: Record<StatusLevel, string> = {
    healthy: 'All Systems Ready',
    setup_required: 'Setup Required',
    degraded: 'Degraded',
    error: 'Error',
    offline: 'Offline',
    loading: 'Checking...',
  };
  
  return (
    <div 
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ 
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}40`
      }}
    >
      <div 
        className={`w-2 h-2 rounded-full ${level === 'healthy' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color }}
      />
      {labels[level]}
    </div>
  );
}

function SecureContextStatus() {
  const [isSecure, setIsSecure] = useState<boolean | null>(null);
  
  useEffect(() => {
    setIsSecure(window.isSecureContext);
  }, []);
  
  if (isSecure === null) return null;
  
  return (
    <div className={`rounded-xl p-4 ${isSecure ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
      <div className="flex items-center gap-2 mb-2">
        {isSecure ? (
          <span className="text-emerald-400">✓ Secure Context</span>
        ) : (
          <span className="text-amber-400">⚠ Not Secure</span>
        )}
      </div>
      <p className="text-sm text-white/70">
        {isSecure 
          ? 'Your browser trusts the HTTPS certificate. Mic/camera access is available.'
          : 'Browser does not trust the certificate. Mic/camera may not work.'}
      </p>
      {!isSecure && (
        <div className="mt-3 p-3 bg-black/30 rounded-lg">
          <p className="text-xs text-white/60 mb-2">On Windows, run this command to install the certificate:</p>
          <code className="text-xs text-cyan-400 font-mono">.\ops\trust-lan-https.ps1 -Apply</code>
          <p className="text-xs text-white/40 mt-2">Then restart your browser completely.</p>
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  const { status, isLoading: statusLoading } = useSystemStatus();
  const { pinConfigured, setPin, loading: authLoading } = useAuth();
  const [keysMeta, setKeysMeta] = useState<KeyMetaState | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Record<KeyName, string>>({ openai: '', meshy: '' });
  const [savingKeys, setSavingKeys] = useState<Record<KeyName, boolean>>({ openai: false, meshy: false });
  const [validation, setValidation] = useState<ValidationState>({ openai: { validating: false }, meshy: { validating: false } });
  const [feedback, setFeedback] = useState<Record<KeyName, { type: 'success' | 'error'; message: string } | undefined>>({
    openai: undefined,
    meshy: undefined,
  });
  
  // HTTPS Status state
  const [httpsStatus, setHttpsStatus] = useState<{ caAvailable: boolean; caFingerprint?: string; httpsMode?: string } | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [certTab, setCertTab] = useState<'windows' | 'macos' | 'ios' | 'android'>('windows');
  
  // Remote Access state
  const [remoteStatus, setRemoteStatus] = useState<{
    mode: string;
    tailscaleInstalled: boolean;
    tailscaleUp: boolean;
    serveEnabled: boolean;
    suggestedUrl?: string;
  } | null>(null);
  const [remoteAuthKey, setRemoteAuthKey] = useState('');
  const [remoteEnabling, setRemoteEnabling] = useState(false);
  const [remoteDisabling, setRemoteDisabling] = useState(false);
  const [remoteFeedback, setRemoteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // LLM Provider state
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai-cloud');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ ok: boolean; message?: string; error?: string; latencyMs?: number } | null>(null);
  const [llmFeedback, setLlmFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // PIN state
  const [pin, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleSetPin = async () => {
    setPinError(null);
    
    // Validate format
    if (!/^\d{4,8}$/.test(pin)) {
      setPinError('PIN must be 4-8 digits');
      return;
    }
    
    // Validate confirmation
    if (pin !== pinConfirm) {
      setPinError('PINs do not match');
      return;
    }
    
    setPinSaving(true);
    const result = await setPin(pin);
    setPinSaving(false);
    
    if (result.ok) {
      setPinSuccess(true);
      setPinValue('');
      setPinConfirm('');
    } else {
      setPinError(result.error || 'Failed to set PIN');
    }
  };

  const refreshMeta = useCallback(async () => {
    try {
      const response = await fetch(buildServerUrl('/admin/keys/meta'));
      if (response.ok) {
        const payload = await response.json();
        setKeysMeta(payload.meta as KeyMetaState);
      }
    } catch (error) {
      console.error('Failed to load key metadata', error);
    }
  }, []);

  const refreshLLMConfig = useCallback(async () => {
    try {
      const response = await fetch(buildServerUrl('/admin/llm/config'), { credentials: 'include' });
      if (response.ok) {
        const payload = await response.json();
        if (payload.config) {
          setLlmConfig(payload.config as LLMConfig);
          setLlmProvider(payload.config.provider);
          setLlmBaseUrl(payload.config.baseUrl || '');
        }
      }
    } catch (error) {
      console.error('Failed to load LLM config', error);
    }
  }, []);

  const refreshHttpsStatus = useCallback(async () => {
    try {
      const response = await fetch(buildServerUrl('/admin/https/status'), { credentials: 'include' });
      if (response.ok) {
        const payload = await response.json();
        setHttpsStatus(payload);
      }
    } catch (error) {
      console.error('Failed to load HTTPS status', error);
    }
  }, []);

  const refreshRemoteStatus = useCallback(async () => {
    try {
      const response = await fetch(buildServerUrl('/admin/remote-access/status'), { credentials: 'include' });
      if (response.ok) {
        const payload = await response.json();
        setRemoteStatus(payload);
      }
    } catch (error) {
      console.error('Failed to load remote access status', error);
    }
  }, []);

  useEffect(() => {
    refreshMeta();
    refreshLLMConfig();
    refreshHttpsStatus();
    refreshRemoteStatus();
  }, [refreshMeta, refreshLLMConfig, refreshHttpsStatus, refreshRemoteStatus]);

  const handleDownloadCert = async () => {
    setDownloadingCert(true);
    try {
      const response = await fetch(buildServerUrl('/admin/https/ca'), { credentials: 'include' });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'akior-local-ca.pem';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to download certificate');
      }
    } catch (error) {
      alert('Failed to download certificate');
    } finally {
      setDownloadingCert(false);
    }
  };

  const handleEnableRemote = async () => {
    setRemoteEnabling(true);
    setRemoteFeedback(null);
    try {
      const body: any = { mode: 'tailscale' };
      if (remoteAuthKey.trim()) {
        body.authKey = remoteAuthKey.trim();
      }
      const response = await fetch(buildServerUrl('/admin/remote-access/enable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.ok) {
        setRemoteFeedback({ type: 'success', message: 'Remote access enabled!' });
        setRemoteAuthKey('');
        await refreshRemoteStatus();
      } else {
        setRemoteFeedback({ type: 'error', message: result.message || 'Failed to enable remote access' });
      }
    } catch (error) {
      setRemoteFeedback({ type: 'error', message: 'Failed to enable remote access' });
    } finally {
      setRemoteEnabling(false);
    }
  };

  const handleDisableRemote = async () => {
    setRemoteDisabling(true);
    setRemoteFeedback(null);
    try {
      const response = await fetch(buildServerUrl('/admin/remote-access/disable'), {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.ok) {
        setRemoteFeedback({ type: 'success', message: 'Remote access disabled' });
        await refreshRemoteStatus();
      } else {
        setRemoteFeedback({ type: 'error', message: result.message || 'Failed to disable remote access' });
      }
    } catch (error) {
      setRemoteFeedback({ type: 'error', message: 'Failed to disable remote access' });
    } finally {
      setRemoteDisabling(false);
    }
  };

  const handleLLMTest = async () => {
    setLlmTesting(true);
    setLlmTestResult(null);
    
    try {
      const response = await fetch(buildServerUrl('/admin/llm/test'), {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      setLlmTestResult(result);
    } catch (error) {
      setLlmTestResult({ ok: false, error: 'Failed to test connection' });
    } finally {
      setLlmTesting(false);
    }
  };

  const handleLLMSave = async () => {
    setLlmSaving(true);
    setLlmFeedback(null);
    
    try {
      const body: any = { provider: llmProvider };
      if (llmProvider === 'local-compatible') {
        body.baseUrl = llmBaseUrl;
      }
      if (llmApiKey) {
        body.apiKey = llmApiKey;
      }
      
      const response = await fetch(buildServerUrl('/admin/llm/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      
      const result = await response.json();
      
      if (result.ok) {
        setLlmFeedback({ type: 'success', message: 'LLM provider configured successfully!' });
        setLlmApiKey(''); // Clear the key input
        await refreshLLMConfig();
      } else {
        setLlmFeedback({ type: 'error', message: result.error || 'Failed to save configuration' });
      }
    } catch (error) {
      setLlmFeedback({ type: 'error', message: 'Failed to save configuration' });
    } finally {
      setLlmSaving(false);
    }
  };

  const validateKey = async (name: KeyName) => {
    const key = pendingKeys[name].trim();
    if (!key) return;
    
    setValidation(prev => ({ ...prev, [name]: { validating: true } }));
    
    try {
      const response = await fetch(buildServerUrl('/admin/keys/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, provider: name }),
      });
      const result = await response.json();
      setValidation(prev => ({ ...prev, [name]: { validating: false, result } }));
    } catch (error) {
      setValidation(prev => ({ 
        ...prev, 
        [name]: { validating: false, result: { ok: false, error: 'Validation failed' } } 
      }));
    }
  };

  const saveKey = async (name: KeyName) => {
    const value = pendingKeys[name].trim();
    if (!value) {
      setFeedback(prev => ({ ...prev, [name]: { type: 'error', message: 'Enter a key before saving.' } }));
      return;
    }

    setSavingKeys(prev => ({ ...prev, [name]: true }));
    setFeedback(prev => ({ ...prev, [name]: undefined }));

    try {
      const response = await fetch(buildServerUrl('/admin/keys'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to save key');
      }

      const payload = await response.json();
      if (payload?.meta) {
        setKeysMeta(payload.meta as KeyMetaState);
      }
      setPendingKeys(prev => ({ ...prev, [name]: '' }));
      setValidation(prev => ({ ...prev, [name]: { validating: false } }));
      setFeedback(prev => ({ ...prev, [name]: { type: 'success', message: 'Key saved successfully!' } }));
    } catch (error) {
      setFeedback(prev => ({
        ...prev,
        [name]: { type: 'error', message: error instanceof Error ? error.message : 'Failed to save key' },
      }));
    } finally {
      setSavingKeys(prev => ({ ...prev, [name]: false }));
    }
  };

  const getStepStatus = (stepId: string): 'complete' | 'current' | 'upcoming' => {
    if (stepId === 'pin') {
      if (pinConfigured) return 'complete';
      return 'current';
    }
    if (stepId === 'https') {
      if (typeof window !== 'undefined' && window.isSecureContext) return 'complete';
      if (pinConfigured) return 'current';
      return 'upcoming';
    }
    if (stepId === 'remote') {
      // Remote is optional - always show as complete (skippable)
      if (remoteStatus?.serveEnabled) return 'complete';
      if (typeof window !== 'undefined' && window.isSecureContext) return 'current';
      return 'upcoming';
    }
    if (stepId === 'llm') {
      // LLM is configured if the key is set (for openai-cloud) or baseUrl is set (for local)
      const isConfigured = llmConfig?.keyConfigured || 
        (llmConfig?.provider === 'local-compatible' && llmConfig?.baseUrl);
      if (isConfigured) return 'complete';
      // Current after https is complete (remote is optional)
      if (typeof window !== 'undefined' && window.isSecureContext) return 'current';
      return 'upcoming';
    }
    if (stepId === 'meshy') {
      if (keysMeta?.meshy?.present) return 'complete';
      const llmConfigured = llmConfig?.keyConfigured || 
        (llmConfig?.provider === 'local-compatible' && llmConfig?.baseUrl);
      if (llmConfigured) return 'current';
      return 'upcoming';
    }
    return 'upcoming';
  };

  const allComplete = status.level === 'healthy';

  return (
    <div className="max-w-3xl mx-auto space-y-8" data-testid="setup-page">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">{BRAND.productName} Setup</h1>
        <p className="text-white/60">Complete these steps to get started with your AI assistant</p>
        
        {/* Status Badge */}
        <div className="flex justify-center">
          {statusLoading ? (
            <div className="text-white/40 text-sm">Checking system status...</div>
          ) : (
            <StatusBadge level={status.level} />
          )}
        </div>
      </div>

      {/* Success Banner */}
      {allComplete && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <h2 className="text-xl font-semibold text-emerald-400 mb-2">Setup Complete!</h2>
          <p className="text-white/70 mb-4">Your {BRAND.productName} system is ready to use.</p>
          <Link 
            href="/menu" 
            className="inline-block px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
          >
            Go to Menu →
          </Link>
        </div>
      )}

      {/* Progress Steps */}
      <div className="space-y-2">
        {SETUP_STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step.id);
          return (
            <div 
              key={step.id}
              className={`flex items-center gap-4 p-3 rounded-lg ${
                stepStatus === 'complete' ? 'bg-emerald-500/10' : 
                stepStatus === 'current' ? 'bg-blue-500/10' : 
                'bg-white/5'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stepStatus === 'complete' ? 'bg-emerald-500 text-white' :
                stepStatus === 'current' ? 'bg-blue-500 text-white' :
                'bg-white/20 text-white/50'
              }`}>
                {stepStatus === 'complete' ? '✓' : index + 1}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${stepStatus === 'upcoming' ? 'text-white/50' : ''}`}>
                  {step.title}
                </div>
                <div className="text-xs text-white/50">{step.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Owner PIN */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Step 1: Set Owner PIN</div>
            <p className="text-white/60 text-sm">Secure admin access with a 4-8 digit PIN</p>
          </div>
          {pinConfigured && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
              Configured ✓
            </span>
          )}
        </header>

        {pinConfigured ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <span>✓</span>
              <span>Owner PIN is configured. Admin routes are protected.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Enter PIN (4-8 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 font-mono text-center text-lg tracking-widest"
                value={pin}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                disabled={pinSaving}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1 block">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3 font-mono text-center text-lg tracking-widest"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                disabled={pinSaving}
              />
            </div>
            
            {pinError && (
              <div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">
                ✗ {pinError}
              </div>
            )}
            
            {pinSuccess && (
              <div className="text-sm text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">
                ✓ PIN set successfully!
              </div>
            )}
            
            <button 
              className="btn w-full"
              onClick={handleSetPin}
              disabled={!pin || !pinConfirm || pinSaving}
            >
              {pinSaving ? 'Setting PIN...' : 'Set PIN'}
            </button>
            
            <p className="text-xs text-white/40">
              This PIN protects admin access to Setup and Settings.
              Store it securely - there is no recovery option.
            </p>
          </div>
        )}
      </section>

      {/* Step 2: HTTPS Trust */}
      <section id="https" className="card p-6 space-y-4">
        <header>
          <div className="text-lg font-semibold">Step 2: Trust HTTPS Certificate</div>
          <p className="text-white/60 text-sm">
            Required for microphone and camera access over LAN
          </p>
        </header>
        
        <SecureContextStatus />
        
        {/* Download Certificate Button */}
        <div className="flex items-center gap-3">
          <button
            className="btn btn-secondary"
            onClick={handleDownloadCert}
            disabled={downloadingCert || !httpsStatus?.caAvailable}
            data-testid="download-cert-btn"
          >
            {downloadingCert ? 'Downloading...' : '⬇ Download Certificate'}
          </button>
          {httpsStatus?.caFingerprint && (
            <span className="text-xs text-white/40 font-mono">
              SHA256: {httpsStatus.caFingerprint.slice(0, 23)}...
            </span>
          )}
        </div>
        
        {/* Device Instructions Tabs */}
        <div className="space-y-3">
          <div className="text-sm text-white/60">Installation instructions:</div>
          <div className="flex gap-1 border-b border-white/10 pb-1">
            {(['windows', 'macos', 'ios', 'android'] as const).map((tab) => (
              <button
                key={tab}
                className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                  certTab === tab
                    ? 'bg-white/10 text-white'
                    : 'text-white/50 hover:text-white/70'
                }`}
                onClick={() => setCertTab(tab)}
              >
                {tab === 'ios' ? 'iOS/iPadOS' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="bg-black/30 rounded-lg p-3 text-xs">
            {certTab === 'windows' && (
              <div className="space-y-2">
                <p className="text-white/60">Run in PowerShell (as Admin):</p>
                <code className="block text-cyan-400 font-mono">.\ops\trust-lan-https.ps1 -Apply</code>
                <p className="text-white/40">Then restart your browser completely.</p>
              </div>
            )}
            {certTab === 'macos' && (
              <div className="space-y-2">
                <p className="text-white/60">1. Download the certificate above</p>
                <p className="text-white/60">2. Open Keychain Access → System → Certificates</p>
                <p className="text-white/60">3. Drag the .pem file into the list</p>
                <p className="text-white/60">4. Double-click it → Trust → "Always Trust"</p>
                <p className="text-white/40">Restart browser after trusting.</p>
              </div>
            )}
            {certTab === 'ios' && (
              <div className="space-y-2">
                <p className="text-white/60">1. Download cert on device (or AirDrop from Mac)</p>
                <p className="text-white/60">2. Settings → Profile Downloaded → Install</p>
                <p className="text-white/60">3. Settings → General → About → Certificate Trust Settings</p>
                <p className="text-white/60">4. Enable trust for "Caddy Local Authority"</p>
              </div>
            )}
            {certTab === 'android' && (
              <div className="space-y-2">
                <p className="text-white/60">1. Download cert to device</p>
                <p className="text-white/60">2. Settings → Security → Encryption → Install from storage</p>
                <p className="text-white/60">3. Select the downloaded .pem file</p>
                <p className="text-white/60">4. Name it "AKIOR LAN CA" and select "VPN and apps"</p>
                <p className="text-white/40">Location varies by Android version/vendor.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg p-2">
          💡 Prefer <code className="font-mono">akior.home.arpa</code> over <code className="font-mono">akior.local</code> for reliable resolution.
        </div>
        
        <div className="text-sm text-white/50">
          <Link href="/diagnostics" className="text-cyan-400 hover:underline">
            View full diagnostics →
          </Link>
        </div>
      </section>

      {/* Step 3: Remote Access (Optional) */}
      <section id="remote-access" className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Step 3: Remote Access <span className="text-white/40 font-normal">(Optional)</span></div>
            <p className="text-white/60 text-sm">Access {BRAND.productName} from anywhere via Tailscale</p>
          </div>
          {remoteStatus?.serveEnabled && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
              Enabled ✓
            </span>
          )}
        </header>
        
        {/* Status */}
        <div className={`rounded-xl p-4 ${
          remoteStatus?.serveEnabled 
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-white/5 border border-white/10'
        }`}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-white/60">Tailscale:</div>
            <div className={remoteStatus?.tailscaleInstalled ? 'text-emerald-400' : 'text-amber-400'}>
              {remoteStatus?.tailscaleInstalled ? (remoteStatus.tailscaleUp ? '✓ Connected' : '⚠ Not connected') : '✗ Not installed'}
            </div>
            <div className="text-white/60">Serve:</div>
            <div className={remoteStatus?.serveEnabled ? 'text-emerald-400' : 'text-white/40'}>
              {remoteStatus?.serveEnabled ? '✓ Enabled' : 'Disabled'}
            </div>
            {remoteStatus?.suggestedUrl && (
              <>
                <div className="text-white/60">Remote URL:</div>
                <a href={remoteStatus.suggestedUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline truncate">
                  {remoteStatus.suggestedUrl}
                </a>
              </>
            )}
          </div>
        </div>
        
        {/* Enable/Disable Controls */}
        {!remoteStatus?.serveEnabled ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-white/60 mb-2">Auth Key <span className="text-white/30">(one-time, optional)</span></label>
              <input
                type="password"
                className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3"
                value={remoteAuthKey}
                onChange={(e) => setRemoteAuthKey(e.target.value)}
                placeholder="tskey-auth-..."
                disabled={remoteEnabling}
              />
              <p className="text-xs text-amber-400/70 mt-1">⚠ Not stored. Only needed if Tailscale is not already connected.</p>
            </div>
            <button
              className="btn"
              onClick={handleEnableRemote}
              disabled={remoteEnabling || !remoteStatus?.tailscaleInstalled}
            >
              {remoteEnabling ? 'Enabling...' : 'Enable Remote Access'}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={handleDisableRemote}
            disabled={remoteDisabling}
          >
            {remoteDisabling ? 'Disabling...' : 'Disable Remote Access'}
          </button>
        )}
        
        {/* Feedback */}
        {remoteFeedback && (
          <div className={`text-sm px-3 py-2 rounded-lg ${
            remoteFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {remoteFeedback.type === 'success' ? '✓ ' : '✗ '}
            {remoteFeedback.message}
          </div>
        )}
        
        <div className="text-xs text-white/40">
          Remote access uses Tailscale Serve — no router port-forwarding needed.
          <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">
            Get Tailscale →
          </a>
        </div>
      </section>

      {/* Step 4: LLM Provider */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Step 4: LLM Provider</div>
            <p className="text-white/60 text-sm">Required for voice assistant and AI features</p>
          </div>
          {llmConfig?.keyConfigured && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
              Configured ✓
            </span>
          )}
        </header>

        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Provider Type</label>
            <div className="flex gap-3">
              <button
                className={`flex-1 px-4 py-3 rounded-xl border transition-colors ${
                  llmProvider === 'openai-cloud'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-white/10 hover:border-white/20'
                }`}
                onClick={() => setLlmProvider('openai-cloud')}
                disabled={llmSaving}
              >
                <div className="font-medium">OpenAI Cloud</div>
                <div className="text-xs text-white/40 mt-1">Use OpenAI's API directly</div>
              </button>
              <button
                className={`flex-1 px-4 py-3 rounded-xl border transition-colors ${
                  llmProvider === 'local-compatible'
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-white/10 hover:border-white/20'
                }`}
                onClick={() => setLlmProvider('local-compatible')}
                disabled={llmSaving}
              >
                <div className="font-medium">Local / Compatible</div>
                <div className="text-xs text-white/40 mt-1">OpenAI-compatible endpoint</div>
              </button>
            </div>
          </div>

          {/* Provider-specific inputs */}
          {llmProvider === 'openai-cloud' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/60 mb-2">API Key</label>
                <input
                  type="password"
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder="sk-..."
                  disabled={llmSaving}
                />
              </div>
              <p className="text-xs text-white/40">
                Get your API key from{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                  platform.openai.com/api-keys
                </a>
              </p>
            </div>
          )}

          {llmProvider === 'local-compatible' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/60 mb-2">Base URL</label>
                <input
                  type="text"
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3"
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  disabled={llmSaving}
                />
                <p className="text-xs text-white/40 mt-1">
                  OpenAI-compatible endpoint (e.g., Ollama, LM Studio, vLLM)
                </p>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-2">API Key <span className="text-white/30">(optional)</span></label>
                <input
                  type="password"
                  className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder="Leave empty if not required"
                  disabled={llmSaving}
                />
              </div>
            </div>
          )}

          {/* Test result */}
          {llmTestResult && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              llmTestResult.ok 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {llmTestResult.ok ? '✓ ' : '✗ '}
              {llmTestResult.message || llmTestResult.error}
            </div>
          )}

          {/* Feedback */}
          {llmFeedback && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              llmFeedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {llmFeedback.type === 'success' ? '✓ ' : '✗ '}
              {llmFeedback.message}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button 
              className="btn btn-secondary"
              onClick={handleLLMTest}
              disabled={
                llmTesting || llmSaving ||
                (llmProvider === 'openai-cloud' && !llmApiKey.trim()) ||
                (llmProvider === 'local-compatible' && !llmBaseUrl.trim())
              }
            >
              {llmTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button 
              className="btn"
              onClick={handleLLMSave}
              disabled={
                llmSaving ||
                (llmProvider === 'openai-cloud' && !llmApiKey.trim()) ||
                (llmProvider === 'local-compatible' && !llmBaseUrl.trim())
              }
            >
              {llmSaving ? 'Saving...' : llmConfig?.keyConfigured ? 'Update Provider' : 'Save Provider'}
            </button>
          </div>

          {/* Current config info */}
          {llmConfig?.keyConfigured && (
            <div className="text-xs text-white/40 pt-2 border-t border-white/5">
              Currently using: <span className="text-white/60">
                {llmConfig.provider === 'openai-cloud' ? 'OpenAI Cloud' : 'Local/Compatible'}
              </span>
              {llmConfig.baseUrlHost && (
                <> at <span className="text-white/60">{llmConfig.baseUrlHost}</span></>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Step 5: Meshy Key (Optional) */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Step 5: Meshy API Key <span className="text-white/40 font-normal">(Optional)</span></div>
            <p className="text-white/60 text-sm">Enables 3D model generation from images</p>
          </div>
          {keysMeta?.meshy?.present && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
              Configured ✓
            </span>
          )}
        </header>

        <div className="space-y-3">
          <input
            type="password"
            className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3"
            value={pendingKeys.meshy}
            onChange={(e) => setPendingKeys(prev => ({ ...prev, meshy: e.target.value }))}
            placeholder="msy_..."
            disabled={savingKeys.meshy}
          />
          
          {/* Validation result */}
          {validation.meshy.result && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              validation.meshy.result.ok 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {validation.meshy.result.ok ? '✓ ' : '✗ '}
              {validation.meshy.result.message || validation.meshy.result.error}
            </div>
          )}
          
          {/* Feedback */}
          {feedback.meshy && (
            <div className={`text-sm ${feedback.meshy.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {feedback.meshy.message}
            </div>
          )}

          <div className="flex gap-2">
            <button 
              className="btn btn-secondary"
              onClick={() => validateKey('meshy')}
              disabled={!pendingKeys.meshy.trim() || validation.meshy.validating || savingKeys.meshy}
            >
              {validation.meshy.validating ? 'Validating...' : 'Test Key'}
            </button>
            <button 
              className="btn"
              onClick={() => saveKey('meshy')}
              disabled={!pendingKeys.meshy.trim() || savingKeys.meshy}
            >
              {savingKeys.meshy ? 'Saving...' : keysMeta?.meshy?.present ? 'Replace Key' : 'Save Key'}
            </button>
          </div>

          <p className="text-xs text-white/40">
            Get your API key from{' '}
            <a href="https://www.meshy.ai/api" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
              meshy.ai/api
            </a>
          </p>
        </div>
      </section>

      {/* System Status Details */}
      {status.reasons.length > 0 && (
        <section className="card p-6 space-y-3">
          <div className="text-lg font-semibold">System Status Details</div>
          <ul className="space-y-2 text-sm">
            {status.reasons.map((reason, i) => (
              <li key={i} className="flex items-center gap-2 text-amber-300">
                <span>⚠</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-4">
        <Link href="/menu" className="text-white/60 hover:text-white transition">
          ← Back to Menu
        </Link>
        <Link href="/diagnostics" className="text-cyan-400 hover:underline">
          View Diagnostics →
        </Link>
      </div>
    </div>
  );
}
