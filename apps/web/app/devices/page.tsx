'use client';

import { useEffect, useState } from 'react';
import { getCameraSocket } from '@/lib/socket';
import type { CameraPresence } from '@/lib/socket';

interface DeviceInfo extends CameraPresence {
  deviceType?: string;
  appVersion?: string;
  capabilities?: {
    widgets?: boolean;
    '3dModels'?: boolean;
    photos?: boolean;
    calculator?: boolean;
    speechToText?: boolean;
    measurements?: boolean;
    grid?: boolean;
  };
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState({
    socketConnected: false,
    socketId: '',
    lastUpdate: 0,
    deviceCount: 0,
    mdnsStatus: 'unknown'
  });
  const [showDebug, setShowDebug] = useState(true);

  useEffect(() => {
    const socket = getCameraSocket();
    if (!socket) return;

    // Update debug info on connection
    const updateDebugInfo = () => {
      setDebugInfo({
        socketConnected: socket.connected,
        socketId: socket.id || '',
        lastUpdate: Date.now(),
        deviceCount: devices.length,
        mdnsStatus: socket.connected ? 'connected' : 'disconnected'
      });
    };

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      updateDebugInfo();
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      updateDebugInfo();
    });

    // Initial connection check
    updateDebugInfo();

    // Request initial device list
    socket.emit('cameras:requestList');

    // Listen for device list
    socket.on('cameras:list', ({ cameras }: { cameras: DeviceInfo[] }) => {
      console.log('Received device list:', cameras);
      setDevices(cameras);
    });

    // Listen for new devices joining
    socket.on('camera:joined', (info: DeviceInfo) => {
      console.log('Device joined:', info);
      setDevices((prev) => {
        // Check if device already exists
        const exists = prev.some((d) => d.cameraId === info.cameraId);
        if (exists) {
          // Update existing device
          return prev.map((d) => (d.cameraId === info.cameraId ? info : d));
        }
        // Add new device
        return [...prev, info];
      });
    });

    // Listen for devices leaving
    socket.on('camera:left', ({ cameraId }: { cameraId: string }) => {
      console.log('Device left:', cameraId);
      setDevices((prev) => prev.filter((d) => d.cameraId !== cameraId));
      if (selectedDevice === cameraId) {
        setSelectedDevice(null);
      }
    });

    // Listen for Android device status updates
    socket.on('android:status', (payload: any) => {
      console.log('Android status:', payload);
      setStatusMessage(`${payload.cameraId}: ${payload.status}`);
      setTimeout(() => setStatusMessage(''), 3000);
    });

    return () => {
      socket.off('cameras:list');
      socket.off('camera:joined');
      socket.off('camera:left');
      socket.off('android:status');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [selectedDevice, devices.length]);

  const sendCommand = (command: string, args: any = {}) => {
    if (!selectedDevice) return;

    const socket = getCameraSocket();
    if (!socket) return;
    
    // Send command via appropriate event
    if (command === 'openApp') {
      socket.emit('holomat:openApp', { appName: args.appName });
      setStatusMessage(`Opening ${args.appName}...`);
    } else if (command === 'loadModel') {
      socket.emit('holomat:openModel', { modelUrl: args.modelUrl, modelName: args.modelName });
      setStatusMessage(`Loading model ${args.modelName}...`);
    } else if (command === 'triggerScan') {
      socket.emit('scan:trigger');
      setStatusMessage('Triggering scan...');
    }

    setTimeout(() => setStatusMessage(''), 3000);
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === 'android_holomat') {
      return '📱';
    }
    return '📷';
  };

  const getDeviceTypeLabel = (deviceType?: string) => {
    if (deviceType === 'android_holomat') {
      return 'Android HoloMat';
    }
    return 'Camera Device';
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const androidDevices = devices.filter((d) => d.deviceType === 'android_holomat');
  const otherDevices = devices.filter((d) => d.deviceType !== 'android_holomat');
  const selectedDeviceInfo = devices.find((d) => d.cameraId === selectedDevice);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Connected Devices</h1>
            <p className="text-gray-400">
              Manage and control devices on the Jarvis network
            </p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm transition-colors"
          >
            {showDebug ? '🐛 Hide Debug' : '🐛 Show Debug'}
          </button>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="mb-6 bg-gray-900 border border-blue-500/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">🔍 Connection Debug Info</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Socket Status */}
              <div className="bg-gray-800 rounded p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Socket.IO Connection</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={debugInfo.socketConnected ? 'text-green-400' : 'text-red-400'}>
                      {debugInfo.socketConnected ? '✅ Connected' : '❌ Disconnected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Socket ID:</span>
                    <span className="text-blue-400">{debugInfo.socketId || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Namespace:</span>
                    <span className="text-purple-400">/cameras</span>
                  </div>
                </div>
              </div>

              {/* mDNS Broadcast Info */}
              <div className="bg-gray-800 rounded p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">mDNS Service Discovery</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Service Type:</span>
                    <span className="text-cyan-400">_jarvis-server._tcp</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Discovery Port:</span>
                    <span className="text-cyan-400">5353 (UDP)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Service Port:</span>
                    <span className="text-cyan-400">1234</span>
                  </div>
                </div>
              </div>

              {/* Device Stats */}
              <div className="bg-gray-800 rounded p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Device Statistics</h3>
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total Devices:</span>
                    <span className="text-green-400">{devices.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Android HoloMat:</span>
                    <span className="text-blue-400">{androidDevices.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Other Devices:</span>
                    <span className="text-yellow-400">{otherDevices.length}</span>
                  </div>
                </div>
              </div>

              {/* Server Verification */}
              <div className="bg-gray-800 rounded p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Server Verification</h3>
                <div className="space-y-2 text-sm">
                  <div className="text-gray-300">
                    <span className="text-gray-400">macOS:</span>
                    <code className="ml-2 bg-black/50 px-2 py-1 rounded text-cyan-400 text-xs">
                      dns-sd -B _jarvis-server._tcp
                    </code>
                  </div>
                  <div className="text-gray-300">
                    <span className="text-gray-400">Linux:</span>
                    <code className="ml-2 bg-black/50 px-2 py-1 rounded text-cyan-400 text-xs">
                      avahi-browse -r _jarvis-server._tcp
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Android Connection Checklist */}
            <div className="mt-4 bg-gray-800 rounded p-4">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">📱 Android Device Connection Checklist</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">☐</span>
                  <span className="text-gray-300">Android on same WiFi as Jarvis</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">☐</span>
                  <span className="text-gray-300">Jarvis server running on port 1234</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">☐</span>
                  <span className="text-gray-300">Firewall allows port 5353 (UDP)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">☐</span>
                  <span className="text-gray-300">Firewall allows port 1234 (TCP)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">☐</span>
                  <span className="text-gray-300">mDNS broadcasting active</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">☐</span>
                  <span className="text-gray-300">Check Android logcat for errors</span>
                </div>
              </div>
            </div>

            {/* Last Update */}
            <div className="mt-4 text-xs text-gray-500 text-center">
              Last updated: {new Date(debugInfo.lastUpdate).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div className="mb-4 bg-blue-900/50 border border-blue-500 rounded-lg p-4">
            <p className="text-blue-200">{statusMessage}</p>
          </div>
        )}

        {/* Device Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Android Devices */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-semibold mb-4">
              Android Devices ({androidDevices.length})
            </h2>

            {androidDevices.length === 0 ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
                <div className="text-6xl mb-4">📱</div>
                <p className="text-gray-400 mb-2">No Android devices connected</p>
                <p className="text-sm text-gray-500">
                  Install the HoloMat app on an Android device to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {androidDevices.map((device) => (
                  <div
                    key={device.cameraId}
                    className={`bg-gray-900 border rounded-lg p-6 cursor-pointer transition-all hover:border-blue-500 ${
                      selectedDevice === device.cameraId
                        ? 'border-blue-500 bg-gray-800'
                        : 'border-gray-700'
                    }`}
                    onClick={() => setSelectedDevice(device.cameraId)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="text-4xl">{getDeviceIcon(device.deviceType)}</div>
                        <div>
                          <h3 className="text-xl font-semibold">{device.friendlyName}</h3>
                          <p className="text-sm text-gray-400">
                            {getDeviceTypeLabel(device.deviceType)}
                          </p>
                          {device.appVersion && (
                            <p className="text-xs text-gray-500 mt-1">
                              Version {device.appVersion}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-400">Online</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(device.lastSeenTs)}
                        </p>
                      </div>
                    </div>

                    {/* Capabilities */}
                    {device.capabilities && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {device.capabilities.widgets && (
                          <span className="px-2 py-1 bg-blue-900/50 text-blue-200 text-xs rounded">
                            Widgets
                          </span>
                        )}
                        {device.capabilities['3dModels'] && (
                          <span className="px-2 py-1 bg-purple-900/50 text-purple-200 text-xs rounded">
                            3D Models
                          </span>
                        )}
                        {device.capabilities.measurements && (
                          <span className="px-2 py-1 bg-green-900/50 text-green-200 text-xs rounded">
                            Measurements
                          </span>
                        )}
                        {device.capabilities.grid && (
                          <span className="px-2 py-1 bg-yellow-900/50 text-yellow-200 text-xs rounded">
                            Grid
                          </span>
                        )}
                      </div>
                    )}

                    {/* Device ID */}
                    <div className="mt-3 text-xs text-gray-600 font-mono">
                      ID: {device.cameraId}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other Devices */}
            {otherDevices.length > 0 && (
              <>
                <h2 className="text-2xl font-semibold mt-8 mb-4">
                  Other Devices ({otherDevices.length})
                </h2>
                <div className="space-y-3">
                  {otherDevices.map((device) => (
                    <div
                      key={device.cameraId}
                      className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-2xl">{getDeviceIcon(device.deviceType)}</div>
                          <div>
                            <h3 className="font-semibold">{device.friendlyName}</h3>
                            <p className="text-xs text-gray-500">{device.cameraId}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-400">Online</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Control Panel */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Control Panel</h2>

            {!selectedDevice ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400">Select a device to control it</p>
              </div>
            ) : selectedDeviceInfo?.deviceType !== 'android_holomat' ? (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400">
                  Control panel only available for Android HoloMat devices
                </p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Controlling:</h3>
                  <p className="text-sm text-gray-400">{selectedDeviceInfo.friendlyName}</p>
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <h3 className="font-semibold mb-3">Open Apps</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => sendCommand('openApp', { appName: 'calculator' })}
                      className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded transition-colors"
                    >
                      🧮 Calculator
                    </button>
                    <button
                      onClick={() => sendCommand('openApp', { appName: 'clock' })}
                      className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded transition-colors"
                    >
                      🕐 Clock
                    </button>
                    <button
                      onClick={() => sendCommand('openApp', { appName: 'calendar' })}
                      className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded transition-colors"
                    >
                      📅 Calendar
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <h3 className="font-semibold mb-3">Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => sendCommand('triggerScan')}
                      className="w-full bg-green-600 hover:bg-green-700 p-3 rounded transition-colors"
                    >
                      📏 Trigger Scan
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Close all apps on device?')) {
                          // Send command to close all apps
                          const socket = getCameraSocket();
                          if (socket) {
                            socket.emit('holomat:command', {
                              deviceId: selectedDevice,
                              command: 'closeAllApps'
                            });
                          }
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 p-3 rounded transition-colors"
                    >
                      ❌ Close All Apps
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-4">
                  <h3 className="font-semibold mb-3">Device Info</h3>
                  <div className="text-sm space-y-2 text-gray-400">
                    <div>
                      <span className="text-gray-500">ID:</span>
                      <p className="font-mono text-xs break-all">{selectedDevice}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Seen:</span>
                      <p>{formatTimestamp(selectedDeviceInfo.lastSeenTs)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Total Count */}
        <div className="mt-8 bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Devices Connected</p>
              <p className="text-3xl font-bold">{devices.length}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Android HoloMat</p>
              <p className="text-2xl font-semibold text-blue-400">{androidDevices.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

