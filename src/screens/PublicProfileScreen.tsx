import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { socialApi, PublicProfile, GridPost } from '../services/socialApi';
import type { RootTabParamList } from '../navigation/TabNavigator';

type RouteParams = RouteProp<RootTabParamList, 'PublicProfile'>;

const GRID_COLS = 3;
const THUMB_SIZE = (SCREEN_WIDTH - StyleSheet.hairlineWidth * 2) / GRID_COLS;

// ── Stat chip ──────────────────────────────────────────────────────────────────

const Stat: React.FC<{ value: number | string; label: string }> = ({ value, label }) => {
  const colors = useThemeColors();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
};

// ── Screen ─────────────────────────────────────────────────────────────────────

export const PublicProfileScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteParams>();
  const { user: me } = useAuth();
  const targetId = route.params?.userId ?? '';

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersDelta, setFollowersDelta] = useState(0); // optimistic offset
  const [followLoading, setFollowLoading] = useState(false);

  // ── Profile query — 60 s stale time ──────────────────────────────────────
  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: ['public-profile', targetId],
    queryFn: () => socialApi.getProfile(targetId),
    staleTime: 60_000,
    enabled: !!targetId,
  });

  const profile: PublicProfile | undefined = profileData?.user;

  // Sync follow state once profile loads
  useEffect(() => {
    if (profile) {
      setIsFollowing(profile.isFollowing);
      setFollowersDelta(0);
    }
  }, [profile?.isFollowing]);

  // ── Post grid — infinite query ────────────────────────────────────────────
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: postsLoading,
  } = useInfiniteQuery({
    queryKey: ['profile-posts', targetId],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      socialApi.getUserPosts(targetId, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
    enabled: !!targetId,
  });

  const posts: GridPost[] = postsData?.pages.flatMap(p => p.posts) ?? [];

  // ── Follow toggle ─────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!me) return;
    setFollowLoading(true);
    // Optimistic update
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersDelta(prev => wasFollowing ? prev - 1 : prev + 1);
    try {
      const res = await socialApi.toggleFollow(targetId);
      setIsFollowing(res.following);
      setFollowersDelta(res.following
        ? (profile?.isFollowing ? 0 : 1)
        : (profile?.isFollowing ? -1 : 0)
      );
    } catch {
      // Rollback
      setIsFollowing(wasFollowing);
      setFollowersDelta(prev => wasFollowing ? prev + 1 : prev - 1);
      Alert.alert(t('common.error'), t('social.followFailed'));
    } finally {
      setFollowLoading(false);
    }
  };

  const isOwnProfile = me?._id === targetId;

  // ── List header: avatar + stats + follow button ───────────────────────────
  const renderHeader = () => {
    if (!profile) return null;
    const displayFollowers = (profile.followersCount ?? 0) + followersDelta;

    return (
      <View style={styles.profileHeader}>
        {/* Avatar */}
        <View style={[styles.avatarWrap, { backgroundColor: colors.primarySoft }]}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={scale(36)} color={colors.primary} />
          )}
        </View>

        {/* Name + creator badge */}
        <View style={styles.nameWrap}>
          <Text style={[styles.displayName, { color: colors.textPrimary }]}>
            {profile.name}
          </Text>
          {profile.isCreator && (
            <View style={[styles.creatorBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="checkmark" size={scale(9)} color="#fff" />
              <Text style={[styles.creatorLabel, { color: '#fff' }]}>
                {t('social.creator')}
              </Text>
            </View>
          )}
        </View>

        {profile.username ? (
          <Text style={[styles.handle, { color: colors.textMuted }]}>
            @{profile.username}
          </Text>
        ) : null}

        {profile.bio ? (
          <Text style={[styles.bio, { color: colors.textSecondary }]}>
            {profile.bio}
          </Text>
        ) : null}

        {/* Stats row */}
        <View style={[styles.statsRow, { borderColor: colors.borderSubtle }]}>
          <Stat value={profile.postsCount} label={t('social.posts')} />
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <Stat value={displayFollowers} label={t('social.followers')} />
          <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
          <Stat value={profile.followingCount ?? 0} label={t('social.following')} />
        </View>

        {/* Follow / Edit button */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={[
              styles.followBtn,
              {
                backgroundColor: isFollowing ? 'transparent' : colors.primary,
                borderColor: isFollowing ? colors.borderSubtle : colors.primary,
              },
            ]}
            onPress={handleFollow}
            disabled={followLoading}
            activeOpacity={0.85}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? colors.textMuted : '#fff'} />
            ) : (
              <Text
                style={[
                  styles.followBtnText,
                  { color: isFollowing ? colors.textPrimary : '#fff' },
                ]}
              >
                {isFollowing ? t('social.following') : t('social.follow')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Grid label */}
        <View style={[styles.gridLabelRow, { borderTopColor: colors.divider, borderBottomColor: colors.divider }]}>
          <Ionicons name="grid-outline" size={scale(16)} color={colors.textMuted} />
        </View>
      </View>
    );
  };

  const renderThumb = useCallback(({ item }: ListRenderItemInfo<GridPost>) => (
    <View style={[styles.thumb, { borderColor: colors.background }]}>
      <Image source={{ uri: item.imageUrl }} style={styles.thumbImg} resizeMode="cover" />
      {item.likesCount > 0 && (
        <View style={styles.thumbLikes}>
          <Ionicons name="heart" size={scale(10)} color="#fff" />
          <Text style={styles.thumbLikeCount}>{item.likesCount}</Text>
        </View>
      )}
    </View>
  ), [colors.background]);

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (profileLoading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (profileError || !profile) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>
          {t('social.profileNotFound')}
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLinkBtn}>
          <Text style={[styles.backLink, { color: colors.primary }]}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Back button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + verticalScale(8) }]}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={scale(22)} color={colors.textPrimary} />
      </TouchableOpacity>

      <FlatList
        data={posts}
        keyExtractor={item => item._id}
        renderItem={renderThumb}
        numColumns={GRID_COLS}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        contentContainerStyle={{ paddingBottom: insets.bottom + verticalScale(40) }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          postsLoading ? null : (
            <View style={styles.emptyGrid}>
              <Ionicons name="images-outline" size={scale(36)} color={colors.textMuted} />
              <Text style={[styles.emptyGridText, { color: colors.textMuted }]}>
                {t('social.noPosts')}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },

  backBtn: {
    position: 'absolute',
    left: scale(16),
    zIndex: 10,
    width: scale(36),
    height: scale(36),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingTop: verticalScale(60),
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
  },
  avatarWrap: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: verticalScale(12),
  },
  avatarImg: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: verticalScale(4),
  },
  displayName: {
    fontSize: scale(18),
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
    paddingHorizontal: scale(7),
    paddingVertical: verticalScale(3),
    borderRadius: scale(10),
  },
  creatorLabel: {
    fontSize: scale(9),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  handle: {
    fontSize: scale(13),
    marginBottom: verticalScale(8),
  },
  bio: {
    fontSize: scale(13),
    textAlign: 'center',
    lineHeight: scale(18),
    marginBottom: verticalScale(16),
    paddingHorizontal: scale(8),
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: scale(14),
    paddingVertical: verticalScale(14),
    width: '100%',
    marginBottom: verticalScale(14),
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: {
    fontSize: scale(18),
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: scale(9),
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: verticalScale(3),
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, height: verticalScale(24) },

  followBtn: {
    width: '100%',
    paddingVertical: verticalScale(12),
    borderRadius: scale(12),
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: verticalScale(20),
  },
  followBtnText: {
    fontSize: scale(14),
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  gridLabelRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: verticalScale(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Post grid
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  thumbImg: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  thumbLikes: {
    position: 'absolute',
    bottom: scale(6),
    left: scale(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(3),
  },
  thumbLikeCount: {
    color: '#fff',
    fontSize: scale(10),
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  footerLoader: { paddingVertical: verticalScale(20), alignItems: 'center' },

  emptyGrid: {
    alignItems: 'center',
    paddingTop: verticalScale(40),
    gap: verticalScale(10),
  },
  emptyGridText: {
    fontSize: scale(13),
    fontWeight: '400',
  },

  errorText: { fontSize: scale(15), marginBottom: verticalScale(12) },
  backLinkBtn: { paddingVertical: verticalScale(8) },
  backLink: { fontSize: scale(14), fontWeight: '600' },
});

export default PublicProfileScreen;
