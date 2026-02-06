'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  readSettings,
  updateJarvisSettings,
  updateModelSettings,
  updateTextChatSettings,
  updateIntegration,
  updateSettings,
  updateCamera,
  updateCameras,
  updateLockdownState,
  type AppSettings,
  type TextChatSettings,
  type IntegrationId,
  type CameraSettings,
  type LockdownState,
  integrationMetadata,
  isIntegrationConnected
} from '@shared/settings';
import { buildServerUrl } from '@/lib/api';
import { apiFetch, CsrfError } from '@/lib/apiFetch';
import { getRootSocket } from '@/lib/socket';
import { useTheme } from '@/context/ThemeContext';
import { ConversationHistory } from '@/components/ConversationHistory';
import { ActionTimeline } from '@/components/ActionTimeline';
import { LogViewer } from '@/components/LogViewer';
import {
  testAlexaIntegration,
  testIRobotIntegration,
  testNestIntegration,
  testSmartLightsIntegration
} from '@/lib/integrations';
import { BuildInfo } from '@/components/BuildInfo';

type KeyName = 'openai' | 'meshy';
type KeyMetaState = Record<KeyName, { present: boolean }>;
type FeedbackState = Partial<Record<KeyName, { type: 'success' | 'error'; message: string }>>;

export default function SettingsPage() {
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [keysMeta, setKeysMeta] = useState<KeyMetaState | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Record<KeyName, string>>({ openai: '', meshy: '' });
  const [savingKeys, setSavingKeys] = useState<Record<KeyName, boolean>>({ openai: false, meshy: false });
  const [feedback, setFeedback] = useState<FeedbackState>({});
  
  // Bambu Labs authentication state
  const [bambuEmail, setBambuEmail] = useState('');
  const [bambuPassword, setBambuPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);
  const [bambuCode, setBambuCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [bambuAuthStatus, setBambuAuthStatus] = useState<'success' | 'error' | ''>('');
  
  // Memory & Logs active tab state
  const [activeMemoryTab, setActiveMemoryTab] = useState<'conversations' | 'actions' | 'logs'>('conversations');
  const [bambuAuthMessage, setBambuAuthMessage] = useState('');
  
  // Smart Home integration test state
  const [smarthomeTestResults, setSmarthomeTestResults] = useState<Record<string, { type: 'success' | 'error'; message: string } | undefined>>({});

  // HTTPS Trust & Remote Access state
  interface HttpsStatus {
    caAvailable: boolean;
    caFingerprint: string | null;
    httpsMode: string;
  }
  interface RemoteAccessStatus {
    enabled: boolean;
    mode: 'disabled' | 'tailscale';
    tailscaleStatus?: { running: boolean; serveActive: boolean; hostname: string | null };
    servePort?: number;
  }
  const [httpsStatus, setHttpsStatus] = useState<HttpsStatus | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<RemoteAccessStatus | null>(null);
  const [downloadingCert, setDownloadingCert] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  // Fetch HTTPS and Remote Access status on mount
  useEffect(() => {
    fetch(buildServerUrl('/api/admin/https/status'))
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setHttpsStatus(data))
      .catch(() => {});
    fetch(buildServerUrl('/api/admin/remote-access/status'))
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setRemoteStatus(data))
      .catch(() => {});
  }, []);
  
  // Check Bambu Labs login status on mount
  useEffect(() => {
    fetch(buildServerUrl('/api/3dprint/token-status'))
      .then(res => res.json())
      .then(data => setBambuAuthStatus(data.loggedIn ? 'success' : ''))
      .catch(() => setBambuAuthStatus(''));
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const response = await fetch(buildServerUrl('/admin/keys/meta'));
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to load key metadata');
      }
      const payload = (await response.json()) as { meta: KeyMetaState };
      setKeysMeta(payload.meta);
    } catch (error) {
      console.error('Failed to load key metadata', error);
    }
  }, []);

  useEffect(() => {
    void refreshMeta();
    const socket = getRootSocket();
    if (!socket) return;
    const handler = (meta: KeyMetaState) => setKeysMeta(meta);
    socket.on('keys:update', handler);
    return () => {
      socket.off('keys:update', handler);
    };
  }, [refreshMeta]);

  // Listen for real-time lockdown state updates
  useEffect(() => {
    const socket = getRootSocket();
    if (!socket) return;

    const handleLockdownState = (state: LockdownState) => {
      console.log('[Settings] Received lockdown state update:', state);
      updateLockdownState(state);
      setSettings(readSettings());
    };

    socket.on('lockdown:state', handleLockdownState);

    return () => {
      socket.off('lockdown:state', handleLockdownState);
    };
  }, []);

  function bind<K extends keyof AppSettings['jarvis']>(key: K) {
    return {
      value: settings?.jarvis[key] ?? '',
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        updateJarvisSettings({ [key]: event.target.value } as any);
        setSettings(readSettings());
      }
    };
  }

  function modelValue<K extends keyof AppSettings['models']>(key: K) {
    return (settings?.models as any)?.[key];
  }

  function updateModel<K extends keyof AppSettings['models']>(key: K, value: AppSettings['models'][K]) {
    updateModelSettings({ [key]: value } as any);
    setSettings(readSettings());
  }

  function textChat() {
    return settings?.textChat ?? (readSettings().textChat as TextChatSettings);
  }

  function updateTextChat<K extends keyof TextChatSettings>(key: K, value: TextChatSettings[K]) {
    updateTextChatSettings({ [key]: value });
    setSettings(readSettings());
  }

  async function saveKey(name: KeyName) {
    const value = pendingKeys[name].trim();
    if (!value) {
      setFeedback((prev) => ({ ...prev, [name]: { type: 'error', message: 'Enter a key before saving.' } }));
      return;
    }

    setSavingKeys((prev) => ({ ...prev, [name]: true }));
    setFeedback((prev) => ({ ...prev, [name]: undefined }));

    try {
      const response = await apiFetch(buildServerUrl('/admin/keys'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [name]: value })
      });
      let payload: any = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.error || 'Failed to save key';
        throw new Error(message);
      }

      if (payload?.meta) {
        setKeysMeta(payload.meta as KeyMetaState);
      } else {
        void refreshMeta();
      }
      setPendingKeys((prev) => ({ ...prev, [name]: '' }));
      setFeedback((prev) => ({ ...prev, [name]: { type: 'success', message: 'Key saved.' } }));
    } catch (error) {
      const csrfMsg = error instanceof CsrfError ? 'Your session has expired. Please refresh the page and try again.' : null;
      setFeedback((prev) => ({
        ...prev,
        [name]: {
          type: 'error',
          message: csrfMsg || (error instanceof Error ? error.message : 'Failed to save key')
        }
      }));
    } finally {
      setSavingKeys((prev) => ({ ...prev, [name]: false }));
    }
  }

  async function removeKey(name: KeyName) {
    setSavingKeys((prev) => ({ ...prev, [name]: true }));
    setFeedback((prev) => ({ ...prev, [name]: undefined }));
    try {
      const response = await apiFetch(buildServerUrl(`/admin/keys/${name}`), { method: 'DELETE' });
      let payload: any = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.error || 'Failed to delete key';
        throw new Error(message);
      }

      if (payload?.meta) {
        setKeysMeta(payload.meta as KeyMetaState);
      } else {
        void refreshMeta();
      }
      setPendingKeys((prev) => ({ ...prev, [name]: '' }));
      setFeedback((prev) => ({ ...prev, [name]: { type: 'success', message: 'Key removed.' } }));
    } catch (error) {
      const csrfMsg = error instanceof CsrfError ? 'Your session has expired. Please refresh the page and try again.' : null;
      setFeedback((prev) => ({
        ...prev,
        [name]: {
          type: 'error',
          message: csrfMsg || (error instanceof Error ? error.message : 'Failed to delete key')
        }
      }));
    } finally {
      setSavingKeys((prev) => ({ ...prev, [name]: false }));
    }
  }

  // Bambu Labs login handler
  const handleBambuLogin = async () => {
    if (!bambuEmail || !bambuPassword) return;
    setIsLoggingIn(true);
    setBambuAuthStatus('');
    setBambuAuthMessage('');
    setShowVerifyForm(false);

    try {
      const res = await apiFetch(buildServerUrl('/api/3dprint/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: bambuEmail, 
          password: bambuPassword
        })
      });
      const data = await res.json();

      if (res.ok) {
        setBambuAuthStatus('success');
        setBambuAuthMessage('Logged in successfully');
        setBambuPassword('');
      } else if (res.status === 401 && data.error === 'Verification code required') {
        setBambuAuthStatus('');
        setBambuAuthMessage('Verification code sent to your email. Check your inbox.');
        setShowVerifyForm(true);
      } else {
        setBambuAuthStatus('error');
        setBambuAuthMessage(data.error || 'Login failed');
      }
    } catch (err) {
      const csrfMsg = err instanceof CsrfError ? 'Your session has expired. Please refresh the page and try again.' : null;
      setBambuAuthStatus('error');
      setBambuAuthMessage(csrfMsg || (err instanceof Error ? err.message : 'Login error'));
    }
    setIsLoggingIn(false);
  };

  // Bambu Labs verification handler
  const handleVerifyCode = async () => {
    if (!bambuCode) return;
    setIsVerifyingCode(true);
    setBambuAuthStatus('');
    setBambuAuthMessage('');

    try {
      const res = await apiFetch(buildServerUrl('/api/3dprint/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: bambuEmail, code: bambuCode })
      });
      const data = await res.json();

      if (res.ok) {
        setBambuAuthStatus('success');
        setBambuAuthMessage('Verification successful');
        setShowVerifyForm(false);
        setBambuCode('');
        setBambuPassword('');
      } else {
        setBambuAuthStatus('error');
        setBambuAuthMessage(data.error || 'Verification failed');
      }
    } catch (err) {
      const csrfMsg = err instanceof CsrfError ? 'Your session has expired. Please refresh the page and try again.' : null;
      setBambuAuthStatus('error');
      setBambuAuthMessage(csrfMsg || (err instanceof Error ? err.message : 'Verification error'));
    }
    setIsVerifyingCode(false);
  };

  // Camera management handlers
  const handleAddCamera = () => {
    const newCameraId = `camera_${Date.now()}`;
    const newCamera: CameraSettings = {
      cameraId: newCameraId,
      enabled: true,
      friendlyName: `Camera ${(settings?.cameras?.length ?? 0) + 1}`,
      motionDetection: {
        enabled: false,
        sensitivity: 50,
        cooldownSeconds: 30
      },
      motionZones: []
    };
    
    const cameras = settings?.cameras ?? [];
    updateCameras([...cameras, newCamera]);
    setSettings(readSettings());
  };
  
  const handleDeleteCamera = (cameraId: string) => {
    const cameras = settings?.cameras ?? [];
    updateCameras(cameras.filter(c => c.cameraId !== cameraId));
    setSettings(readSettings());
  };
  
  const handleToggleLockdown = async () => {
    const lockdownState = settings?.lockdownState;
    if (!lockdownState) return;
    
    try {
      // Call backend API to toggle lockdown
      const endpoint = lockdownState.active ? '/api/lockdown/deactivate' : '/api/lockdown/activate';
      const response = await fetch(buildServerUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activatedBy: 'manual' })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Settings] Failed to toggle lockdown:', error);
        alert(`Failed to ${lockdownState.active ? 'deactivate' : 'activate'} lockdown: ${error.error || 'Unknown error'}`);
        return;
      }

      const result = await response.json();
      console.log('[Settings] Lockdown toggled successfully:', result);

      // State will be updated via Socket.io listener
      // But also update immediately for responsive UI
      if (result.state) {
        updateLockdownState(result.state);
        setSettings(readSettings());
      }

      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        console.warn('[Settings] Lockdown warnings:', result.warnings);
      }
    } catch (error) {
      console.error('[Settings] Error toggling lockdown:', error);
      alert(`Failed to toggle lockdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Smart Home integration test handlers
  const handleTestSmartHome = async (integration: 'alexa' | 'irobot' | 'nest' | 'smartLights') => {
    setSmarthomeTestResults(prev => ({ ...prev, [integration]: undefined }));
    
    try {
      // Get the integration config from settings
      const integrationConfig = settings?.integrations?.[integration];
      if (!integrationConfig) {
        setSmarthomeTestResults(prev => ({
          ...prev,
          [integration]: { type: 'error', message: 'Integration not configured' }
        }));
        return;
      }
      
      let result;
      switch (integration) {
        case 'alexa':
          result = await testAlexaIntegration(integrationConfig as any);
          break;
        case 'irobot':
          result = await testIRobotIntegration(integrationConfig as any);
          break;
        case 'nest':
          result = await testNestIntegration(integrationConfig as any);
          break;
        case 'smartLights':
          result = await testSmartLightsIntegration(integrationConfig as any);
          break;
      }
      
      if (result.success) {
        setSmarthomeTestResults(prev => ({
          ...prev,
          [integration]: { type: 'success', message: result.message }
        }));
      } else {
        setSmarthomeTestResults(prev => ({
          ...prev,
          [integration]: { type: 'error', message: result.message }
        }));
      }
    } catch (error) {
      setSmarthomeTestResults(prev => ({
        ...prev,
        [integration]: {
          type: 'error',
          message: error instanceof Error ? error.message : 'Test failed'
        }
      }));
    }
  };

  function keyStatusLabel(name: KeyName) {
    const present = keysMeta?.[name]?.present;
    if (present === undefined) {
      return <span className="text-xs text-white/50">Checking…</span>;
    }
    if (present) {
      return <span className="text-xs text-emerald-400">Stored</span>;
    }
    return <span className="text-xs text-amber-400">Not set</span>;
  }

  function renderKeyRow(name: KeyName, label: string, description: string) {
    const present = keysMeta?.[name]?.present;
    const isSaving = savingKeys[name];
    const message = feedback[name];
    return (
      <div key={name} className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-white/70">{label}</div>
            <p className="text-xs text-white/40">{description}</p>
          </div>
          <div>{keyStatusLabel(name)}</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="password"
            className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
            value={pendingKeys[name]}
            onChange={(event) => {
              const { value } = event.target;
              setPendingKeys((prev) => ({ ...prev, [name]: value }));
            }}
            placeholder={name === 'openai' ? 'sk-...' : 'mesh_...'}
          />
          <div className="flex gap-2">
            <button className="btn" type="button" onClick={() => saveKey(name)} disabled={isSaving}>
              {isSaving ? 'Saving…' : present ? 'Replace' : 'Save'}
            </button>
            {present ? (
              <button className="btn btn-secondary" type="button" onClick={() => removeKey(name)} disabled={isSaving}>
                {isSaving ? 'Working…' : 'Remove'}
              </button>
            ) : null}
          </div>
        </div>
        {message ? (
          <p className={`text-xs ${message.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{message.message}</p>
        ) : null}
      </div>
    );
  }

  // Fetch server build info for drift detection
  const [serverBuild, setServerBuild] = useState<{ git_sha: string; build_time: string } | null>(null);
  useEffect(() => {
    fetch('/api/health/build')
      .then(res => res.ok ? res.json() : null)
      .then(data => data && setServerBuild(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!settings || typeof window === 'undefined') return;
    if (window.location.hash === '#provider-keys') {
      const target = document.getElementById('provider-keys');
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }, [settings]);

  if (!settings) return null;

  const chat = textChat();

  // Build info for drift detection
  const clientSha = process.env.NEXT_PUBLIC_GIT_SHA || 'unknown';
  const serverSha = serverBuild?.git_sha || 'loading...';
  const hasDrift = serverBuild && clientSha !== 'unknown' && serverSha !== clientSha;

  return (
    <div className="space-y-8">
      {/* Settings Header with Build Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/40">Server:</span>
            <code className={`font-mono px-2 py-0.5 rounded ${hasDrift ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-cyan-400'}`}
                  data-testid="server-build-sha">
              {serverSha}
            </code>
          </div>
          <a href="/api/health/build" target="_blank" rel="noopener noreferrer"
             className="text-white/30 hover:text-white/60 underline"
             title="View full build info">
            Build Info
          </a>
        </div>
      </div>

      {/* Drift Warning Banner */}
      {hasDrift && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">Build Drift Detected</span>
          </div>
          <p className="text-sm text-white/60">
            Your browser loaded client code from <code className="text-cyan-400">{clientSha}</code> but the server is running <code className="text-cyan-400">{serverSha}</code>.
            This may indicate stale cache or wrong host. Try hard-refreshing (Ctrl+Shift+R) or check your DNS.
            {' '}
            <a 
              href="https://github.com/akior-os/jarvis-v5-os/blob/main/docs/ops/dns-setup.md" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-400 underline hover:text-amber-300"
            >
              DNS Setup Guide
            </a>
          </p>
        </div>
      )}

      {/* Setup Wizard Link */}
      <section className="card p-6 space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Setup Wizard</div>
            <div className="text-white/60 text-sm">Configure LLM providers, HTTPS certificates, and API keys</div>
          </div>
          <a 
            href="/setup" 
            className="btn btn-secondary flex items-center gap-2"
            data-testid="setup-wizard-link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Open Wizard
          </a>
        </header>
        <p className="text-xs text-white/40">
          Revisit the Setup Wizard to change your LLM provider configuration, update API keys, or re-verify HTTPS certificates.
          Owner PIN authentication is required.
        </p>
      </section>

      {/* HTTPS Trust Card */}
      <section className="card p-6 space-y-4" data-testid="https-trust-card">
        <header>
          <div className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            HTTPS Trust
          </div>
          <div className="text-white/60 text-sm">Manage HTTPS certificate trust for LAN devices</div>
        </header>

        {httpsStatus ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                httpsStatus.caAvailable 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {httpsStatus.caAvailable ? '✓ CA Available' : '⚠ CA Not Found'}
              </span>
              <span className="text-white/50 text-xs">Mode: {httpsStatus.httpsMode}</span>
            </div>

            {httpsStatus.caFingerprint && (
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-xs text-white/50 mb-1">CA Fingerprint (SHA-256)</div>
                <code className="text-xs text-cyan-400 font-mono break-all" data-testid="ca-fingerprint">
                  {httpsStatus.caFingerprint}
                </code>
              </div>
            )}

            {httpsStatus.caAvailable && (
              <button
                type="button"
                className="btn btn-secondary text-sm flex items-center gap-2"
                disabled={downloadingCert}
                data-testid="settings-download-cert-btn"
                onClick={async () => {
                  setDownloadingCert(true);
                  try {
                    const res = await fetch(buildServerUrl('/api/admin/https/ca'));
                    if (!res.ok) throw new Error('Failed to download');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'akior-ca.crt';
                    a.click();
                    URL.revokeObjectURL(url);
                  } finally {
                    setDownloadingCert(false);
                  }
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {downloadingCert ? 'Downloading...' : 'Download CA Certificate'}
              </button>
            )}

            <p className="text-xs text-white/40">
              Install this certificate on other devices (phones, tablets, laptops) to trust AKIOR's HTTPS on your LAN.
              See the <a href="/setup" className="text-cyan-400 underline">Setup Wizard</a> for device-specific instructions.
            </p>
          </div>
        ) : (
          <div className="text-white/50 text-sm">Loading HTTPS status...</div>
        )}
      </section>

      {/* Remote Access Card */}
      <section className="card p-6 space-y-4" data-testid="remote-access-card">
        <header>
          <div className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            Remote Access
          </div>
          <div className="text-white/60 text-sm">Access AKIOR securely from outside your home network</div>
        </header>

        {remoteStatus ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                remoteStatus.enabled 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-white/10 text-white/50 border border-white/20'
              }`}>
                {remoteStatus.enabled ? '✓ Enabled' : '○ Disabled'}
              </span>
              <span className="text-white/50 text-xs capitalize">Mode: {remoteStatus.mode}</span>
            </div>

            {remoteStatus.enabled && remoteStatus.tailscaleStatus && (
              <div className="bg-white/5 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className={remoteStatus.tailscaleStatus.running ? 'text-emerald-400' : 'text-amber-400'}>
                    {remoteStatus.tailscaleStatus.running ? '● Tailscale running' : '○ Tailscale stopped'}
                  </span>
                </div>
                {remoteStatus.tailscaleStatus.hostname && (
                  <div className="text-xs">
                    <span className="text-white/50">Hostname: </span>
                    <code className="text-purple-400" data-testid="tailscale-hostname">
                      {remoteStatus.tailscaleStatus.hostname}
                    </code>
                  </div>
                )}
                {remoteStatus.tailscaleStatus.serveActive && (
                  <div className="text-xs text-emerald-400">
                    ✓ Tailscale Serve active on port {remoteStatus.servePort || 3000}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-white/40">
              Remote access uses <a href="https://tailscale.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline">Tailscale</a> to securely connect from anywhere.
              Configure in the <a href="/setup" className="text-cyan-400 underline">Setup Wizard</a>.
            </p>
          </div>
        ) : (
          <div className="text-white/50 text-sm">Loading remote access status...</div>
        )}
      </section>

      {/* Appearance / Theme Section */}
      <section className="card p-6 space-y-6">
        <header>
          <div className="text-lg font-semibold">Appearance</div>
          <div className="text-white/60 text-sm">Choose your interface theme for AKIOR</div>
        </header>
        
        {/* Light/Dark Mode */}
        <div>
          <div className="text-sm text-white/70 mb-3">Brightness Mode</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                theme === 'light'
                  ? 'bg-white text-slate-900 border-white shadow-lg'
                  : 'bg-transparent text-white/70 border-white/20 hover:border-white/40'
              }`}
            >
              ☀️ Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-white text-slate-900 border-white shadow-lg'
                  : 'bg-transparent text-white/70 border-white/20 hover:border-white/40'
              }`}
            >
              🌙 Dark
            </button>
          </div>
        </div>
        
        {/* Color Theme Selector */}
        <div>
          <div className="text-sm text-white/70 mb-3">Color Theme</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setColorTheme('cyber-blue')}
              className={`px-4 py-3 text-left rounded-lg border transition-all ${
                colorTheme === 'cyber-blue'
                  ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.2)] border-[color:rgb(var(--jarvis-accent)_/_0.6)] jarvis-accent-shadow'
                  : 'bg-transparent border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <div>
                  <div className="text-sm font-medium">Cyber Blue</div>
                  <div className="text-xs text-white/50">Classic futuristic blue</div>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setColorTheme('midnight-purple')}
              className={`px-4 py-3 text-left rounded-lg border transition-all ${
                colorTheme === 'midnight-purple'
                  ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.2)] border-[color:rgb(var(--jarvis-accent)_/_0.6)] jarvis-accent-shadow'
                  : 'bg-transparent border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-purple-600"></div>
                <div>
                  <div className="text-sm font-medium">Midnight Purple</div>
                  <div className="text-xs text-white/50">Deep space purple vibes</div>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setColorTheme('solar-flare')}
              className={`px-4 py-3 text-left rounded-lg border transition-all ${
                colorTheme === 'solar-flare'
                  ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.2)] border-[color:rgb(var(--jarvis-accent)_/_0.6)] jarvis-accent-shadow'
                  : 'bg-transparent border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <div>
                  <div className="text-sm font-medium">Solar Flare</div>
                  <div className="text-xs text-white/50">Warm orange energy</div>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setColorTheme('digital-rain')}
              className={`px-4 py-3 text-left rounded-lg border transition-all ${
                colorTheme === 'digital-rain'
                  ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.2)] border-[color:rgb(var(--jarvis-accent)_/_0.6)] jarvis-accent-shadow'
                  : 'bg-transparent border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <div>
                  <div className="text-sm font-medium">Digital Rain</div>
                  <div className="text-xs text-white/50">Hacker green matrix style</div>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setColorTheme('ice-crystal')}
              className={`px-4 py-3 text-left rounded-lg border transition-all ${
                colorTheme === 'ice-crystal'
                  ? 'bg-[color:rgb(var(--jarvis-accent)_/_0.2)] border-[color:rgb(var(--jarvis-accent)_/_0.6)] jarvis-accent-shadow'
                  : 'bg-transparent border-white/10 hover:border-white/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-cyan-500"></div>
                <div>
                  <div className="text-sm font-medium">Ice Crystal</div>
                  <div className="text-xs text-white/50">Cool cyan frost</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>

      <section id="provider-keys" className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Voice Assistant</div>
            <div className="text-white/60 text-sm">AKIOR realtime voice settings</div>
          </div>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <div className="text-sm text-white/70">Initial prompt</div>
            <textarea
              className="w-full h-24 bg-transparent border border-white/10 rounded-xl px-3 py-2"
              {...bind('initialPrompt')}
              placeholder="You are AKIOR…"
            />
          </label>
          <div className="md:col-span-2 rounded-xl border border-white/10 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-white/70">OpenAI API key</div>
                <p className="text-xs text-white/40">
                  Managed on the server. Update it from the Provider keys section below.
                </p>
              </div>
              {keyStatusLabel('openai')}
            </div>
          </div>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Realtime model</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={settings.jarvis.model}
              onChange={(event) => {
                updateJarvisSettings({ model: event.target.value });
                setSettings(readSettings());
              }}
            >
              <option className="bg-[#0b0f14]" value="gpt-realtime-mini">
                gpt-realtime-mini (Cost-efficient realtime)
              </option>
              <option className="bg-[#0b0f14]" value="gpt-realtime">
                gpt-realtime (Realtime text and audio)
              </option>
              <option className="bg-[#0b0f14]" value="gpt-audio-mini">
                gpt-audio-mini (Cost-efficient audio)
              </option>
              <option className="bg-[#0b0f14]" value="gpt-audio">
                gpt-audio (Audio inputs and outputs)
              </option>
            </select>
            <p className="text-xs text-white/40">
              Choose the realtime model for voice conversations. Mini models are more cost-effective.
            </p>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Voice</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={settings.jarvis.voice}
              onChange={(event) => {
                updateJarvisSettings({ voice: event.target.value });
                setSettings(readSettings());
              }}
            >
              <option className="bg-[#0b0f14]" value="alloy">
                alloy
              </option>
              <option className="bg-[#0b0f14]" value="ash">
                ash
              </option>
              <option className="bg-[#0b0f14]" value="ballad">
                ballad
              </option>
              <option className="bg-[#0b0f14]" value="coral">
                coral
              </option>
              <option className="bg-[#0b0f14]" value="echo">
                echo
              </option>
              <option className="bg-[#0b0f14]" value="fable">
                fable
              </option>
              <option className="bg-[#0b0f14]" value="onyx">
                onyx
              </option>
              <option className="bg-[#0b0f14]" value="nova">
                nova
              </option>
              <option className="bg-[#0b0f14]" value="sage">
                sage
              </option>
              <option className="bg-[#0b0f14]" value="shimmer">
                shimmer
              </option>
              <option className="bg-[#0b0f14]" value="verse">
                verse
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Image detail level</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={settings.jarvis.imageDetail || 'low'}
              onChange={(event) => {
                updateJarvisSettings({ imageDetail: event.target.value as 'low' | 'high' | 'auto' });
                setSettings(readSettings());
              }}
            >
              <option className="bg-[#0b0f14]" value="low">
                Low (85 tokens - Fast & saves tokens)
              </option>
              <option className="bg-[#0b0f14]" value="auto">
                Auto (Let model decide)
              </option>
              <option className="bg-[#0b0f14]" value="high">
                High (Up to 1536 tokens - More detail)
              </option>
            </select>
            <p className="text-xs text-white/40">
              Set image processing detail for camera vision. "Low" uses only 85 tokens per image, significantly reducing rate limits.
            </p>
          </label>
          <label className="space-y-2 md:col-span-2">
            <div className="text-sm text-white/70">Initial prompt / System instructions</div>
            <textarea
              className="w-full h-32 bg-transparent border border-white/10 rounded-xl px-3 py-2 text-sm"
              {...bind('initialPrompt')}
              placeholder="You are AKIOR, a sophisticated AI assistant..."
            />
            <p className="text-xs text-white/40">
              Define AKIOR's personality, tone, and behavior. This is sent at the start of each session.
            </p>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Trigger word (hotword)</div>
            <input
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              {...bind('hotword')}
              placeholder="akior"
            />
            <p className="text-xs text-white/40">
              Say "Hey &lt;trigger&gt;" to start a session. Example: "Hey akior".
            </p>
          </label>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <header className="flex flex-col gap-1">
          <div className="text-lg font-semibold">Text chat</div>
          <div className="text-white/60 text-sm">
            Configure GPT-5 responses for the /chat text assistant
          </div>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <div className="text-sm text-white/70">Initial prompt</div>
            <textarea
              className="w-full h-28 bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={chat.initialPrompt ?? ''}
              onChange={(event) => updateTextChat('initialPrompt', event.target.value)}
              placeholder="You are a thoughtful GPT-5 assistant…"
            />
            <p className="text-xs text-white/40">
              Sent as a developer message before the first user message to steer tone and behavior.
            </p>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Model</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={chat.model ?? 'gpt-5'}
              onChange={(event) => updateTextChat('model', event.target.value)}
            >
              <option className="bg-[#0b0f14]" value="gpt-5">
                gpt-5 (best for rich reasoning)
              </option>
              <option className="bg-[#0b0f14]" value="gpt-5-mini">
                gpt-5-mini (faster, lower cost)
              </option>
              <option className="bg-[#0b0f14]" value="gpt-5-nano">
                gpt-5-nano (fastest, light tasks)
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Reasoning effort</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={chat.reasoningEffort ?? 'low'}
              onChange={(event) =>
                updateTextChat('reasoningEffort', event.target.value as TextChatSettings['reasoningEffort'])
              }
            >
              <option className="bg-[#0b0f14]" value="minimal">
                Minimal — fastest replies
              </option>
              <option className="bg-[#0b0f14]" value="low">
                Low — balanced speed and depth
              </option>
              <option className="bg-[#0b0f14]" value="medium">
                Medium — deeper reasoning
              </option>
              <option className="bg-[#0b0f14]" value="high">
                High — most thorough, higher latency
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Verbosity</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={chat.verbosity ?? 'medium'}
              onChange={(event) =>
                updateTextChat('verbosity', event.target.value as TextChatSettings['verbosity'])
              }
            >
              <option className="bg-[#0b0f14]" value="low">
                Low — concise replies
              </option>
              <option className="bg-[#0b0f14]" value="medium">
                Medium — balanced detail
              </option>
              <option className="bg-[#0b0f14]" value="high">
                High — most detailed responses
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Max output tokens</div>
            <input
              type="number"
              min={100}
              max={4000}
              step={50}
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={chat.maxOutputTokens ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  updateTextChat('maxOutputTokens', undefined);
                  return;
                }
                const next = Number(value);
                if (Number.isNaN(next)) {
                  return;
                }
                const clamped = Math.min(4000, Math.max(100, next));
                updateTextChat('maxOutputTokens', clamped);
              }}
              placeholder="800"
            />
            <p className="text-xs text-white/40">
              Controls response length. GPT-5 ignores values above 4k tokens.
            </p>
          </label>
          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={!!chat.useWebSearch}
              onChange={(event) => updateTextChat('useWebSearch', event.target.checked)}
            />
            <div>
              <div className="text-sm text-white/70">Allow web search for answers</div>
              <p className="text-xs text-white/40 mt-1">
                When enabled, searches the web to provide up-to-date information. Requires Web Search integration.
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={!!chat.useLocalLlm}
              onChange={(event) => updateTextChat('useLocalLlm', event.target.checked)}
            />
            <div>
              <div className="text-sm text-white/70">Use Local LLM when available</div>
              <p className="text-xs text-white/40 mt-1">
                When enabled and Local LLM is connected, AKIOR will use the local model for text chat (with optional web search augmentation).
              </p>
            </div>
          </label>
          {chat.useLocalLlm && (
            <div className="md:col-span-2 pl-8 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="llm-priority"
                  checked={!!chat.localLlmPrimary}
                  onChange={() => updateTextChat('localLlmPrimary', true)}
                />
                <span className="text-white/70">Local LLM as primary, cloud as fallback</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="llm-priority"
                  checked={!chat.localLlmPrimary}
                  onChange={() => updateTextChat('localLlmPrimary', false)}
                />
                <span className="text-white/70">Cloud as primary, local as fallback</span>
              </label>
            </div>
          )}
          <label className="space-y-2 md:col-span-2">
            <div className="text-sm text-white/70">Text-to-speech provider</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={chat.ttsProvider ?? 'elevenlabs'}
              onChange={(event) => updateTextChat('ttsProvider', event.target.value as any)}
            >
              <option className="bg-[#0b0f14]" value="none">
                None — no TTS button
              </option>
              <option className="bg-[#0b0f14]" value="elevenlabs">
                ElevenLabs
              </option>
              <option className="bg-[#0b0f14]" value="azure">
                Azure TTS
              </option>
            </select>
            <p className="text-xs text-white/40">
              Choose which TTS service to use for "Speak answer" in Chat. Provider must be configured in Integrations.
            </p>
          </label>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <header>
          <div className="text-lg font-semibold">Provider keys</div>
          <div className="text-white/60 text-sm">Manage API credentials stored on the server</div>
        </header>
        <div className="space-y-6">
{renderKeyRow('openai', 'OpenAI API key', 'Used for AKIOR realtime voice sessions.')}
          {renderKeyRow('meshy', 'Meshy API key', 'Required for Meshy 3D model generation.')}
        </div>
        <p className="text-xs text-white/40">
          Keys are saved on the server and never sent back to browsers. Entering a new value replaces the stored key.
        </p>
      </section>

      <section className="card p-6 space-y-4">
        <header>
          <div className="text-lg font-semibold">3D Model</div>
          <div className="text-white/60 text-sm">Meshy.ai integration</div>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <div className="text-sm text-white/70">Default Meshy model</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={(modelValue('aiModel') as string) ?? 'latest'}
              onChange={(event) => updateModel('aiModel', event.target.value)}
            >
              <option className="bg-[#0b0f14]" value="latest">
                Meshy 6 Preview (latest)
              </option>
              <option className="bg-[#0b0f14]" value="meshy-5">
                Meshy 5
              </option>
              <option className="bg-[#0b0f14]" value="meshy-4">
                Meshy 4
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Topology</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={(modelValue('topology') as string) ?? 'triangle'}
              onChange={(event) => updateModel('topology', event.target.value as any)}
            >
              <option className="bg-[#0b0f14]" value="triangle">
                Triangle mesh
              </option>
              <option className="bg-[#0b0f14]" value="quad">
                Quad-dominant mesh
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Target polycount</div>
            <input
              type="number"
              min={100}
              max={300000}
              step={100}
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={modelValue('targetPolycount') ?? 30000}
              onChange={(event) =>
                updateModel(
                  'targetPolycount',
                  event.target.value === '' ? undefined : Number(event.target.value)
                )
              }
            />
            <p className="text-xs text-white/40">Adjust per plan limits. Default 30k polygons.</p>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Symmetry mode</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={(modelValue('symmetryMode') as string) ?? 'auto'}
              onChange={(event) => updateModel('symmetryMode', event.target.value as any)}
            >
              <option className="bg-[#0b0f14]" value="auto">
                Auto
              </option>
              <option className="bg-[#0b0f14]" value="off">
                Off
              </option>
              <option className="bg-[#0b0f14]" value="on">
                On
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Preferred art style (Text to 3D)</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={(modelValue('artStyle') as string) ?? 'realistic'}
              onChange={(event) => updateModel('artStyle', event.target.value as any)}
            >
              <option className="bg-[#0b0f14]" value="realistic">
                Realistic
              </option>
              <option className="bg-[#0b0f14]" value="sculpture">
                Sculpture
              </option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Output format</div>
            <select
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              value={(modelValue('outputFormat') as string) ?? 'glb'}
              onChange={(event) => updateModel('outputFormat', event.target.value as any)}
            >
              <option className="bg-[#0b0f14]" value="glb">
                GLB (Binary GLTF)
              </option>
              <option className="bg-[#0b0f14]" value="obj">
                OBJ (Wavefront)
              </option>
              <option className="bg-[#0b0f14]" value="usdz">
                USDZ (Universal Scene)
              </option>
            </select>
            <p className="text-xs text-white/40">Only this format will be downloaded. Export STL from viewer.</p>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={modelValue('shouldRemesh') !== false}
              onChange={(event) => updateModel('shouldRemesh', event.target.checked)}
            />
            Enable remesh
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={modelValue('shouldTexture') !== false}
              onChange={(event) => updateModel('shouldTexture', event.target.checked)}
            />
            Generate textures
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={modelValue('enablePbr') === true}
              onChange={(event) => updateModel('enablePbr', event.target.checked)}
            />
            Enable PBR maps
          </label>
        </div>
        <p className="text-xs text-white/40">
          These defaults are applied to Capture, Upload, and Text prompt workflows. You can override them per
          task from the creation page.
        </p>
      </section>

      <section className="card p-6 space-y-3">
        <div className="text-lg font-semibold">Integration</div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={!!settings.useServerProxy}
            onChange={(event) => {
              updateSettings({ useServerProxy: event.target.checked });
              setSettings(readSettings());
            }}
          />
          Use server proxy for provider calls (server owns keys)
        </label>
      </section>

      <section className="card p-6 space-y-4">
        <header className="flex flex-col gap-1">
          <div className="text-lg font-semibold">Bambu Labs Account</div>
          <div className="text-white/60 text-sm">
            Login with your Bambu Labs credentials to monitor and control your 3D printers
          </div>
        </header>
        
        {!showVerifyForm ? (
          <div className="space-y-4">
            <label className="space-y-2">
              <div className="text-sm text-white/70">Email</div>
              <input
                type="email"
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
                value={bambuEmail}
                onChange={(e) => setBambuEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={bambuAuthStatus === 'success'}
              />
            </label>
            <label className="space-y-2">
              <div className="text-sm text-white/70">Password</div>
              <input
                type="password"
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
                value={bambuPassword}
                onChange={(e) => setBambuPassword(e.target.value)}
                placeholder="Password"
                disabled={bambuAuthStatus === 'success'}
              />
              <p className="text-xs text-white/40">
                Enter your Bambu Labs account password. You'll receive a verification code via email if needed.
              </p>
            </label>
            {bambuAuthStatus !== 'success' && (
              <button
                onClick={handleBambuLogin}
                disabled={!bambuEmail || !bambuPassword || isLoggingIn}
                className="btn"
                type="button"
              >
                {isLoggingIn ? 'Logging in...' : 'Login'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <label className="space-y-2">
              <div className="text-sm text-white/70">Verification Code</div>
              <input
                type="text"
                className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
                value={bambuCode}
                onChange={(e) => setBambuCode(e.target.value)}
                placeholder="123456"
              />
              <p className="text-xs text-white/40">Enter the code sent to {bambuEmail}</p>
            </label>
            <button
              onClick={handleVerifyCode}
              disabled={!bambuCode || isVerifyingCode}
              className="btn"
              type="button"
            >
              {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
            </button>
          </div>
        )}

        {bambuAuthMessage && (
          <div
            className={`text-sm px-3 py-2 rounded-lg ${
              bambuAuthStatus === 'success'
                ? 'bg-emerald-500/10 text-emerald-400'
                : bambuAuthStatus === 'error'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-blue-500/10 text-blue-400'
            }`}
          >
            {bambuAuthMessage}
          </div>
        )}

        {bambuAuthStatus === 'success' && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Connected - Your printers are available in the 3D Printers dashboard</span>
          </div>
        )}
      </section>

      {/* Integrations Cockpit */}
      <section className="card p-6 space-y-6">
        <header>
          <div className="text-lg font-semibold">Integrations</div>
          <div className="text-white/60 text-sm">Manage external services and providers</div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Weather Card - temporarily removed, will rebuild later */}

          {/* Web Search Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('webSearch', settings?.integrations?.webSearch)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.webSearch.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.webSearch.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('webSearch', settings?.integrations?.webSearch)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('webSearch', settings?.integrations?.webSearch) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.webSearch?.enabled}
                onChange={(e) => { updateIntegration('webSearch', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.webSearch?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Base URL</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.webSearch?.baseUrl ?? ''}
                    onChange={(e) => { updateIntegration('webSearch', { baseUrl: e.target.value }); setSettings(readSettings()); }}
                    placeholder="https://api.tavily.com" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">API Key</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.webSearch?.apiKey ?? ''}
                    onChange={(e) => { updateIntegration('webSearch', { apiKey: e.target.value }); setSettings(readSettings()); }}
                    placeholder="tvly-..." />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Region (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.webSearch?.defaultRegion ?? ''}
                    onChange={(e) => { updateIntegration('webSearch', { defaultRegion: e.target.value }); setSettings(readSettings()); }}
                    placeholder="us" />
                </label>
              </div>
            )}
          </div>

          {/* Local LLM Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('localLLM', settings?.integrations?.localLLM)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.localLLM.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.localLLM.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('localLLM', settings?.integrations?.localLLM)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('localLLM', settings?.integrations?.localLLM) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.localLLM?.enabled}
                onChange={(e) => { updateIntegration('localLLM', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.localLLM?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Provider</div>
                  <select className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.localLLM?.provider ?? 'ollama'}
                    onChange={(e) => { updateIntegration('localLLM', { provider: e.target.value as 'ollama' | 'custom-http' }); setSettings(readSettings()); }}>
                    <option className="bg-[#0b0f14]" value="ollama">Ollama (local HTTP)</option>
                    <option className="bg-[#0b0f14]" value="custom-http">Custom HTTP API</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Base URL</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.localLLM?.baseUrl ?? ''}
                    onChange={(e) => { updateIntegration('localLLM', { baseUrl: e.target.value }); setSettings(readSettings()); }}
                    placeholder="http://127.0.0.1:11434" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Model</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.localLLM?.model ?? ''}
                    onChange={(e) => { updateIntegration('localLLM', { model: e.target.value }); setSettings(readSettings()); }}
                    placeholder="llama3.1" />
                </label>
                {settings?.integrations?.localLLM?.provider === 'custom-http' && (
                  <label className="space-y-1">
                    <div className="text-xs text-white/60">API Key (optional)</div>
                    <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                      value={settings?.integrations?.localLLM?.apiKey ?? ''}
                      onChange={(e) => { updateIntegration('localLLM', { apiKey: e.target.value }); setSettings(readSettings()); }}
                      placeholder="API key for custom HTTP" />
                  </label>
                )}
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Temperature (0-1)</div>
                  <input type="number" min="0" max="1" step="0.1" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.localLLM?.temperature ?? 0.7}
                    onChange={(e) => { updateIntegration('localLLM', { temperature: parseFloat(e.target.value) || 0.7 }); setSettings(readSettings()); }}
                    placeholder="0.7" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Max Tokens (optional)</div>
                  <input type="number" min="1" step="1" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.localLLM?.maxTokens ?? ''}
                    onChange={(e) => { updateIntegration('localLLM', { maxTokens: e.target.value ? parseInt(e.target.value) : null }); setSettings(readSettings()); }}
                    placeholder="Leave empty for model default" />
                </label>
              </div>
            )}
          </div>

          {/* ElevenLabs Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('elevenLabs', settings?.integrations?.elevenLabs)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.elevenLabs.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.elevenLabs.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('elevenLabs', settings?.integrations?.elevenLabs)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('elevenLabs', settings?.integrations?.elevenLabs) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.elevenLabs?.enabled}
                onChange={(e) => { updateIntegration('elevenLabs', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.elevenLabs?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">API Key</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.elevenLabs?.apiKey ?? ''}
                    onChange={(e) => { updateIntegration('elevenLabs', { apiKey: e.target.value }); setSettings(readSettings()); }}
                    placeholder="eleven-..." />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Voice ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.elevenLabs?.voiceId ?? ''}
                    onChange={(e) => { updateIntegration('elevenLabs', { voiceId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-voice-id" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Model ID (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.elevenLabs?.modelId ?? ''}
                    onChange={(e) => { updateIntegration('elevenLabs', { modelId: e.target.value || null }); setSettings(readSettings()); }}
                    placeholder="eleven_multilingual_v2" />
                  <div className="text-xs text-white/40">Default: eleven_multilingual_v2</div>
                </label>
                <details className="space-y-3">
                  <summary className="text-xs text-white/60 cursor-pointer">Advanced Settings</summary>
                  <div className="space-y-3 pt-2">
                    <label className="space-y-1">
                      <div className="text-xs text-white/60">Stability (0-1)</div>
                      <input type="number" min="0" max="1" step="0.1" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                        value={settings?.integrations?.elevenLabs?.stability ?? ''}
                        onChange={(e) => { updateIntegration('elevenLabs', { stability: e.target.value ? parseFloat(e.target.value) : null }); setSettings(readSettings()); }}
                        placeholder="0.5" />
                      <div className="text-xs text-white/40">Default: 0.5</div>
                    </label>
                    <label className="space-y-1">
                      <div className="text-xs text-white/60">Similarity Boost (0-1)</div>
                      <input type="number" min="0" max="1" step="0.1" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                        value={settings?.integrations?.elevenLabs?.similarityBoost ?? ''}
                        onChange={(e) => { updateIntegration('elevenLabs', { similarityBoost: e.target.value ? parseFloat(e.target.value) : null }); setSettings(readSettings()); }}
                        placeholder="0.75" />
                      <div className="text-xs text-white/40">Default: 0.75</div>
                    </label>
                    <label className="space-y-1">
                      <div className="text-xs text-white/60">Style (0-1)</div>
                      <input type="number" min="0" max="1" step="0.1" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                        value={settings?.integrations?.elevenLabs?.style ?? ''}
                        onChange={(e) => { updateIntegration('elevenLabs', { style: e.target.value ? parseFloat(e.target.value) : null }); setSettings(readSettings()); }}
                        placeholder="0.0" />
                      <div className="text-xs text-white/40">Default: 0.0 (only supported by some models)</div>
                    </label>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Azure TTS Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('azureTTS', settings?.integrations?.azureTTS)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.azureTTS.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.azureTTS.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('azureTTS', settings?.integrations?.azureTTS)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('azureTTS', settings?.integrations?.azureTTS) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.azureTTS?.enabled}
                onChange={(e) => { updateIntegration('azureTTS', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.azureTTS?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Region</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.azureTTS?.region ?? ''}
                    onChange={(e) => { updateIntegration('azureTTS', { region: e.target.value }); setSettings(readSettings()); }}
                    placeholder="eastus" />
                  <div className="text-xs text-white/40">e.g. eastus, westus, westeurope</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">API Key</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.azureTTS?.apiKey ?? ''}
                    onChange={(e) => { updateIntegration('azureTTS', { apiKey: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Voice Name</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.azureTTS?.voiceName ?? ''}
                    onChange={(e) => { updateIntegration('azureTTS', { voiceName: e.target.value }); setSettings(readSettings()); }}
                    placeholder="en-US-JennyNeural" />
                  <div className="text-xs text-white/40">Default: en-US-JennyNeural</div>
                </label>
                <details className="space-y-3">
                  <summary className="text-xs text-white/60 cursor-pointer">Advanced Settings</summary>
                  <div className="space-y-3 pt-2">
                    <label className="space-y-1">
                      <div className="text-xs text-white/60">Style (optional)</div>
                      <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                        value={settings?.integrations?.azureTTS?.style ?? ''}
                        onChange={(e) => { updateIntegration('azureTTS', { style: e.target.value || null }); setSettings(readSettings()); }}
                        placeholder="cheerful, sad, excited" />
                      <div className="text-xs text-white/40">For expressive voices only</div>
                    </label>
                    <label className="space-y-1">
                      <div className="text-xs text-white/60">Rate (optional)</div>
                      <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                        value={settings?.integrations?.azureTTS?.rate ?? ''}
                        onChange={(e) => { updateIntegration('azureTTS', { rate: e.target.value || null }); setSettings(readSettings()); }}
                        placeholder="+0%" />
                      <div className="text-xs text-white/40">e.g. -20%, +10%</div>
                    </label>
                    <label className="space-y-1">
                      <div className="text-xs text-white/60">Pitch (optional)</div>
                      <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                        value={settings?.integrations?.azureTTS?.pitch ?? ''}
                        onChange={(e) => { updateIntegration('azureTTS', { pitch: e.target.value || null }); setSettings(readSettings()); }}
                        placeholder="+0st" />
                      <div className="text-xs text-white/40">e.g. +2st, -1st (semitones)</div>
                    </label>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Spotify Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('spotify', settings?.integrations?.spotify)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.spotify.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.spotify.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('spotify', settings?.integrations?.spotify)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('spotify', settings?.integrations?.spotify) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.spotify?.enabled}
                onChange={(e) => { updateIntegration('spotify', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.spotify?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.spotify?.clientId ?? ''}
                    onChange={(e) => { updateIntegration('spotify', { clientId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-spotify-client-id" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client Secret</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.spotify?.clientSecret ?? ''}
                    onChange={(e) => { updateIntegration('spotify', { clientSecret: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Default Market (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.spotify?.defaultMarket ?? ''}
                    onChange={(e) => { updateIntegration('spotify', { defaultMarket: e.target.value || null }); setSettings(readSettings()); }}
                    placeholder="US" />
                  <div className="text-xs text-white/40">ISO 3166-1 alpha-2 country code (e.g. US, GB, DE)</div>
                </label>
              </div>
            )}
          </div>

          {/* Gmail Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('gmail', settings?.integrations?.gmail)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.gmail.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.gmail.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('gmail', settings?.integrations?.gmail)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('gmail', settings?.integrations?.gmail) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.gmail?.enabled}
                onChange={(e) => { updateIntegration('gmail', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.gmail?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.gmail?.clientId ?? ''}
                    onChange={(e) => { updateIntegration('gmail', { clientId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-google-client-id.apps.googleusercontent.com" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client Secret</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.gmail?.clientSecret ?? ''}
                    onChange={(e) => { updateIntegration('gmail', { clientSecret: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Redirect URI (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.gmail?.redirectUri ?? ''}
                    onChange={(e) => { updateIntegration('gmail', { redirectUri: e.target.value || null }); setSettings(readSettings()); }}
                    placeholder="http://localhost:3000/oauth/callback" />
                  <div className="text-xs text-white/40">Where Google redirects after OAuth consent</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">User Email</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.gmail?.userEmail ?? ''}
                    onChange={(e) => { updateIntegration('gmail', { userEmail: e.target.value }); setSettings(readSettings()); }}
                    placeholder="yourname@gmail.com" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Refresh Token</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.gmail?.refreshToken ?? ''}
                    onChange={(e) => { updateIntegration('gmail', { refreshToken: e.target.value }); setSettings(readSettings()); }}
                    placeholder="Paste refresh token from OAuth flow" />
                  <div className="text-xs text-white/40">Obtain via manual OAuth2 consent flow (see docs)</div>
                </label>
              </div>
            )}
          </div>

          {/* Google Calendar Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('googleCalendar', settings?.integrations?.googleCalendar)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.googleCalendar.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.googleCalendar.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('googleCalendar', settings?.integrations?.googleCalendar)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('googleCalendar', settings?.integrations?.googleCalendar) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.googleCalendar?.enabled}
                onChange={(e) => { updateIntegration('googleCalendar', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.googleCalendar?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.googleCalendar?.clientId ?? ''}
                    onChange={(e) => { updateIntegration('googleCalendar', { clientId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-google-client-id.apps.googleusercontent.com" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client Secret</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.googleCalendar?.clientSecret ?? ''}
                    onChange={(e) => { updateIntegration('googleCalendar', { clientSecret: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Redirect URI (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.googleCalendar?.redirectUri ?? ''}
                    onChange={(e) => { updateIntegration('googleCalendar', { redirectUri: e.target.value || null }); setSettings(readSettings()); }}
                    placeholder="http://localhost:3000/oauth/callback" />
                  <div className="text-xs text-white/40">Used during OAuth consent flow</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Calendar ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.googleCalendar?.calendarId ?? ''}
                    onChange={(e) => { updateIntegration('googleCalendar', { calendarId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="primary" />
                  <div className="text-xs text-white/40">Use 'primary' for your main calendar or a specific calendar ID</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Refresh Token</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.googleCalendar?.refreshToken ?? ''}
                    onChange={(e) => { updateIntegration('googleCalendar', { refreshToken: e.target.value }); setSettings(readSettings()); }}
                    placeholder="Paste refresh token from OAuth flow" />
                  <div className="text-xs text-white/40">Obtain via manual OAuth2 consent flow (see docs)</div>
                </label>
              </div>
            )}
          </div>

          {/* Amazon Alexa Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('alexa', settings?.integrations?.alexa)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.alexa.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.alexa.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('alexa', settings?.integrations?.alexa)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('alexa', settings?.integrations?.alexa) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.alexa?.enabled}
                onChange={(e) => { updateIntegration('alexa', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.alexa?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.alexa?.clientId ?? ''}
                    onChange={(e) => { updateIntegration('alexa', { clientId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="amzn1.application-client.xxx" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client Secret</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.alexa?.clientSecret ?? ''}
                    onChange={(e) => { updateIntegration('alexa', { clientSecret: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Refresh Token</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.alexa?.refreshToken ?? ''}
                    onChange={(e) => { updateIntegration('alexa', { refreshToken: e.target.value }); setSettings(readSettings()); }}
                    placeholder="Paste refresh token from OAuth flow" />
                  <div className="text-xs text-white/40">Obtain via Amazon's Login with Amazon OAuth flow</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Region</div>
                  <select className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.alexa?.region ?? 'us'}
                    onChange={(e) => { updateIntegration('alexa', { region: e.target.value }); setSettings(readSettings()); }}>
                    <option value="us">United States</option>
                    <option value="eu">Europe</option>
                    <option value="fe">Far East</option>
                  </select>
                  <div className="text-xs text-white/40">Select your Alexa device region</div>
                </label>
                <button
                  className="btn w-full"
                  onClick={() => handleTestSmartHome('alexa')}
                  disabled={!settings?.integrations?.alexa?.clientId || !settings?.integrations?.alexa?.clientSecret}
                >
                  Test Connection
                </button>
                {smarthomeTestResults.alexa && (
                  <p className={`text-xs ${
                    smarthomeTestResults.alexa.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {smarthomeTestResults.alexa.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* iRobot Roomba Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('irobot', settings?.integrations?.irobot)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.irobot.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.irobot.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('irobot', settings?.integrations?.irobot)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('irobot', settings?.integrations?.irobot) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.irobot?.enabled}
                onChange={(e) => { updateIntegration('irobot', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.irobot?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Username (Email)</div>
                  <input type="email" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.irobot?.username ?? ''}
                    onChange={(e) => { updateIntegration('irobot', { username: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-email@example.com" />
                  <div className="text-xs text-white/40">Your iRobot account email</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Password</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.irobot?.password ?? ''}
                    onChange={(e) => { updateIntegration('irobot', { password: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                  <div className="text-xs text-white/40">Your iRobot account password</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Robot ID (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.irobot?.robotId ?? ''}
                    onChange={(e) => { updateIntegration('irobot', { robotId: e.target.value || undefined }); setSettings(readSettings()); }}
                    placeholder="robot-12345" />
                  <div className="text-xs text-white/40">Leave empty to auto-detect or specify a specific robot</div>
                </label>
                <button
                  className="btn w-full"
                  onClick={() => handleTestSmartHome('irobot')}
                  disabled={!settings?.integrations?.irobot?.username || !settings?.integrations?.irobot?.password}
                >
                  Test Connection
                </button>
                {smarthomeTestResults.irobot && (
                  <p className={`text-xs ${
                    smarthomeTestResults.irobot.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {smarthomeTestResults.irobot.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Google Nest Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('nest', settings?.integrations?.nest)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.nest.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.nest.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('nest', settings?.integrations?.nest)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('nest', settings?.integrations?.nest) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.nest?.enabled}
                onChange={(e) => { updateIntegration('nest', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.nest?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Project ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.nest?.projectId ?? ''}
                    onChange={(e) => { updateIntegration('nest', { projectId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-nest-project-id" />
                  <div className="text-xs text-white/40">From Google Cloud Console</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client ID</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.nest?.clientId ?? ''}
                    onChange={(e) => { updateIntegration('nest', { clientId: e.target.value }); setSettings(readSettings()); }}
                    placeholder="your-nest-client-id.apps.googleusercontent.com" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Client Secret</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.nest?.clientSecret ?? ''}
                    onChange={(e) => { updateIntegration('nest', { clientSecret: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Refresh Token</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.nest?.refreshToken ?? ''}
                    onChange={(e) => { updateIntegration('nest', { refreshToken: e.target.value }); setSettings(readSettings()); }}
                    placeholder="Paste refresh token from OAuth flow" />
                  <div className="text-xs text-white/40">Obtain via Google OAuth2 consent flow</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Device ID (optional)</div>
                  <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.nest?.deviceId ?? ''}
                    onChange={(e) => { updateIntegration('nest', { deviceId: e.target.value || undefined }); setSettings(readSettings()); }}
                    placeholder="enterprises/xxx/devices/xxx" />
                  <div className="text-xs text-white/40">Leave empty to auto-detect or specify a specific thermostat</div>
                </label>
                <button
                  className="btn w-full"
                  onClick={() => handleTestSmartHome('nest')}
                  disabled={!settings?.integrations?.nest?.projectId || !settings?.integrations?.nest?.clientId}
                >
                  Test Connection
                </button>
                {smarthomeTestResults.nest && (
                  <p className={`text-xs ${
                    smarthomeTestResults.nest.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {smarthomeTestResults.nest.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Smart Lights Card */}
          <div className={
            `border rounded-xl p-4 space-y-3 ${
              isIntegrationConnected('smartLights', settings?.integrations?.smartLights)
                ? 'border-[color:rgb(var(--jarvis-accent)_/_0.5)] bg-[color:rgb(var(--jarvis-accent)_/_0.05)]'
                : 'border-white/10'
            }`
          }>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{integrationMetadata.smartLights.name}</div>
                <div className="text-xs text-white/50 mt-1">{integrationMetadata.smartLights.description}</div>
              </div>
              <div className={
                `px-2 py-1 rounded text-xs ${
                  isIntegrationConnected('smartLights', settings?.integrations?.smartLights)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 text-white/40'
                }`
              }>
                {isIntegrationConnected('smartLights', settings?.integrations?.smartLights) ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!settings?.integrations?.smartLights?.enabled}
                onChange={(e) => { updateIntegration('smartLights', { enabled: e.target.checked }); setSettings(readSettings()); }} />
              Enable
            </label>
            {settings?.integrations?.smartLights?.enabled && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="space-y-1">
                  <div className="text-xs text-white/60">Provider</div>
                  <select className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.smartLights?.provider ?? 'hue'}
                    onChange={(e) => { updateIntegration('smartLights', { provider: e.target.value as 'hue' | 'lifx' }); setSettings(readSettings()); }}>
                    <option value="hue">Philips Hue</option>
                    <option value="lifx">LIFX</option>
                  </select>
                  <div className="text-xs text-white/40">Select your smart light provider</div>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-white/60">API Key</div>
                  <input type="password" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                    value={settings?.integrations?.smartLights?.apiKey ?? ''}
                    onChange={(e) => { updateIntegration('smartLights', { apiKey: e.target.value }); setSettings(readSettings()); }}
                    placeholder="********" />
                  <div className="text-xs text-white/40">
                    {settings?.integrations?.smartLights?.provider === 'lifx' 
                      ? 'Your LIFX Cloud API token'
                      : 'Your Hue bridge username/API key'}
                  </div>
                </label>
                {settings?.integrations?.smartLights?.provider === 'hue' && (
                  <label className="space-y-1">
                    <div className="text-xs text-white/60">Bridge IP</div>
                    <input type="text" className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                      value={settings?.integrations?.smartLights?.bridgeIp ?? ''}
                      onChange={(e) => { updateIntegration('smartLights', { bridgeIp: e.target.value || undefined }); setSettings(readSettings()); }}
                      placeholder="192.168.1.xxx" />
                    <div className="text-xs text-white/40">Local IP address of your Hue Bridge</div>
                  </label>
                )}
                <button
                  className="btn w-full"
                  onClick={() => handleTestSmartHome('smartLights')}
                  disabled={!settings?.integrations?.smartLights?.apiKey}
                >
                  Test Connection
                </button>
                {smarthomeTestResults.smartLights && (
                  <p className={`text-xs ${
                    smarthomeTestResults.smartLights.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {smarthomeTestResults.smartLights.message}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Camera & Security Section */}
      <section className="card p-6 space-y-6">
        <header>
          <div className="text-lg font-semibold">Camera & Security</div>
          <div className="text-white/60 text-sm">Configure cameras, motion detection, and lockdown mode</div>
        </header>

        {/* Lockdown Mode Toggle */}
        <div className="border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">🔒 Lockdown Mode</div>
              <div className="text-xs text-white/50 mt-1">Secure all doors, arm alarms, and lock down cameras</div>
            </div>
            <div className="flex items-center gap-3">
              <div className={
                `px-3 py-1 rounded-full text-xs font-medium ${
                  settings?.lockdownState?.active
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`
              }>
                {settings?.lockdownState?.active ? 'Active' : 'Inactive'}
              </div>
              <button
                className={`btn px-4 py-2 text-sm ${
                  settings?.lockdownState?.active
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
                onClick={handleToggleLockdown}
              >
                {settings?.lockdownState?.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
          {settings?.lockdownState?.active && (
            <div className="pt-3 border-t border-white/10 grid grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  settings.lockdownState.features.doorsLocked ? 'bg-red-400' : 'bg-white/20'
                }`} />
                <span>Doors Locked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  settings.lockdownState.features.alarmArmed ? 'bg-red-400' : 'bg-white/20'
                }`} />
                <span>Alarm Armed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${
                  settings.lockdownState.features.camerasSecured ? 'bg-red-400' : 'bg-white/20'
                }`} />
                <span>Cameras Secured</span>
              </div>
            </div>
          )}
        </div>

        {/* Camera Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Registered Cameras</div>
            <button
              className="btn px-3 py-1 text-xs"
              onClick={handleAddCamera}
            >
              + Add Camera
            </button>
          </div>

          {settings?.cameras && settings.cameras.length > 0 ? (
            <div className="space-y-3">
              {settings.cameras.map((camera) => (
                <div key={camera.cameraId} className="border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Camera Name */}
                      <label className="space-y-1">
                        <div className="text-xs text-white/60">Camera Name</div>
                        <input
                          type="text"
                          className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                          value={camera.friendlyName}
                          onChange={(e) => {
                            updateCamera(camera.cameraId, { friendlyName: e.target.value });
                            setSettings(readSettings());
                          }}
                          placeholder="e.g. Front Door, Living Room"
                        />
                      </label>

                      {/* Enable/Disable Toggle */}
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={camera.enabled}
                          onChange={(e) => {
                            updateCamera(camera.cameraId, { enabled: e.target.checked });
                            setSettings(readSettings());
                          }}
                        />
                        <span>Camera Enabled</span>
                      </label>

                      {/* Motion Detection Settings */}
                      <div className="space-y-3 pt-3 border-t border-white/10">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={camera.motionDetection.enabled}
                            onChange={(e) => {
                              updateCamera(camera.cameraId, {
                                motionDetection: {
                                  ...camera.motionDetection,
                                  enabled: e.target.checked
                                }
                              });
                              setSettings(readSettings());
                            }}
                          />
                          <span>Motion Detection</span>
                        </label>

                        {camera.motionDetection.enabled && (
                          <>
                            {/* Sensitivity Slider */}
                            <label className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-white/60">Sensitivity</span>
                                <span className="text-white/80">{camera.motionDetection.sensitivity}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="100"
                                className="w-full"
                                value={camera.motionDetection.sensitivity}
                                onChange={(e) => {
                                  updateCamera(camera.cameraId, {
                                    motionDetection: {
                                      ...camera.motionDetection,
                                      sensitivity: parseInt(e.target.value)
                                    }
                                  });
                                  setSettings(readSettings());
                                }}
                              />
                              <div className="flex justify-between text-xs text-white/40">
                                <span>Low</span>
                                <span>High</span>
                              </div>
                            </label>

                            {/* Cooldown Period */}
                            <label className="space-y-1">
                              <div className="text-xs text-white/60">Cooldown Period (seconds)</div>
                              <input
                                type="number"
                                min="5"
                                max="300"
                                step="5"
                                className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
                                value={camera.motionDetection.cooldownSeconds}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value)) {
                                    updateCamera(camera.cameraId, {
                                      motionDetection: {
                                        ...camera.motionDetection,
                                        cooldownSeconds: Math.max(5, Math.min(300, value))
                                      }
                                    });
                                    setSettings(readSettings());
                                  }
                                }}
                              />
                              <div className="text-xs text-white/40">Minimum time between motion alerts</div>
                            </label>

                            {/* Motion Zones Placeholder */}
                            <div className="pt-2 border-t border-white/10">
                              <div className="text-xs text-white/60 mb-2">Motion Zones (Coming Soon)</div>
                              <div className="bg-white/5 border border-white/10 rounded p-3 text-center">
                                <div className="text-xs text-white/40">
                                  📐 Zone-based motion detection will be available in a future update.
                                  Configure specific areas of the camera view to monitor.
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      className="btn btn-secondary px-3 py-1 text-xs ml-4"
                      onClick={() => handleDeleteCamera(camera.cameraId)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-white/10 rounded-xl p-6 text-center text-sm text-white/60">
              No cameras configured. Click "Add Camera" to register a new camera device.
            </div>
          )}
        </div>
      </section>

      {/* Memory & Logs Section */}
      <section className="card p-6 space-y-6">
        <header>
          <div className="text-lg font-semibold">Memory & Logs</div>
          <div className="text-white/60 text-sm">View conversation history, action timeline, and system logs</div>
        </header>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveMemoryTab('conversations')}
            className={`px-4 py-2 text-sm transition-all border-b-2 ${
              activeMemoryTab === 'conversations'
                ? 'border-[color:rgb(var(--jarvis-accent))] text-white'
                : 'border-transparent text-white/50 hover:text-white/70'
            }`}
          >
            💬 Conversations
          </button>
          <button
            onClick={() => setActiveMemoryTab('actions')}
            className={`px-4 py-2 text-sm transition-all border-b-2 ${
              activeMemoryTab === 'actions'
                ? 'border-[color:rgb(var(--jarvis-accent))] text-white'
                : 'border-transparent text-white/50 hover:text-white/70'
            }`}
          >
            ⚡ Actions
          </button>
          <button
            onClick={() => setActiveMemoryTab('logs')}
            className={`px-4 py-2 text-sm transition-all border-b-2 ${
              activeMemoryTab === 'logs'
                ? 'border-[color:rgb(var(--jarvis-accent))] text-white'
                : 'border-transparent text-white/50 hover:text-white/70'
            }`}
          >
            📋 System Logs
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeMemoryTab === 'conversations' && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-medium mb-1">Conversation History</h3>
                <p className="text-sm text-white/50">
                  Browse and search through your past conversations with AKIOR.
                </p>
              </div>
              <ConversationHistory />
            </div>
          )}

          {activeMemoryTab === 'actions' && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-medium mb-1">Action Timeline</h3>
                <p className="text-sm text-white/50">
                  View a chronological timeline of all actions performed by AKIOR and user interactions.
                </p>
              </div>
              <ActionTimeline />
            </div>
          )}

          {activeMemoryTab === 'logs' && (
            <div>
              <div className="mb-4">
                <h3 className="text-base font-medium mb-1">System Logs</h3>
                <p className="text-sm text-white/50">
                  Access system logs for debugging and monitoring application events.
                </p>
              </div>
              <LogViewer />
            </div>
          )}
        </div>
      </section>

      {/* Build Info Footer */}
      <footer className="text-center text-xs text-white/40 pt-4 space-y-1">
        <BuildInfo />
        <a href="/diagnostics" className="hover:text-white/60 underline">View Diagnostics</a>
      </footer>
    </div>
  );
}
