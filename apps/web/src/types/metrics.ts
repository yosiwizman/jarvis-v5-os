export interface SystemMetrics {
  cpuLoad: number; // 0-100
  memoryUsedPct: number; // 0-100
  memoryUsedGB: number;
  memoryTotalGB: number;
  timestamp: string;
  uptime: number;
}
