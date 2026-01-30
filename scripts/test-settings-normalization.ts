#!/usr/bin/env tsx
/**
 * Settings Normalization Regression Test
 * 
 * This test verifies that readSettings() and normalizeSettings() always return
 * valid, fully-populated settings even with:
 * - Empty/null input
 * - Partial input (missing integrations)
 * - Corrupted/malformed input
 * 
 * REGRESSION: PR #47 fixed crash "Cannot read properties of undefined (reading 'weather')"
 * caused by accessing settings.integrations.weather when integrations was undefined.
 * 
 * Run: npm run test:settings
 */

import { normalizeSettings } from '../packages/shared/src/settings.js';

interface TestCase {
  name: string;
  input: unknown;
  expectPass: boolean;
}

const testCases: TestCase[] = [
  // Null/undefined inputs (fresh browser, empty localStorage)
  { name: 'null input', input: null, expectPass: true },
  { name: 'undefined input', input: undefined, expectPass: true },
  { name: 'empty object', input: {}, expectPass: true },
  
  // Missing integrations entirely (server returns partial data)
  { name: 'missing integrations key', input: { jarvis: { voice: 'echo' } }, expectPass: true },
  { name: 'integrations is null', input: { integrations: null }, expectPass: true },
  { name: 'integrations is undefined', input: { integrations: undefined }, expectPass: true },
  { name: 'integrations is empty object', input: { integrations: {} }, expectPass: true },
  
  // Partial integrations (some keys missing)
  { 
    name: 'integrations missing weather', 
    input: { integrations: { webSearch: { enabled: false } } }, 
    expectPass: true 
  },
  { 
    name: 'integrations with only weather', 
    input: { integrations: { weather: { enabled: true } } }, 
    expectPass: true 
  },
  
  // Corrupted/malformed inputs
  { name: 'string input', input: 'invalid', expectPass: true },
  { name: 'number input', input: 42, expectPass: true },
  { name: 'array input', input: [1, 2, 3], expectPass: true },
  { name: 'integrations as string', input: { integrations: 'invalid' }, expectPass: true },
  { name: 'integrations as array', input: { integrations: [] }, expectPass: true },
  
  // Valid partial settings (should still work)
  {
    name: 'valid partial with some integrations',
    input: {
      jarvis: { voice: 'alloy' },
      integrations: {
        weather: { enabled: true, provider: 'openweather', defaultLocation: 'NYC,US' },
        webSearch: { enabled: false, baseUrl: null, apiKey: null, defaultRegion: null }
      }
    },
    expectPass: true
  },
];

const REQUIRED_INTEGRATION_KEYS = [
  'weather', 'webSearch', 'localLLM', 'elevenLabs', 'azureTTS',
  'spotify', 'gmail', 'googleCalendar', 'alexa', 'irobot', 'nest', 'smartLights'
] as const;

function validateNormalizedSettings(settings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check top-level structure
  if (!settings || typeof settings !== 'object') {
    errors.push('Settings is not an object');
    return { valid: false, errors };
  }
  
  // Check integrations exists and is an object
  if (!settings.integrations || typeof settings.integrations !== 'object') {
    errors.push('settings.integrations is missing or not an object');
    return { valid: false, errors };
  }
  
  // Check each required integration key exists and has 'enabled' field
  for (const key of REQUIRED_INTEGRATION_KEYS) {
    const integration = settings.integrations[key];
    if (!integration || typeof integration !== 'object') {
      errors.push(`settings.integrations.${key} is missing or not an object`);
      continue;
    }
    if (typeof integration.enabled !== 'boolean') {
      errors.push(`settings.integrations.${key}.enabled is not a boolean`);
    }
  }
  
  // Specifically test the crash scenario: accessing weather.defaultLocation
  try {
    const weatherLocation = settings.integrations.weather.defaultLocation;
    if (weatherLocation === undefined) {
      // This is OK - it might be undefined but the key should exist
    }
  } catch (e) {
    errors.push(`Crash accessing settings.integrations.weather.defaultLocation: ${e}`);
  }
  
  return { valid: errors.length === 0, errors };
}

async function runTests(): Promise<void> {
  console.log('🧪 Settings Normalization Regression Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    process.stdout.write(`  Testing: ${testCase.name}... `);
    
    try {
      const normalized = normalizeSettings(testCase.input);
      const validation = validateNormalizedSettings(normalized);
      
      if (validation.valid) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL');
        console.log(`    Validation errors:`);
        validation.errors.forEach(err => console.log(`      - ${err}`));
        failed++;
      }
    } catch (error) {
      console.log('❌ EXCEPTION');
      console.log(`    Error: ${error}`);
      failed++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Some tests failed. The settings normalization is broken.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed. Settings normalization is working correctly.');
    process.exit(0);
  }
}

// Run tests
runTests().catch(err => {
  console.error('💥 Test runner crashed:', err);
  process.exit(1);
});
