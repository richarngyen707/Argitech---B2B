import { TelemetryData } from '../types';

export interface LiveWeatherResponse {
  temp: number;
  windSpeed: number;
  precipitation: number;
  humidity: number;
  time: string;
}

export async function fetchOpenMeteoWeather(lat: number, lng: number): Promise<LiveWeatherResponse> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo responded with status ${response.status}`);
    }

    const data = await response.json();
    const current = data.current || {};

    return {
      temp: Number(current.temperature_2m ?? 28),
      windSpeed: Number(current.wind_speed_10m ?? 12),
      precipitation: Number(current.precipitation ?? 0),
      humidity: Number(current.relative_humidity_2m ?? 75),
      time: current.time || new Date().toISOString(),
    };
  } catch (error) {
    // Graceful offline fallback based on latitude
    const isTropical = Math.abs(lat) < 23.5;
    return {
      temp: isTropical ? 29.5 : 22.0,
      windSpeed: 11.5,
      precipitation: 0.0,
      humidity: isTropical ? 80 : 65,
      time: new Date().toISOString(),
    };
  }
}
