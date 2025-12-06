export interface WeatherResponse {
  location: string;
  temperatureC: number;
  temperatureF: number;
  condition: string;         // e.g. "Clouds"
  description: string;        // e.g. "broken clouds"
  iconCode: string;           // e.g. "04d"
  humidity: number;
  windKph: number;
  updatedAt: string;          // ISO timestamp
}

export interface WeatherSettings {
  enabled: boolean;
  provider: 'openweather';
  location: string;            // e.g. "Miami,US" or "London,GB"
}
