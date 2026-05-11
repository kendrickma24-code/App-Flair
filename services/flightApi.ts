import { RAPIDAPI_KEY } from '../config';

export interface FlightInfo {
  flightNumber: string;
  airline: string;
  departure: {
    airport: string;
    iata: string;
    scheduledTime: string;
    terminal?: string;
    gate?: string;
  };
  arrival: {
    airport: string;
    iata: string;
    scheduledTime: string;
    terminal?: string;
    gate?: string;
  };
  status: string;
  duration?: string;
  aircraft?: string;
}

export async function lookupFlight(
  flightNumber: string,
  date: string, // YYYY-MM-DD
): Promise<FlightInfo> {
  if (!RAPIDAPI_KEY) {
    throw new Error('NO_KEY');
  }

  const normalized = flightNumber.replace(/\s/g, '').toUpperCase();
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${normalized}/${date}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-host': 'aerodatabox.p.rapidapi.com',
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (response.status === 204 || response.status === 404) {
    throw new Error('NOT_FOUND');
  }

  if (!response.ok) {
    throw new Error(`API_ERROR_${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('NOT_FOUND');
  }

  const f = data[0];

  const depTime: string =
    f.departure?.scheduledTime?.local ??
    f.departure?.scheduledTime?.utc ??
    '';
  const arrTime: string =
    f.arrival?.scheduledTime?.local ??
    f.arrival?.scheduledTime?.utc ??
    '';

  let duration: string | undefined;
  if (depTime && arrTime) {
    const dep = new Date(depTime.replace(' ', 'T'));
    const arr = new Date(arrTime.replace(' ', 'T'));
    const diffMs = arr.getTime() - dep.getTime();
    if (diffMs > 0) {
      const hours = Math.floor(diffMs / 3_600_000);
      const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
      duration = `${hours}h ${minutes}m`;
    }
  }

  return {
    flightNumber: f.number ?? normalized,
    airline: f.airline?.name ?? '',
    departure: {
      airport: f.departure?.airport?.name ?? '',
      iata: f.departure?.airport?.iata ?? '',
      scheduledTime: depTime,
      terminal: f.departure?.terminal,
      gate: f.departure?.gate,
    },
    arrival: {
      airport: f.arrival?.airport?.name ?? '',
      iata: f.arrival?.airport?.iata ?? '',
      scheduledTime: arrTime,
      terminal: f.arrival?.terminal,
      gate: f.arrival?.gate,
    },
    status: f.status ?? 'Scheduled',
    duration,
    aircraft: f.aircraft?.model,
  };
}

function parseRawFlight(f: any, normalized: string): FlightInfo {
  const depTime: string = f.departure?.scheduledTime?.local ?? f.departure?.scheduledTime?.utc ?? '';
  const arrTime: string = f.arrival?.scheduledTime?.local ?? f.arrival?.scheduledTime?.utc ?? '';
  let duration: string | undefined;
  if (depTime && arrTime) {
    const dep = new Date(depTime.replace(' ', 'T'));
    const arr = new Date(arrTime.replace(' ', 'T'));
    const diffMs = arr.getTime() - dep.getTime();
    if (diffMs > 0) {
      const hours = Math.floor(diffMs / 3_600_000);
      const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
      duration = `${hours}h ${minutes}m`;
    }
  }
  return {
    flightNumber: f.number ?? normalized,
    airline: f.airline?.name ?? '',
    departure: { airport: f.departure?.airport?.name ?? '', iata: f.departure?.airport?.iata ?? '', scheduledTime: depTime, terminal: f.departure?.terminal, gate: f.departure?.gate },
    arrival:   { airport: f.arrival?.airport?.name   ?? '', iata: f.arrival?.airport?.iata   ?? '', scheduledTime: arrTime,  terminal: f.arrival?.terminal,  gate: f.arrival?.gate },
    status: f.status ?? 'Scheduled',
    duration,
    aircraft: f.aircraft?.model,
  };
}

export async function lookupAllFlights(
  flightNumber: string,
  date: string, // YYYY-MM-DD
): Promise<FlightInfo[]> {
  if (!RAPIDAPI_KEY) throw new Error('NO_KEY');
  const normalized = flightNumber.replace(/\s/g, '').toUpperCase();
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${normalized}/${date}`;
  const response = await fetch(url, { method: 'GET', headers: { 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY } });
  if (response.status === 204 || response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error(`API_ERROR_${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) throw new Error('NOT_FOUND');
  return data.map((f: any) => parseRawFlight(f, normalized));
}

export function formatFlightTime(dateTimeStr: string): string {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateTimeStr;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
