export type FlightStatus = 'live' | 'upcoming' | 'past';

export interface FlightUser {
  name: string;
  handle: string;
  avatarColors: [string, string];
  initials: string;
}

export interface Flight {
  id: string;
  userId: string;
  user: FlightUser;
  from: { code: string; city: string };
  to: { code: string; city: string };
  flightNum: string;
  date: string;
  duration: string;
  status: FlightStatus;
  note?: string;
  airportMinutes?: number;
  journal?: string;
  journalPrivate?: boolean;
  photos: string[]; // real photo URIs
  likes: number;
  comments: number;
  liked: boolean;
  timeAgo: string;
  privacy?: 'public' | 'followers' | 'private';
}

// The logged-in user
export const MY_USER: FlightUser = {
  name: 'Kendrick Ma',
  handle: '@kendrick',
  avatarColors: ['#667eea', '#764ba2'],
  initials: 'K',
};

// Starts empty — flights are added by the user
export const MOCK_FLIGHTS: Flight[] = [];

export const PROFILE_FLIGHTS = [
  { id: 'p1', from: 'SFO', to: 'NRT', airline: 'UA 837', date: 'Apr 9, 2026', status: 'upcoming' as FlightStatus },
  { id: 'p2', from: 'JFK', to: 'LAX', airline: 'DL 1', date: 'Mar 22, 2026', status: 'past' as FlightStatus },
  { id: 'p3', from: 'LAX', to: 'CDG', airline: 'AA 72', date: 'Feb 14, 2026', status: 'past' as FlightStatus },
  { id: 'p4', from: 'ORD', to: 'YYZ', airline: 'AC 8820', date: 'Jan 30, 2026', status: 'past' as FlightStatus },
  { id: 'p5', from: 'SEA', to: 'HNL', airline: 'HA 6', date: 'Dec 20, 2025', status: 'past' as FlightStatus },
  { id: 'p6', from: 'SFO', to: 'BKK', airline: 'TG 608', date: 'Nov 8, 2025', status: 'past' as FlightStatus },
];

export const PROFILE_PHOTOS: { colors: [string, string]; label: string }[] = [
  { colors: ['#667eea', '#764ba2'], label: 'Tokyo' },
  { colors: ['#4facfe', '#00f2fe'], label: 'Okinawa' },
  { colors: ['#f093fb', '#f5576c'], label: 'Paris' },
  { colors: ['#f77062', '#fe5196'], label: 'Miami' },
  { colors: ['#43e97b', '#38f9d7'], label: 'Honolulu' },
  { colors: ['#c471ed', '#12c2e9'], label: 'Bangkok' },
  { colors: ['#fa709a', '#fee140'], label: 'LAX→CDG' },
  { colors: ['#30cfd0', '#330867'], label: 'Toronto' },
  { colors: ['#2af598', '#009efd'], label: 'New York' },
  { colors: ['#ffecd2', '#fcb69f'], label: 'Chicago' },
  { colors: ['#a18cd1', '#fbc2eb'], label: 'Seattle' },
  { colors: ['#fddb92', '#d1fdff'], label: 'Vancouver' },
];

export const AIRLINES = [
  { code: 'UA', name: 'United Airlines', color: '#005DAA' },
  { code: 'AA', name: 'American Airlines', color: '#C70025' },
  { code: 'DL', name: 'Delta Air Lines', color: '#E01933' },
  { code: 'WN', name: 'Southwest Airlines', color: '#304CB2' },
  { code: 'AS', name: 'Alaska Airlines', color: '#00458B' },
  { code: 'B6', name: 'JetBlue Airways', color: '#003876' },
  { code: 'NK', name: 'Spirit Airlines', color: '#FFEC00' },
  { code: 'F9', name: 'Frontier Airlines', color: '#008000' },
  { code: 'G4', name: 'Allegiant Air', color: '#FF6600' },
  { code: 'SY', name: 'Sun Country Airlines', color: '#FDB913' },
];
