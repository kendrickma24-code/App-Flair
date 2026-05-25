import { SearchUser } from '../services/db';

let _user: SearchUser | null = null;

export const userProfileStore = {
  set(user: SearchUser) { _user = user; },
  get(): SearchUser | null { return _user; },
};
