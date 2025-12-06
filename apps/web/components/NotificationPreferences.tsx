'use client';

import React from 'react';
import { readSettings, updateSettings, type NotificationPreferences } from '@shared/settings';

interface NotificationPreferencesProps {
  preferences: NotificationPreferences;
  onChange: () => void;
}

const notificationTypes = [
  { key: 'calendar_reminder' as const, label: 'Calendar Reminders', icon: '📅', description: 'Reminders for upcoming calendar events' },
  { key: 'printer_alert' as const, label: 'Printer Alerts', icon: '🖨️', description: '3D model generation completion/failure notifications' },
  { key: 'camera_alert' as const, label: 'Camera Alerts', icon: '📹', description: 'Camera connect/disconnect and motion detection' },
  { key: 'system_update' as const, label: 'System Updates', icon: '⚙️', description: 'System updates and maintenance notifications' },
  { key: 'integration_error' as const, label: 'Integration Errors', icon: '⚠️', description: 'Errors from external service integrations' },
  { key: 'custom' as const, label: 'Custom Notifications', icon: '💬', description: 'Custom application notifications' }
];

export function NotificationPreferencesSection({ preferences, onChange }: NotificationPreferencesProps) {
  const handleToggle = (key: keyof NotificationPreferences) => {
    const currentSettings = readSettings();
    const newPreferences = {
      ...currentSettings.notificationPreferences,
      [key]: !preferences[key]
    };
    
    updateSettings({ notificationPreferences: newPreferences });
    console.log(`[NotificationPreferences] Toggled ${key}: ${!preferences[key]}`);
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-white/60">
        Control which notification types appear as toast messages. Disabled notifications will still be logged in history but won't display pop-ups.
      </div>

      <div className="space-y-3">
        {notificationTypes.map((type) => (
          <div 
            key={type.key}
            className="flex items-start gap-3 p-3 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
          >
            <div className="text-2xl flex-shrink-0 mt-0.5">
              {type.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{type.label}</div>
              <div className="text-xs text-white/50 mt-0.5">{type.description}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={preferences[type.key] !== false}
                onChange={() => handleToggle(type.key)}
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-500/60 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
            </label>
          </div>
        ))}
      </div>

      <div className="text-xs text-white/40 border-t border-white/10 pt-3">
        💡 Tip: All notifications are stored in history regardless of these settings. Use these toggles to reduce interruptions while keeping a record of events.
      </div>
    </div>
  );
}
