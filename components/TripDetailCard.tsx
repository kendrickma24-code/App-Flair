import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Animated, Easing,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { loadComments, addComment, Comment } from '../services/db';
import EditFlightModal from './EditFlightModal';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  flight: Flight;
  theme: Theme;
  isDark: boolean;
  isOwn?: boolean;
  currentUserName: string;
  currentUserInitials: string;
  onDelete?: () => void;
  onEdit?: (updates: { note: string; photos: string[]; status: 'upcoming' | 'past'; journal: string; journalPrivate: boolean }) => void;
}

export default function TripDetailCard({
  flight, theme, isDark, isOwn,
  currentUserName, currentUserInitials, onDelete, onEdit,
}: Props) {
  const f = flight;

  const [liked, setLiked] = useState(f.liked);
  const [likeCount, setLikeCount] = useState(f.likes);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showEdit, setShowEdit] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const heartScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (f.status !== 'live') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }

  async function openComments() {
    setShowComments(v => !v);
    if (!commentsLoaded) {
      setCommentsLoading(true);
      try {
        const data = await loadComments(f.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch {}
      setCommentsLoading(false);
    }
  }

  async function handlePostComment() {
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await addComment(f.id, currentUserName, currentUserInitials, text);
      setCommentText('');
      const updated = await loadComments(f.id);
      setComments(updated);
    } catch {}
    setPosting(false);
  }

  function renderBadge() {
    if (f.status === 'live') {
      return (
        <View style={[styles.badge, { backgroundColor: theme.liveBg }]}>
          <Animated.View style={[styles.pulseDot, { backgroundColor: theme.live, opacity: pulseAnim }]} />
          <Text style={[styles.badgeText, { color: theme.live }]}>LIVE</Text>
        </View>
      );
    }
    if (f.status === 'upcoming') {
      return (
        <View style={[styles.badge, { backgroundColor: theme.upcomingBg }]}>
          <Text style={[styles.badgeText, { color: theme.upcoming }]}>UPCOMING</Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, { backgroundColor: theme.pastBg }]}>
        <Text style={[styles.badgeText, { color: theme.past }]}>PAST</Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {/* User row */}
        <View style={styles.userRow}>
          <LinearGradient colors={f.user.avatarColors} style={styles.avatar}>
            <Text style={styles.avatarText}>{f.user.initials}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: theme.text }]}>{f.user.name}</Text>
            <Text style={[styles.userSub, { color: theme.textMuted }]}>
              {f.user.handle} · {f.timeAgo}
            </Text>
          </View>
          {isOwn && (
            <TouchableOpacity
              onPress={() =>
                Alert.alert(f.flightNum || 'Flight', undefined, [
                  { text: 'Edit', onPress: () => setShowEdit(true) },
                  {
                    text: 'Delete', style: 'destructive',
                    onPress: () =>
                      Alert.alert('Delete Flight', 'Move to Recently Deleted?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: onDelete },
                      ]),
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Photos */}
        {f.photos.length > 0 && (
          <View style={styles.photoContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
              }}
            >
              {f.photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
              ))}
            </ScrollView>
            {f.photos.length > 1 && (
              <View style={styles.dots}>
                {f.photos.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.photoDot, { backgroundColor: i === photoIndex ? '#fff' : 'rgba(255,255,255,0.45)' }]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Flight info */}
        <View style={styles.info}>
          {/* Route */}
          <View style={styles.routeRow}>
            <Text style={[styles.routeCode, { color: theme.text }]}>{f.from.code}</Text>
            <View style={styles.routeLine}>
              <View style={[styles.routeDash, { backgroundColor: theme.sep }]} />
              <Ionicons name="airplane" size={16} color={theme.accent} />
              <View style={[styles.routeDash, { backgroundColor: theme.sep }]} />
            </View>
            <Text style={[styles.routeCode, { color: theme.text }]}>{f.to.code}</Text>
          </View>
          {(f.from.city || f.to.city) && (
            <View style={styles.cityRow}>
              <Text style={[styles.cityText, { color: theme.textMuted }]}>{f.from.city}</Text>
              <Text style={[styles.cityText, { color: theme.textMuted }]}>{f.to.city}</Text>
            </View>
          )}

          {/* Meta */}
          <View style={styles.metaRow}>
            {f.flightNum ? <Text style={[styles.metaText, { color: theme.textSub }]}>{f.flightNum}</Text> : null}
            {f.flightNum ? <View style={[styles.metaDot, { backgroundColor: theme.textMuted }]} /> : null}
            <Text style={[styles.metaText, { color: theme.textMuted }]}>{f.date}</Text>
            {f.duration ? (
              <>
                <View style={[styles.metaDot, { backgroundColor: theme.textMuted }]} />
                <Text style={[styles.metaText, { color: theme.textMuted }]}>{f.duration}</Text>
              </>
            ) : null}
            {renderBadge()}
          </View>

          {f.note ? <Text style={[styles.note, { color: theme.textSub }]}>{f.note}</Text> : null}

          {/* Journal */}
          {f.journal && (!f.journalPrivate || isOwn) && (
            <View style={[styles.journalBlock, { backgroundColor: theme.inputBg }]}>
              <View style={styles.journalHeader}>
                <Ionicons
                  name={f.journalPrivate ? 'lock-closed' : 'book-outline'}
                  size={13}
                  color={theme.accent}
                />
                <Text style={[styles.journalLabel, { color: theme.accent }]}>
                  {f.journalPrivate ? 'Private Journal' : 'Journal'}
                </Text>
              </View>
              <Text style={[styles.journalText, { color: theme.textSub }]}>{f.journal}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={[styles.actions, { borderTopColor: theme.sep }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={liked ? theme.live : theme.textMuted}
                />
              </Animated.View>
              <Text style={[styles.actionText, { color: liked ? theme.live : theme.textMuted }]}>
                {likeCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={openComments}>
              <Ionicons
                name={showComments ? 'chatbubble' : 'chatbubble-outline'}
                size={19}
                color={showComments ? theme.accent : theme.textMuted}
              />
              <Text style={[styles.actionText, { color: showComments ? theme.accent : theme.textMuted }]}>
                {commentsLoaded ? comments.length : f.comments}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments (inline, shown when toggled) */}
        {showComments && (
          <View style={[styles.commentsSection, { borderTopColor: theme.sep }]}>
            {commentsLoading ? (
              <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 16 }} />
            ) : comments.length === 0 ? (
              <Text style={[styles.noComments, { color: theme.textMuted }]}>
                No comments yet — add one below
              </Text>
            ) : (
              comments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{c.authorInitials}</Text>
                  </LinearGradient>
                  <View style={styles.commentBubble}>
                    <View style={styles.commentMeta}>
                      <Text style={[styles.commentAuthor, { color: theme.text }]}>{c.authorName}</Text>
                      <Text style={[styles.commentTime, { color: theme.textMuted }]}>{c.timeAgo}</Text>
                    </View>
                    <Text style={[styles.commentText, { color: theme.textSub }]}>{c.text}</Text>
                  </View>
                </View>
              ))
            )}

            {/* Comment input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.inputRow, { borderTopColor: theme.sep }]}>
                <LinearGradient colors={['#667eea', '#764ba2']} style={styles.inputAvatar}>
                  <Text style={styles.inputAvatarText}>{currentUserInitials}</Text>
                </LinearGradient>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text }]}
                  placeholder="Add a comment…"
                  placeholderTextColor={theme.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={handlePostComment}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: commentText.trim() ? theme.accent : theme.surface }]}
                  onPress={handlePostComment}
                  disabled={!commentText.trim() || posting}
                >
                  {posting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={15} color={commentText.trim() ? '#fff' : theme.textMuted} />
                  }
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </View>

      {/* Separator */}
      <View style={[styles.sep, { backgroundColor: theme.sep }]} />

      <EditFlightModal
        flight={f}
        visible={showEdit}
        theme={theme}
        onClose={() => setShowEdit(false)}
        onSave={updates => { setShowEdit(false); onEdit?.(updates); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { paddingBottom: 4 },
  sep: { height: 8 },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '700' },
  userSub: { fontSize: 12, marginTop: 1 },

  photoContainer: { width: SCREEN_W, height: SCREEN_W * 0.72 },
  photo: { width: SCREEN_W, height: SCREEN_W * 0.72 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  photoDot: { width: 6, height: 6, borderRadius: 3 },

  info: { paddingHorizontal: 16, paddingTop: 14 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  routeCode: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeDash: { flex: 1, height: 1 },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cityText: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  metaText: { fontSize: 13, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, lineHeight: 13, includeFontPadding: false },
  note: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  journalBlock: { borderRadius: 12, padding: 12, marginBottom: 10 },
  journalHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  journalLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  journalText: { fontSize: 14, lineHeight: 21 },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    paddingTop: 10, borderTopWidth: 0.5, marginTop: 8, paddingBottom: 8,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 14, fontWeight: '600' },

  commentsSection: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 0.5 },
  noComments: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  commentAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  commentBubble: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 19 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingTop: 10, paddingBottom: 14, borderTopWidth: 0.5, marginTop: 8,
  },
  inputAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  inputAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, maxHeight: 80,
  },
  sendBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
});
