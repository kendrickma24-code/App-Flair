import { supabase } from '../lib/supabase';
import { Flight, FlightStatus } from '../data/mockData';
import { UserProfile } from '../App';
import * as ImageManipulator from 'expo-image-manipulator';

// ── Helpers ───────────────────────────────────────────────────────────

function resolveStatus(dateStr: string, storedStatus: string): FlightStatus {
  if (storedStatus === 'live') return 'live';
  // dateStr is DD-MM-YYYY
  const parts = dateStr?.split('-');
  if (!parts || parts.length !== 3) return storedStatus as FlightStatus;
  const flightDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return flightDate < today ? 'past' : 'upcoming';
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function compressPhoto(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

async function uploadFile(uri: string, bucket: string, path: string): Promise<string> {
  if (uri.startsWith('http')) return uri; // already a remote URL

  const compressed = await compressPhoto(uri);

  // ArrayBuffer is more reliable than blob() in React Native
  const response = await fetch(compressed);
  if (!response.ok) throw new Error(`Could not read photo file (status ${response.status})`);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

  if (error) {
    console.error(`[uploadFile] bucket=${bucket} path=${path} error:`, JSON.stringify(error));
    throw new Error(`Photo upload failed: ${error.message} (${error.statusCode ?? ''})`);
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  console.log(`[uploadFile] uploaded → ${publicUrl}`);
  return publicUrl;
}

// ── Profile ───────────────────────────────────────────────────────────

export async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return {
    id: userId,
    name: data.full_name ?? '',
    username: data.username ?? '',
    bio: data.bio ?? '',
    avatarUri: data.avatar_url ?? null,
    isPrivate: data.is_private ?? false,
  };
}

export interface SearchUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  followStatus: 'none' | 'pending' | 'accepted';
}

export async function findContactsOnFlare(emails: string[], currentUserId: string): Promise<SearchUser[]> {
  if (!emails.length) return [];
  const { data, error } = await supabase.rpc('find_contacts_on_flare', {
    p_emails: emails.slice(0, 500), // cap to avoid oversized requests
    p_current_user_id: currentUserId,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    username: r.username ?? '',
    fullName: r.full_name ?? '',
    avatarUrl: r.avatar_url ?? null,
    isPrivate: r.is_private ?? false,
    followStatus: r.follow_status ?? 'none',
  }));
}

export async function searchUsers(query: string, currentUserId: string): Promise<SearchUser[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc('search_users', {
    p_query: query.trim(),
    p_current_user_id: currentUserId,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    username: r.username ?? '',
    fullName: r.full_name ?? '',
    avatarUrl: r.avatar_url ?? null,
    isPrivate: r.is_private ?? false,
    followStatus: r.follow_status ?? 'none',
  }));
}

export async function sendFollowRequest(currentUserId: string, targetUserId: string): Promise<string> {
  const { data, error } = await supabase.rpc('send_follow_request', {
    p_follower_id: currentUserId,
    p_following_id: targetUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  const { error } = await supabase.rpc('unfollow_user', {
    p_follower_id: currentUserId,
    p_following_id: targetUserId,
  });
  if (error) throw error;
}

export async function getFollowers(userId: string, viewerId: string): Promise<SearchUser[]> {
  const { data, error } = await supabase.rpc('get_followers', { p_user_id: userId, p_viewer_id: viewerId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, username: r.username ?? '', fullName: r.full_name ?? '',
    avatarUrl: r.avatar_url ?? null, isPrivate: r.is_private ?? false,
    followStatus: r.follow_status ?? 'none',
  }));
}

export async function getFollowing(userId: string, viewerId: string): Promise<SearchUser[]> {
  const { data, error } = await supabase.rpc('get_following', { p_user_id: userId, p_viewer_id: viewerId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, username: r.username ?? '', fullName: r.full_name ?? '',
    avatarUrl: r.avatar_url ?? null, isPrivate: r.is_private ?? false,
    followStatus: r.follow_status ?? 'none',
  }));
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
  ]);
  return {
    followers: followersRes.count ?? 0,
    following: followingRes.count ?? 0,
  };
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  // Upload avatar if it's a local file
  let avatarUrl = profile.avatarUri;
  if (avatarUrl && !avatarUrl.startsWith('http')) {
    avatarUrl = await uploadFile(avatarUrl, 'avatars', `${profile.id}/avatar.jpg`);
  }

  const { error } = await supabase.rpc('upsert_profile', {
    user_id: profile.id,
    full_name: profile.name,
    username: profile.username,
    bio: profile.bio,
    avatar_url: avatarUrl,
    is_private: profile.isPrivate ?? false,
  });
  if (error) throw error;
}

// ── Flights ───────────────────────────────────────────────────────────

export async function loadFlights(userId: string, profile: UserProfile): Promise<Flight[]> {
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const user = {
    name: profile.name || profile.username || 'You',
    handle: `@${profile.username}`,
    avatarColors: ['#667eea', '#764ba2'] as [string, string],
    initials: (profile.name || profile.username || '?')[0]?.toUpperCase() ?? '?',
    avatarUrl: profile.avatarUri ?? null,
  };

  return (data ?? []).map(r => {
    const rawPhotos = r.photos;
    const photos = Array.isArray(rawPhotos) ? rawPhotos.filter((p: any) => p && typeof p === 'string' && p.startsWith('http')) : [];
    return ({
    id: r.id,
    userId: r.user_id,
    user,
    from: { code: r.from_code, city: r.from_city ?? '' },
    to:   { code: r.to_code,   city: r.to_city   ?? '' },
    flightNum: r.flight_num ?? '',
    date:      r.date       ?? '',
    duration:  r.duration   ?? '',
    status:         resolveStatus(r.date, r.status),
    note:           r.note ?? undefined,
    journal:        r.journal ?? undefined,
    journalPrivate: r.journal_private ?? true,
    airportMinutes: r.airport_minutes ?? undefined,
    photos,
    timeAgo: timeAgo(r.created_at),
  });});
}

// Avatar color pairs cycled by index for other users
const AVATAR_GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#ffecd2', '#fcb69f'],
  ['#89f7fe', '#66a6ff'],
];

export async function loadFeedFlights(currentUserId: string): Promise<Flight[]> {
  // Step 1: get following IDs
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .eq('status', 'accepted');

  const followingIds = (followData ?? []).map((r: any) => r.following_id as string);
  const feedUserIds = [currentUserId, ...followingIds];

  // Step 2: fetch flights
  const { data: flightData, error: flightError } = await supabase
    .from('flights')
    .select('*')
    .in('user_id', feedUserIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(150);

  if (flightError) throw flightError;

  // Step 3: fetch profiles for all unique user_ids
  const uniqueUserIds = [...new Set((flightData ?? []).map((r: any) => r.user_id as string))];
  const { data: profileData } = uniqueUserIds.length
    ? await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', uniqueUserIds)
    : { data: [] };
  const profileMap = new Map((profileData ?? []).map((p: any) => [p.id, p]));

  // Track avatar color index per user so the same user always gets the same gradient
  const userColorIndex = new Map<string, number>();
  let colorCounter = 0;

  return (flightData ?? []).map(r => {
    const profile = profileMap.get(r.user_id) as any;
    const name = profile?.full_name || profile?.username || 'Flair User';
    const username = profile?.username || '';

    if (!userColorIndex.has(r.user_id)) {
      userColorIndex.set(r.user_id, colorCounter % AVATAR_GRADIENTS.length);
      colorCounter++;
    }
    const avatarColors = AVATAR_GRADIENTS[userColorIndex.get(r.user_id)!];

    const rawPhotos = r.photos;
    const photos = Array.isArray(rawPhotos)
      ? rawPhotos.filter((p: any) => p && typeof p === 'string' && p.startsWith('http'))
      : [];

    return {
      id: r.id,
      userId: r.user_id,
      user: {
        name,
        handle: username ? `@${username}` : '',
        avatarColors,
        initials: name[0]?.toUpperCase() ?? '?',
        avatarUrl: profile?.avatar_url ?? null,
      },
      from: { code: r.from_code, city: r.from_city ?? '' },
      to:   { code: r.to_code,   city: r.to_city   ?? '' },
      flightNum: r.flight_num ?? '',
      date:      r.date       ?? '',
      duration:  r.duration   ?? '',
      status:         resolveStatus(r.date, r.status),
      note:           r.note ?? undefined,
      journal:        r.journal ?? undefined,
      journalPrivate: r.journal_private ?? true,
      airportMinutes: r.airport_minutes ?? undefined,
      photos,
      timeAgo:  timeAgo(r.created_at),
    };
  });
}

export async function saveFlight(flight: Flight, userId: string): Promise<Flight> {
  // Upload any local photos to storage
  const photos = await Promise.all(
    flight.photos.map((uri, i) =>
      uploadFile(uri, 'trip-photos', `${userId}/${flight.id}/${i}.jpg`),
    ),
  );

  const { error } = await supabase.rpc('insert_flight', {
    p_id:        flight.id,
    p_user_id:   userId,
    p_from_code: flight.from.code,
    p_from_city: flight.from.city,
    p_to_code:   flight.to.code,
    p_to_city:   flight.to.city,
    p_flight_num: flight.flightNum,
    p_date:      flight.date,
    p_duration:  flight.duration,
    p_status:    flight.status,
    p_note:            flight.note ?? null,
    p_journal:         flight.journal ?? null,
    p_journal_private: flight.journalPrivate ?? true,
    p_photos:          photos,
  });
  if (error) throw error;

  // Use a SECURITY DEFINER RPC to save photos — bypasses RLS and avoids
  // array serialization issues in the Supabase JS client
  if (photos.length > 0) {
    const { error: photoError } = await supabase.rpc('set_flight_photos', {
      p_flight_id: flight.id,
      p_user_id:   userId,
      p_photos:    JSON.stringify(photos),
    });
    if (photoError) console.error('[saveFlight] set_flight_photos error:', JSON.stringify(photoError));
  }

  return { ...flight, photos };
}

export async function updateFlight(
  flightId: string,
  userId: string,
  updates: { note: string; photos: string[]; status: string; journal?: string; journalPrivate?: boolean; fromCode?: string; fromCity?: string; toCode?: string; toCity?: string; flightNum?: string; date?: string; duration?: string },
): Promise<string[]> {
  // Upload any new local photos
  const photos = await Promise.all(
    updates.photos.map((uri, i) =>
      uploadFile(uri, 'trip-photos', `${userId}/${flightId}/${i}.jpg`),
    ),
  );

  const { error } = await supabase.rpc('update_flight', {
    p_id:              flightId,
    p_user_id:         userId,
    p_note:            updates.note || null,
    p_photos:          null,   // photos handled separately by set_flight_photos
    p_status:          updates.status,
    p_journal:         updates.journal ?? null,
    p_journal_private: updates.journalPrivate ?? true,
  });
  if (error) throw error;

  // Persist route/flight-detail changes if provided
  const routeChanges: Record<string, string> = {};
  if (updates.fromCode)  routeChanges.from_code  = updates.fromCode;
  if (updates.fromCity !== undefined) routeChanges.from_city = updates.fromCity;
  if (updates.toCode)    routeChanges.to_code    = updates.toCode;
  if (updates.toCity !== undefined)   routeChanges.to_city   = updates.toCity;
  if (updates.flightNum !== undefined) routeChanges.flight_num = updates.flightNum;
  if (updates.date)      routeChanges.date       = updates.date;
  if (updates.duration !== undefined) routeChanges.duration   = updates.duration;
  if (Object.keys(routeChanges).length > 0) {
    await supabase.from('flights').update(routeChanges).eq('id', flightId).eq('user_id', userId);
  }

  // Always sync photos via SECURITY DEFINER RPC (handles add, replace, and clear)
  const { error: photoError } = await supabase.rpc('set_flight_photos', {
    p_flight_id: flightId,
    p_user_id:   userId,
    p_photos:    JSON.stringify(photos),
  });
  if (photoError) console.error('[updateFlight] set_flight_photos error:', JSON.stringify(photoError));

  return photos;
}

export async function updateFlightPrivacy(
  flightId: string,
  userId: string,
  privacy: 'public' | 'followers' | 'private',
): Promise<void> {
  const { error } = await supabase
    .from('flights')
    .update({ privacy })
    .eq('id', flightId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function softDeleteFlight(flightId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_flight', {
    p_id: flightId, p_user_id: userId,
  });
  if (error) throw error;
}

export async function restoreFlight(flightId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_flight', {
    p_id: flightId, p_user_id: userId,
  });
  if (error) throw error;
}

export async function deleteFlight(flightId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_flight', {
    p_id: flightId, p_user_id: userId,
  });
  if (error) throw error;
}

// ── Reports ──────────────────────────────────────────────────────────

export async function reportContent(
  contentType: 'flight',
  contentId: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.rpc('report_content', {
    p_reporter_id: user.id,
    p_content_type: contentType,
    p_content_id: contentId,
  });
  if (error && !error.message.includes('already reported')) throw error;
}

export interface Notification {
  id: string;
  type: 'same_flight' | 'new_follower';
  authorName: string;
  authorInitials: string;
  authorAvatarUrl?: string | null;
  authorUsername?: string;
  // same_flight only
  fromCode?: string;
  toCode?: string;
  flightId?: string;
  createdAt: string;
  timeAgo: string;
}

export async function loadNotifications(userId: string): Promise<Notification[]> {
  const [flightNotifsRes, followsRes] = await Promise.all([
    supabase
      .from('flight_notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('follows')
      .select('id, follower_id, created_at, profiles!follows_follower_id_fkey(username, full_name, avatar_url)')
      .eq('following_id', userId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(60),
  ]);

  const flightNotifs: Notification[] = (flightNotifsRes.data ?? []).map((r: any) => ({
    id: r.id,
    type: 'same_flight' as const,
    authorName: r.actor_name ?? 'Someone',
    authorInitials: r.actor_initials ?? '?',
    fromCode: r.from_code ?? '',
    toCode: r.to_code ?? '',
    flightId: r.flight_id,
    createdAt: r.created_at,
    timeAgo: timeAgo(r.created_at),
  }));

  const followNotifs: Notification[] = (followsRes.data ?? []).map((r: any) => {
    const profile = r.profiles as any;
    const name = profile?.full_name || profile?.username || 'Someone';
    return {
      id: `follow_${r.id}`,
      type: 'new_follower' as const,
      authorName: name,
      authorInitials: name[0]?.toUpperCase() ?? '?',
      authorAvatarUrl: profile?.avatar_url ?? null,
      authorUsername: profile?.username ?? '',
      createdAt: r.created_at,
      timeAgo: timeAgo(r.created_at),
    };
  });

  return [...flightNotifs, ...followNotifs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ── Same Route Users ─────────────────────────────────────────────────

export interface RouteUser {
  userId: string;
  name: string;
  username: string;
  initials: string;
  avatarUrl: string | null;
  flightDate: string;
  status: 'upcoming' | 'past' | 'live';
}

export async function getSameRouteUsers(
  fromCode: string, toCode: string, currentUserId: string,
): Promise<RouteUser[]> {
  const { data, error } = await supabase.rpc('get_same_route_users', {
    p_from_code: fromCode, p_to_code: toCode, p_current_user_id: currentUserId,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    name: r.full_name ?? '',
    username: r.username ?? '',
    initials: (r.full_name || r.username || '?')[0]?.toUpperCase() ?? '?',
    avatarUrl: r.avatar_url ?? null,
    flightDate: r.flight_date ?? '',
    status: r.status as 'upcoming' | 'past' | 'live',
  }));
}

// ── Push Notifications ────────────────────────────────────────────────

export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}

export async function sendPushToUser(
  recipientId: string, title: string, body: string,
): Promise<void> {
  const { data } = await supabase
    .from('profiles').select('push_token').eq('id', recipientId).single();
  if (!data?.push_token) return;
  fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: data.push_token, title, body, sound: 'default' }),
  }).catch(() => {});
}

// ── Flight Companions ─────────────────────────────────────────────────

export interface FlightCompanion {
  userId: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export async function addFlightCompanion(
  flightId: string, userId: string, actorName: string, actorInitials: string,
): Promise<void> {
  const { error } = await supabase.rpc('add_flight_companion', {
    p_flight_id: flightId, p_user_id: userId,
    p_actor_name: actorName, p_actor_initials: actorInitials,
  });
  if (error) throw error;
}

export async function removeFlightCompanion(flightId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_flight_companion', {
    p_flight_id: flightId, p_user_id: userId,
  });
  if (error) throw error;
}

export async function getFlightCompanions(flightId: string, viewerId: string): Promise<FlightCompanion[]> {
  const { data, error } = await supabase.rpc('get_flight_companions', {
    p_flight_id: flightId, p_viewer_id: viewerId,
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    name: r.name ?? '',
    initials: r.initials ?? '?',
    avatarUrl: r.avatar_url ?? null,
  }));
}

export async function loadDeletedFlights(userId: string, profile: UserProfile): Promise<Flight[]> {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Hard-delete anything older than 14 days
  await supabase.rpc('delete_flight', { p_id: '__purge__', p_user_id: userId }).maybeSingle();
  await supabase
    .from('flights')
    .delete()
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff);

  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoff)
    .order('deleted_at', { ascending: false });
  if (error) throw error;

  const user = {
    name: profile.name || profile.username || 'You',
    handle: `@${profile.username}`,
    avatarColors: ['#667eea', '#764ba2'] as [string, string],
    initials: (profile.name || profile.username || '?')[0]?.toUpperCase() ?? '?',
    avatarUrl: profile.avatarUri ?? null,
  };

  return (data ?? []).map(r => ({
    id: r.id,
    userId: r.user_id,
    user,
    from: { code: r.from_code, city: r.from_city ?? '' },
    to:   { code: r.to_code,   city: r.to_city   ?? '' },
    flightNum: r.flight_num ?? '',
    date:      r.date       ?? '',
    duration:  r.duration   ?? '',
    status:         r.status as any,
    note:           r.note ?? undefined,
    journal:        r.journal ?? undefined,
    journalPrivate: r.journal_private ?? true,
    photos:         r.photos ?? [],
    timeAgo: timeAgo(r.created_at),
    deletedAt: r.deleted_at as string,
  }));
}

// ── Follow Requests ───────────────────────────────────────────────────

export interface FollowRequest {
  id: string;
  followerId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  initials: string;
  timeAgo: string;
}

export async function loadFollowRequests(userId: string): Promise<FollowRequest[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('id, follower_id, created_at, profiles!follows_follower_id_fkey(username, full_name, avatar_url)')
    .eq('following_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const name: string = r.profiles?.full_name || r.profiles?.username || 'Unknown';
    return {
      id: r.id,
      followerId: r.follower_id,
      username: r.profiles?.username ?? '',
      fullName: r.profiles?.full_name ?? '',
      avatarUrl: r.profiles?.avatar_url ?? null,
      initials: name[0]?.toUpperCase() ?? '?',
      timeAgo: timeAgo(r.created_at),
    };
  });
}

export async function acceptFollowRequest(followId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .update({ status: 'accepted' })
    .eq('id', followId);
  if (error) throw error;
}

export async function declineFollowRequest(followId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('id', followId);
  if (error) throw error;
}
