import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, StatusBar,
  ScrollView, Image, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Animated, Easing, Dimensions,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/theme';
import { Flight } from '../data/mockData';
import { loadComments, addComment, Comment } from '../services/db';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  flight: Flight | null;
  visible: boolean;
  theme: Theme;
  isDark: boolean;
  currentUserName: string;
  currentUserInitials: string;
  isOwn?: boolean;
  initialPhotoIndex?: number;
  scrollToComments?: boolean;
  onClose: () => void;
  onLike?: () => void;
  onCommentCountChange?: (count: number) => void;
  onEditPress?: () => void;
  onDeletePress?: () => void;
}

export default function FlightDetailModal({
  flight, visible, theme, isDark, currentUserName, currentUserInitials, isOwn, initialPhotoIndex = 0, scrollToComments, onClose, onLike, onCommentCountChange, onEditPress, onDeletePress,
}: Props) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const heartScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!flight) return;
    setLiked(flight.liked);
    setLikeCount(flight.likes);
    setPhotoIndex(initialPhotoIndex);

    if (flight.status === 'live') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    }
  }, [flight?.id]);

  useEffect(() => {
    if (!visible || !flight) return;
    setCommentsLoading(true);
    loadComments(flight.id)
      .then(data => {
        setComments(data);
        onCommentCountChange?.(data.length);
        if (scrollToComments) {
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
        }
      })
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [visible, flight?.id]);

  if (!flight) return null;
  const f = flight;

  function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : c - 1);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onLike?.();
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
      onCommentCountChange?.(updated.length);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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

  const hasPhotos = f.photos.length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={["top","bottom"]} style={[styles.safe, { backgroundColor: theme.bg }]}>


        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.sep }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="chevron-down" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Flight</Text>
          {isOwn ? (
            <TouchableOpacity style={styles.closeBtn} onPress={() => {
              Alert.alert(f.flightNum || 'Flight', undefined, [
                { text: 'Edit', onPress: onEditPress },
                { text: 'Delete', style: 'destructive', onPress: () => {
                  Alert.alert('Delete Flight', 'Are you sure you want to delete this flight? It will be moved to Recently Deleted.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: onDeletePress },
                  ]);
                }},
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
            </View>

            {/* Photos */}
            {hasPhotos && (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  contentOffset={{ x: photoIndex * SCREEN_W, y: 0 }}
                  onMomentumScrollEnd={e => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                    setPhotoIndex(index);
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
                        style={[
                          styles.dot,
                          { backgroundColor: i === photoIndex ? '#fff' : 'rgba(255,255,255,0.45)' },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Flight info */}
            <View style={styles.infoSection}>
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

              {f.note ? (
                <Text style={[styles.note, { color: theme.textSub }]}>{f.note}</Text>
              ) : null}

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
                <View style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={19} color={theme.textMuted} />
                  <Text style={[styles.actionText, { color: theme.textMuted }]}>{comments.length}</Text>
                </View>
              </View>
            </View>

            {/* Comments */}
            <View style={[styles.commentsSection, { borderTopColor: theme.sep }]}>
              <Text style={[styles.commentsTitle, { color: theme.text }]}>Comments</Text>

              {commentsLoading ? (
                <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 16 }} />
              ) : comments.length === 0 ? (
                <Text style={[styles.noComments, { color: theme.textMuted }]}>
                  No comments yet. Be the first!
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
              <View style={{ height: 16 }} />
            </View>
          </ScrollView>

          {/* Comment input */}
          <View style={[styles.inputRow, { backgroundColor: theme.card, borderTopColor: theme.sep }]}>
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
              {posting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color={commentText.trim() ? '#fff' : theme.textMuted} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 0.5,
  },
  closeBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '700' },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '700' },
  userSub: { fontSize: 12, marginTop: 1 },

  photo: { width: SCREEN_W, height: SCREEN_W * 0.75 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  infoSection: { paddingHorizontal: 16, paddingTop: 16 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  routeCode: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  routeLine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeDash: { flex: 1, height: 1 },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cityText: { fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  metaText: { fontSize: 13, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start',
  },
  pulseDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, lineHeight: 13, includeFontPadding: false },
  note: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    paddingTop: 12, borderTopWidth: 0.5, marginTop: 12, paddingBottom: 4,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 14, fontWeight: '600' },

  commentsSection: { paddingHorizontal: 16, paddingTop: 16, borderTopWidth: 0.5 },
  commentsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  noComments: { fontSize: 14, fontWeight: '500', textAlign: 'center', paddingVertical: 20 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  commentAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  commentBubble: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 19 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5,
  },
  inputAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  inputAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, maxHeight: 80,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', marginBottom: 1,
  },
});
