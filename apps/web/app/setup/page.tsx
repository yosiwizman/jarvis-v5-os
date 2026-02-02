'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { buildServerUrl } from '@/lib/api';
import { useSystemStatus, getStatusColor, StatusLevel } from '@/hooks/useSystemStatus';
import { BRAND, PRIMARY_HOSTNAME } from '@/lib/brand';

type KeyName = 'openai' | 'meshy';
type KeyMetaState = Record<KeyName, { present: boolean }>;
type ValidationState = Record<KeyName, { validating: boolean; result?: { ok: boolean; message?: string; error?: string } }>;

const SETUP_STEPS = [
  { id: 'https', title: 'Trust HTTPS Certificate', description: 'Enable secure mic/camera access' },
  { id: 'openai', title: 'Configure OpenAI API Key', description: 'Required for voice assistant and AI features' },
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
  const [keysMeta, setKeysMeta] = useState<KeyMetaState | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Record<KeyName, string>>({ openai: '', meshy: '' });
  const [savingKeys, setSavingKeys] = useState<Record<KeyName, boolean>>({ openai: false, meshy: false });
  const [validation, setValidation] = useState<ValidationState>({ openai: { validating: false }, meshy: { validating: false } });
  const [feedback, setFeedback] = useState<Record<KeyName, { type: 'success' | 'error'; message: string } | undefined>>({
    openai: undefined,
    meshy: undefined,
  });

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

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

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
    if (stepId === 'https') {
      if (typeof window !== 'undefined' && window.isSecureContext) return 'complete';
      return 'current';
    }
    if (stepId === 'openai') {
      if (keysMeta?.openai?.present) return 'complete';
      if (typeof window !== 'undefined' && window.isSecureContext) return 'current';
      return 'upcoming';
    }
    if (stepId === 'meshy') {
      if (keysMeta?.meshy?.present) return 'complete';
      if (keysMeta?.openai?.present) return 'current';
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

      {/* Step 1: HTTPS Trust */}
      <section className="card p-6 space-y-4">
        <header>
          <div className="text-lg font-semibold">Step 1: Trust HTTPS Certificate</div>
          <p className="text-white/60 text-sm">
            Required for microphone and camera access over LAN
          </p>
        </header>
        
        <SecureContextStatus />
        
        <div className="text-sm text-white/50">
          <p>
            {BRAND.productName} uses Caddy's internal CA for HTTPS on your local network.
            Installing the certificate allows your browser to access mic/camera securely.
          </p>
          <p className="mt-2">
            <Link href="/diagnostics" className="text-cyan-400 hover:underline">
              View full diagnostics →
            </Link>
          </p>
        </div>
      </section>

      {/* Step 2: OpenAI Key */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Step 2: OpenAI API Key</div>
            <p className="text-white/60 text-sm">Required for voice assistant and AI features</p>
          </div>
          {keysMeta?.openai?.present && (
            <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full">
              Configured ✓
            </span>
          )}
        </header>

        <div className="space-y-3">
          <input
            type="password"
            className="w-full bg-transparent border border-white/10 rounded-xl px-4 py-3"
            value={pendingKeys.openai}
            onChange={(e) => setPendingKeys(prev => ({ ...prev, openai: e.target.value }))}
            placeholder="sk-..."
            disabled={savingKeys.openai}
          />
          
          {/* Validation result */}
          {validation.openai.result && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              validation.openai.result.ok 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'
            }`}>
              {validation.openai.result.ok ? '✓ ' : '✗ '}
              {validation.openai.result.message || validation.openai.result.error}
            </div>
          )}
          
          {/* Feedback */}
          {feedback.openai && (
            <div className={`text-sm ${feedback.openai.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
              {feedback.openai.message}
            </div>
          )}

          <div className="flex gap-2">
            <button 
              className="btn btn-secondary"
              onClick={() => validateKey('openai')}
              disabled={!pendingKeys.openai.trim() || validation.openai.validating || savingKeys.openai}
            >
              {validation.openai.validating ? 'Validating...' : 'Test Key'}
            </button>
            <button 
              className="btn"
              onClick={() => saveKey('openai')}
              disabled={!pendingKeys.openai.trim() || savingKeys.openai}
            >
              {savingKeys.openai ? 'Saving...' : keysMeta?.openai?.present ? 'Replace Key' : 'Save Key'}
            </button>
          </div>

          <p className="text-xs text-white/40">
            Get your API key from{' '}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
              platform.openai.com/api-keys
            </a>
          </p>
        </div>
      </section>

      {/* Step 3: Meshy Key (Optional) */}
      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Step 3: Meshy API Key <span className="text-white/40 font-normal">(Optional)</span></div>
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
