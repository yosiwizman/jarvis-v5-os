#!/usr/bin/env npx tsx
/**
 * Settings Contract Validation Tests
 * 
 * Tests the server-side settings contract guard to ensure:
 * - API always returns normalized settings (never partial)
 * - Corrupted/missing files fall back to safe defaults
 * - All integration keys are present after normalization
 * 
 * Run: npm run test:contract
 */

import {
  validateAndNormalizeSettings,
  safeJsonParse,
  getDefaultSettings,
  normalizeServerSettings,
  RawSettingsSchema,
  defaultSettings,
  defaultIntegrations
} from '../apps/server/src/utils/settingsContract.js';

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertDefined(value: unknown, path: string) {
  if (value === undefined) {
    throw new Error(`Expected ${path} to be defined, got undefined`);
  }
}

function assertNotNull(value: unknown, path: string) {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${path} to not be null/undefined`);
  }
}

// ============================================================================
// Test Suites
// ============================================================================

console.log('\n📋 Settings Contract Validation Tests\n');

// ----------------------------------------------------------------------------
// Suite 1: Safe JSON Parsing
// ----------------------------------------------------------------------------

console.log('1️⃣  Safe JSON Parsing');

test('parses valid JSON', () => {
  const { data, error } = safeJsonParse('{"foo": "bar"}');
  assert(!error, 'Should not have error');
  assertEqual((data as any).foo, 'bar', 'Data should match');
});

test('returns empty object for invalid JSON', () => {
  const { data, error } = safeJsonParse('not valid json {');
  assert(error !== undefined, 'Should have error');
  assertEqual(typeof data, 'object', 'Should return object');
});

test('returns empty object for empty string', () => {
  const { data, error } = safeJsonParse('');
  assert(error !== undefined, 'Should have error');
  assertEqual(typeof data, 'object', 'Should return object');
});

// ----------------------------------------------------------------------------
// Suite 2: Default Settings
// ----------------------------------------------------------------------------

console.log('\n2️⃣  Default Settings');

test('getDefaultSettings returns valid object', () => {
  const defaults = getDefaultSettings();
  assertDefined(defaults.jarvis, 'jarvis');
  assertDefined(defaults.models, 'models');
  assertDefined(defaults.textChat, 'textChat');
  assertDefined(defaults.imageGeneration, 'imageGeneration');
  assertDefined(defaults.integrations, 'integrations');
});

test('default integrations has all required keys (DEC-033 channels-era shape)', () => {
  // DEC-033 purged the Google credential-model. Gmail and Google Calendar are
  // now first-class channel providers (packages/shared/src/channels.ts,
  // ChannelProviderDescriptor) with their own lifecycle and API surface
  // (/api/channels/gmail/*), not IntegrationSettings entries. See also DEC-031
  // (Gmail browser-session lane) and DEC-034 (E2E auth bootstrap).
  const defaults = getDefaultSettings();
  const requiredKeys = [
    'weather', 'webSearch', 'localLLM', 'elevenLabs', 'azureTTS',
    'spotify', 'alexa', 'irobot', 'nest', 'smartLights',
  ];

  for (const key of requiredKeys) {
    assertDefined(defaults.integrations[key as keyof typeof defaults.integrations], `integrations.${key}`);
  }

  // Negative assertions: the purged legacy keys must NOT reappear in the
  // integrations shape. If they do, something is reviving DEC-033-forbidden
  // pathways and the contract must fail loudly.
  const integrationKeys = Object.keys(defaults.integrations);
  assert(!integrationKeys.includes('gmail'),
    "integrations.gmail must NOT exist (DEC-033: Gmail is a channel, not an integration)");
  assert(!integrationKeys.includes('googleCalendar'),
    "integrations.googleCalendar must NOT exist (DEC-033: moved out of the integration model)");
});

test('default integrations.weather has required fields', () => {
  const defaults = getDefaultSettings();
  assertDefined(defaults.integrations.weather.enabled, 'weather.enabled');
  assertDefined(defaults.integrations.weather.provider, 'weather.provider');
  assertDefined(defaults.integrations.weather.defaultLocation, 'weather.defaultLocation');
});

// ----------------------------------------------------------------------------
// Suite 3: Normalization
// ----------------------------------------------------------------------------

console.log('\n3️⃣  Settings Normalization');

test('normalizes null input to defaults', () => {
  const result = normalizeServerSettings(null);
  assertDefined(result.jarvis, 'jarvis');
  assertDefined(result.integrations.weather, 'integrations.weather');
});

test('normalizes undefined input to defaults', () => {
  const result = normalizeServerSettings(undefined);
  assertDefined(result.jarvis, 'jarvis');
  assertDefined(result.integrations.weather, 'integrations.weather');
});

test('normalizes empty object to defaults', () => {
  const result = normalizeServerSettings({});
  assertDefined(result.jarvis.model, 'jarvis.model');
  assertDefined(result.integrations.weather.provider, 'integrations.weather.provider');
});

test('normalizes partial settings - missing integrations', () => {
  const partial = { jarvis: { voice: 'custom-voice' } };
  const result = normalizeServerSettings(partial);
  
  assertEqual(result.jarvis.voice, 'custom-voice', 'Should preserve custom voice');
  assertDefined(result.integrations, 'Should have integrations');
  assertDefined(result.integrations.weather, 'Should have weather');
});

test('normalizes partial settings - missing weather in integrations', () => {
  const partial = { integrations: { spotify: { enabled: true } } };
  const result = normalizeServerSettings(partial);
  
  assertDefined(result.integrations.weather, 'Should have weather after normalization');
  assertDefined(result.integrations.weather.provider, 'Should have weather.provider');
});

test('preserves user values during normalization', () => {
  const partial = {
    jarvis: { voice: 'my-voice', model: 'my-model' },
    integrations: {
      weather: { enabled: true, defaultLocation: 'NYC,US' }
    }
  };
  
  const result = normalizeServerSettings(partial);
  
  assertEqual(result.jarvis.voice, 'my-voice', 'Should preserve jarvis.voice');
  assertEqual(result.jarvis.model, 'my-model', 'Should preserve jarvis.model');
  assertEqual(result.integrations.weather.enabled, true, 'Should preserve weather.enabled');
  assertEqual(result.integrations.weather.defaultLocation, 'NYC,US', 'Should preserve weather.location');
  // Default should fill in missing
  assertDefined(result.integrations.weather.provider, 'Should have weather.provider from defaults');
});

// ----------------------------------------------------------------------------
// Suite 4: Contract Validation
// ----------------------------------------------------------------------------

console.log('\n4️⃣  Contract Validation');

test('validateAndNormalizeSettings returns ok for valid settings', () => {
  const result = validateAndNormalizeSettings({ jarvis: { voice: 'echo' } });
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings, 'Should have settings');
});

test('validateAndNormalizeSettings returns ok for empty object', () => {
  const result = validateAndNormalizeSettings({});
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings.integrations.weather, 'Should have normalized integrations');
});

test('validateAndNormalizeSettings returns ok for null (with defaults)', () => {
  const result = validateAndNormalizeSettings(null);
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings, 'Should have settings');
});

test('validateAndNormalizeSettings handles extra unknown fields', () => {
  const result = validateAndNormalizeSettings({
    jarvis: { voice: 'echo' },
    unknownField: 'should be preserved',
    integrations: {
      weather: { enabled: true },
      customIntegration: { foo: 'bar' }  // Unknown integration
    }
  });
  
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings.integrations.weather, 'Should have weather');
});

test('validateAndNormalizeSettings normalizes deeply nested missing keys', () => {
  const partial = {
    lockdownState: {
      active: true
      // Missing: activatedAt, activatedBy, features
    }
  };
  
  const result = validateAndNormalizeSettings(partial);
  assert(result.ok, 'Should return ok=true');
  assertEqual(result.settings.lockdownState.active, true, 'Should preserve active');
  assertDefined(result.settings.lockdownState.features, 'Should have features');
  assertDefined(result.settings.lockdownState.features.doorsLocked, 'Should have features.doorsLocked');
});

// ----------------------------------------------------------------------------
// Suite 5: Regression Tests (PR #48 scenarios)
// ----------------------------------------------------------------------------

console.log('\n5️⃣  Regression Tests (PR #48 scenarios)');

test('REGRESSION: settings with only textChat should not crash on integrations.weather', () => {
  const partial = { textChat: { model: 'gpt-5' } };
  const result = validateAndNormalizeSettings(partial);
  
  assert(result.ok, 'Should return ok=true');
  // This was the crash scenario: accessing integrations.weather.enabled
  assertDefined(result.settings.integrations.weather.enabled, 'Should access weather.enabled without crash');
});

test('REGRESSION: SSR with no localStorage should return valid settings', () => {
  // Simulates SSR path where localStorage is unavailable
  const result = validateAndNormalizeSettings(null);
  
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings.integrations.weather, 'SSR should have weather');
  assertDefined(result.settings.integrations.spotify, 'SSR should have spotify');
});

test('REGRESSION: corrupted JSON file scenario', () => {
  // Simulate reading corrupted JSON that fails to parse
  const { data, error } = safeJsonParse('{"jarvis": {"voice": "echo"');  // Missing closing braces
  
  assert(error !== undefined, 'Should have parse error');
  
  // Even with corrupted JSON, normalization should work
  const result = validateAndNormalizeSettings(data);
  assert(result.ok, 'Should still return ok=true');
  assertDefined(result.settings.integrations.weather, 'Should have defaults');
});

test('REGRESSION: settings with undefined integrations object', () => {
  const partial = {
    jarvis: { voice: 'echo' },
    integrations: undefined
  };
  
  const result = validateAndNormalizeSettings(partial);
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings.integrations.weather, 'Should fill undefined integrations');
});

test('REGRESSION: settings with null integrations.weather', () => {
  const partial = {
    integrations: {
      weather: null,
      spotify: { enabled: true }
    }
  };
  
  const result = validateAndNormalizeSettings(partial);
  assert(result.ok, 'Should return ok=true');
  assertDefined(result.settings.integrations.weather.enabled, 'Should fill null weather');
});

// ----------------------------------------------------------------------------
// Suite 6: Zod Schema Validation
// ----------------------------------------------------------------------------

console.log('\n6️⃣  Zod Schema Validation');

test('Zod schema accepts valid partial settings', () => {
  const result = RawSettingsSchema.safeParse({
    jarvis: { voice: 'echo' }
  });
  assert(result.success, 'Should pass validation');
});

test('Zod schema accepts empty object', () => {
  const result = RawSettingsSchema.safeParse({});
  assert(result.success, 'Should pass validation for empty object');
});

test('Zod schema accepts unknown fields (passthrough)', () => {
  const result = RawSettingsSchema.safeParse({
    customField: 'value',
    jarvis: { customJarvisField: 'value' }
  });
  assert(result.success, 'Should pass validation with unknown fields');
});

test('Zod schema rejects invalid enum values', () => {
  const result = RawSettingsSchema.safeParse({
    jarvis: { imageDetail: 'invalid-value' }
  });
  assert(!result.success, 'Should fail validation for invalid enum');
});

// ----------------------------------------------------------------------------
// Results Summary
// ----------------------------------------------------------------------------

console.log('\n' + '─'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some tests failed!\n');
  process.exit(1);
} else {
  console.log('✅ All tests passed!\n');
  process.exit(0);
}
