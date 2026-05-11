import { Flight } from '../data/mockData';

// Simple module-level store to pass data to DestinationDetailScreen
// without serializing through the native navigation bridge.
let _toCode = '';
let _toCity = '';
let _flights: Flight[] = [];

export const navStore = {
  set(toCode: string, toCity: string, flights: Flight[]) {
    _toCode = toCode;
    _toCity = toCity;
    _flights = flights;
  },
  get() {
    return { toCode: _toCode, toCity: _toCity, flights: _flights };
  },
};
