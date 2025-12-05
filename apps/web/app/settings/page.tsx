'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  readSettings,
  updateJarvisSettings,
  updateModelSettings,
  updateTextChatSettings,
  updateSettings,
  type AppSettings,
  type TextChatSettings
} from '@shared/settings';
import { buildServerUrl } from '@/lib/api';
import { getRootSocket } from '@/lib/socket';

type KeyName = 'openai' | 'meshy';
type KeyMetaState = Record<KeyName, { present: boolean }>;
type FeedbackState = Partial<Record<KeyName, { type: 'success' | 'error'; message: string }>>;

export default function SettingsPage() {
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
  const [bambuAuthMessage, setBambuAuthMessage] = useState('');

  useEffect(() => {
    setSettings(readSettings());
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
      const response = await fetch(buildServerUrl('/admin/keys'), {
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
      setFeedback((prev) => ({
        ...prev,
        [name]: {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to save key'
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
      const response = await fetch(buildServerUrl(`/admin/keys/${name}`), { method: 'DELETE' });
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
      setFeedback((prev) => ({
        ...prev,
        [name]: {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to delete key'
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
      const res = await fetch(buildServerUrl('/api/3dprint/login'), {
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
      setBambuAuthStatus('error');
      setBambuAuthMessage(err instanceof Error ? err.message : 'Login error');
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
      const res = await fetch(buildServerUrl('/api/3dprint/verify'), {
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
      setBambuAuthStatus('error');
      setBambuAuthMessage(err instanceof Error ? err.message : 'Verification error');
    }
    setIsVerifyingCode(false);
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

  if (!settings) return null;

  const chat = textChat();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card p-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Jarvis</div>
            <div className="text-white/60 text-sm">Realtime voice assistant settings</div>
          </div>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <div className="text-sm text-white/70">Initial prompt</div>
            <textarea
              className="w-full h-24 bg-transparent border border-white/10 rounded-xl px-3 py-2"
              {...bind('initialPrompt')}
              placeholder="You are Jarvis…"
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
              placeholder="You are J.A.R.V.I.S., a sophisticated AI assistant..."
            />
            <p className="text-xs text-white/40">
              Define J.A.R.V.I.S.'s personality, tone, and behavior. This is sent at the start of each session.
            </p>
          </label>
          <label className="space-y-2">
            <div className="text-sm text-white/70">Trigger word (hotword)</div>
            <input
              className="w-full bg-transparent border border-white/10 rounded-xl px-3 py-2"
              {...bind('hotword')}
              placeholder="jarvis"
            />
            <p className="text-xs text-white/40">
              Say "Hey &lt;trigger&gt;" to start a session. Example: "Hey jarvis".
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
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <header>
          <div className="text-lg font-semibold">Provider keys</div>
          <div className="text-white/60 text-sm">Manage API credentials stored on the server</div>
        </header>
        <div className="space-y-6">
          {renderKeyRow('openai', 'OpenAI API key', 'Used for Jarvis realtime voice sessions.')}
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
    </div>
  );
}
