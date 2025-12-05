'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

// Printer status interface
interface PrinterConfig {
  printerSN: string;
  printerName?: string;
}

interface PrinterStatus {
  gcode_state?: string;
  subtask_name?: string;
  mc_percent?: number;
  nozzle_target_temper?: number;
  nozzle_temper?: number;
  bed_target_temper?: number;
  bed_temper?: number;
  mc_remaining_time?: number;
  chamber_temper?: number;
  wifi_signal?: string;
  ams_status?: string;
  ams?: {
    ams?: Array<{
      tray: Array<{
        id: string;
        tray_id_name: string;
        tray_color?: string;
        cols?: string[];
      }>;
    }>;
  };
}

interface Task {
  id: string;
  title: string;
  deviceName: string;
  status: number;
  cover?: string;
}

export default function ThreeDPrintersPage() {
  const [tab, setTab] = useState<'dashboard' | 'history'>('dashboard');
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PrinterStatus>>({});
  const [actionStates, setActionStates] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Fetch tasks history
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/3dprint/tasks');
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : data.hits || []);
    } catch (e) {
      console.error('Error fetching tasks:', e);
    }
  };

  // Fetch statuses helper
  const fetchStatuses = async () => {
    try {
      const res = await fetch('/api/3dprint/status');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data);
      }
    } catch (e) {
      console.error('Error fetching statuses:', e);
    }
  };

  // On mount: load printer config then fetch statuses
  useEffect(() => {
    async function initPrinters() {
      try {
        const res = await fetch('/api/3dprint/config');
        const cfg = await res.json();
        setPrinters(Array.isArray(cfg) ? cfg : []);
        fetchStatuses();
      } catch (e) {
        console.error('Printer initialization error:', e);
      }
    }
    initPrinters();
  }, []);

  // Poll printer statuses periodically
  useEffect(() => {
    if (printers.length === 0) return;
    const iv = setInterval(fetchStatuses, 5000);
    return () => clearInterval(iv);
  }, [printers]);

  // Poll print tasks history periodically
  useEffect(() => {
    fetchTasks();
    const iv2 = setInterval(fetchTasks, 5000);
    return () => clearInterval(iv2);
  }, []);

  // Send printer command and optimistically update UI
  const sendCommand = async (sn: string, cmd: string) => {
    setActionStates(prev => ({ ...prev, [sn]: cmd }));
    try {
      await fetch(`/api/3dprint/${sn}/${cmd}`, { method: 'POST' });
    } catch (e) {
      console.error(`Error sending ${cmd} to ${sn}:`, e);
    } finally {
      setActionStates(prev => {
        const next = { ...prev };
        delete next[sn];
        return next;
      });
    }
  };

  // Icon helper: select printer image by name
  const getPrinterImage = (name: string) => {
    if (/A1/i.test(name)) return '/assets/Printers/A1.png';
    if (/H2D/i.test(name)) return '/assets/Printers/H2D.png';
    if (/Carbon|X1/i.test(name)) return '/assets/Printers/X1C.png';
    if (/P1P/i.test(name)) return '/assets/Printers/P1P.png';
    if (/P1S/i.test(name)) return '/assets/Printers/P1S.png';
    return null;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-blue-700/40">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 tracking-wider">3D PRINTER DASHBOARD</h1>
          <p className="text-blue-400/60 text-sm mt-1">Monitor and control your Bambu Lab printers</p>
        </div>
        <div className="space-x-4">
          <button
            onClick={() => setTab('dashboard')}
            className={`px-6 py-2 rounded-lg transition-all ${
              tab === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-blue-400 hover:text-cyan-400'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-6 py-2 rounded-lg transition-all ${
              tab === 'history'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-blue-400 hover:text-cyan-400'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {printers.length > 0 ? (
            printers.map(pr => {
              const sn = pr.printerSN;
              const name = pr.printerName || sn;
              const stat = statuses[sn] || {};
              const isExpanded = !!expandedCards[sn];
              const status = stat.gcode_state || 'Unknown';

              // Optimistic UI during commands
              const pending = actionStates[sn];
              const displayStatus =
                pending === 'pause'
                  ? 'Pausing'
                  : pending === 'resume'
                  ? 'Resuming'
                  : pending === 'stop'
                  ? 'Stopping'
                  : status;
              const isToggling = pending === 'pause' || pending === 'resume';

              const subtask = stat.subtask_name || '-';
              const percent = stat.mc_percent != null ? stat.mc_percent : 0;
              const nozzleTarget = stat.nozzle_target_temper || 0;
              const nozzleActual = stat.nozzle_temper || 0;
              const bedTarget = stat.bed_target_temper || 0;
              const bedActual = stat.bed_temper || 0;
              const img = getPrinterImage(name);

              // Determine shadow color based on printer status
              const statusNorm = status.toUpperCase();
              const statusColorMap: Record<string, string> = {
                RUNNING: 'rgba(16,185,129,0.6)', // green
                PAUSE: 'rgba(234,179,8,0.6)', // yellow
                FAILED: 'rgba(239,68,68,0.6)', // red
                IDLE: 'rgba(255,255,255,0.6)', // white
              };
              const shadowColor = statusColorMap[statusNorm] || statusColorMap.IDLE;

              return (
                <div
                  key={sn}
                  className="bg-gray-900 rounded-lg p-6 relative cursor-pointer hover:bg-gray-800/80 transition-all"
                  style={{ boxShadow: `2px -2px 6px ${shadowColor}` }}
                  onClick={() => setExpandedCards(prev => ({ ...prev, [sn]: !prev[sn] }))}
                >
                  {/* Header with Image and Controls */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {img && (
                        <div className="relative w-24 h-24">
                          <Image
                            src={img}
                            alt={name}
                            width={96}
                            height={96}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <h3 className="text-2xl text-blue-200 font-semibold truncate">{name}</h3>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          sendCommand(sn, status === 'PAUSE' ? 'resume' : 'pause');
                        }}
                        disabled={!(status === 'RUNNING' || status === 'PAUSE') || !!pending}
                        title={status === 'PAUSE' ? 'Resume' : 'Pause'}
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all disabled:cursor-not-allowed ${
                          isToggling
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-800 hover:bg-blue-600 text-blue-400 hover:text-white disabled:opacity-30'
                        }`}
                      >
                        <span className="text-lg leading-none">
                          {status === 'PAUSE' ? '▶' : '❚❚'}
                        </span>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          sendCommand(sn, 'stop');
                        }}
                        disabled={!(status === 'RUNNING' || status === 'PAUSE') || !!pending}
                        title="Stop"
                        className="flex items-center justify-center w-10 h-10 bg-gray-800 hover:bg-red-600 text-red-400 hover:text-white rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <span className="text-lg leading-none">■</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Info */}
                  <div className="space-y-2">
                    <p className="text-blue-400 text-sm">Serial: {sn}</p>
                    <p className="text-blue-300 text-lg font-medium">Status: {displayStatus}</p>
                    <p className="text-blue-300">Subtask: {subtask}</p>
                    <p className="text-blue-300 text-xl font-semibold">Progress: {percent}%</p>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-cyan-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Temperature Info */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-blue-400 text-xs mb-1">Nozzle Temperature</p>
                        <p className="text-blue-300">
                          {nozzleTarget}°C target
                          <br />
                          {nozzleActual}°C actual
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-400 text-xs mb-1">Bed Temperature</p>
                        <p className="text-blue-300">
                          {bedTarget}°C target
                          <br />
                          {bedActual}°C actual
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Info */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-blue-700/40 space-y-2">
                      <h4 className="text-blue-200 font-semibold mb-3">Additional Information</h4>
                      <p className="text-blue-300 text-sm">
                        Remaining Time: {stat.mc_remaining_time || 0}s
                      </p>
                      <p className="text-blue-300 text-sm">
                        Chamber Temp: {stat.chamber_temper || 0}°C
                      </p>
                      <p className="text-blue-300 text-sm">WiFi Signal: {stat.wifi_signal || 'N/A'}</p>

                      {/* AMS Filament Colors */}
                      {stat.ams && stat.ams.ams && stat.ams.ams.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                          <h5 className="text-blue-200 font-semibold mb-2">
                            AMS (Filament System)
                          </h5>
                          <p className="text-blue-300 text-sm mb-3">
                            Status: {stat.ams_status || 'Unknown'}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {stat.ams.ams[0].tray.map(tray => {
                              const code =
                                tray.tray_color || (tray.cols && tray.cols[0]) || '000000';
                              const hex = code.length === 8 ? '#' + code.slice(0, 6) : '#' + code;
                              return (
                                <div key={tray.id} className="flex flex-col items-center">
                                  <div
                                    className="w-8 h-8 rounded-full border-2 border-blue-400/30"
                                    style={{ backgroundColor: hex }}
                                  />
                                  <span className="text-blue-400 text-xs mt-1">
                                    {tray.tray_id_name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="text-6xl">🖨️</div>
              <p className="text-blue-400 text-xl">No printers found</p>
              <p className="text-blue-400/60 text-sm">
                Login with your Bambu Labs credentials in Settings to access your printers
              </p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tasks.length > 0 ? (
            tasks.map(task => {
              return (
                <div
                  key={task.id}
                  className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800/80 transition-all border border-blue-700/20 hover:border-cyan-500/40"
                >
                  {task.cover && (
                    <div className="relative w-full h-48">
                      <Image
                        src={task.cover}
                        alt={task.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <h3 className="text-lg text-blue-200 font-semibold truncate">
                      {task.title}
                    </h3>
                    <p className="text-blue-400 text-sm">Device: {task.deviceName}</p>
                    <p className="text-blue-400 text-sm">
                      Status:{' '}
                      <span
                        className={
                          task.status === 2
                            ? 'text-green-400'
                            : task.status === 1
                            ? 'text-yellow-400'
                            : 'text-gray-400'
                        }
                      >
                        {task.status === 1 ? 'Active' : task.status === 2 ? 'Done' : 'Unknown'}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-20 space-y-4">
              <div className="text-6xl">📋</div>
              <p className="text-blue-400 text-xl">No print history found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


