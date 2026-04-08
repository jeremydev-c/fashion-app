import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ListRenderItemInfo,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { socialApi, Post, PostAuthor } from '../services/socialApi';

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

// ── Post Card (memoized to prevent re-renders on unrelated like updates) ───────

interface PostCardProps {
  post: Post;
  myUserId: string;
  onLike: (postId: string) => void;
  onAuthorPress: (userId: string) => void;
  onDelete: (postId: string) => void;
}

const PostCard = React.memo(({ post, myUserId, onLike, onAuthorPress, onDelete }: PostCardProps) => {
  const colors = useThemeColors();
  const author = post.userId;
  const isOwn = author._id === myUserId;

  return (
    <View style={[styles.card, { borderBottomColor: colors.divider }]}>
      {/* Author row */}
      <TouchableOpacity
        style={styles.authorRow}
        onPress={() => onAuthorPress(author._id)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarWrap, { backgroundColor: colors.primarySoft }]}>
          {author.avatar ? (
            <Image source={{ uri: author.avatar }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={scale(16)} color={colors.primary} />
          )}
        </View>

        <View style={styles.authorMeta}>
          <View style={styles.nameRow}>
            <Text style={[styles.authorName, { color: colors.textPrimary }]} numberOfLines={1}>
              {author.name}
            </Text>
            {author.isCreator && (
              <View style={[styles.creatorBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={scale(7)} color="#fff" />
              </View>
            )}
          </View>
          {author.username ? (
            <Text style={[styles.authorHandle, { color: colors.textMuted }]}>
              @{author.username}
            </Text>
          ) : null}
        </View>

        <Text style={[styles.postTime, { color: colors.textMuted }]}>
          {timeAgo(post.createdAt)}
        </Text>

        {isOwn && (
          <TouchableOpacity
            onPress={() => onDelete(post._id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: scale(6) }}
          >
            <Ionicons name="trash-outline" size={scale(15)} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Image */}
      <Image
        source={{ uri: post.imageUrl }}
        style={styles.postImage}
        resizeMode="cover"
      />

      {/* Like row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={() => onLike(post._id)}
          style={styles.likeBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={scale(22)}
            color={post.likedByMe ? '#E0245E' : colors.textMuted}
          />
          <Text style={[styles.likeCount, { color: colors.textSecondary }]}>
            {post.likesCount}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={[styles.captionAuthor, { color: colors.textPrimary }]}>
            {author.name}{' '}
          </Text>
          <Text style={[styles.captionText, { color: colors.textSecondary }]}>
            {post.caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

// ── Create Post Modal ──────────────────────────────────────────────────────────

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (post: Post) => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ visible, onClose, onSuccess }) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('social.permissionRequired'), t('social.photoPermissionMsg'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
    }
  };

  const handleShare = async () => {
    if (!imageBase64) {
      Alert.alert(t('social.noImageTitle'), t('social.noImageMsg'));
      return;
    }
    setUploading(true);
    try {
      const res = await socialApi.createPost({ imageBase64, caption: caption.trim() });
      onSuccess(res.post);
      setImageUri(null);
      setImageBase64(null);
      setCaption('');
      onClose();
    } catch {
      Alert.alert(t('common.error'), t('social.postFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setImageUri(null);
    setImageBase64(null);
    setCaption('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.modalRoot, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modal header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={scale(22)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {t('social.newPost')}
          </Text>
          <TouchableOpacity
            onPress={handleShare}
            disabled={!imageBase64 || uploading}
            style={[
              styles.shareBtn,
              { backgroundColor: imageBase64 && !uploading ? colors.primary : colors.borderSubtle },
            ]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.shareBtnText, { color: imageBase64 ? '#fff' : colors.textMuted }]}>
                {t('social.share')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Image picker area */}
        <TouchableOpacity
          style={[
            styles.imagePicker,
            { backgroundColor: colors.card, borderColor: colors.borderSubtle },
          ]}
          onPress={pickImage}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.pickedImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePickerPlaceholder}>
              <Ionicons name="image-outline" size={scale(40)} color={colors.textMuted} />
              <Text style={[styles.imagePickerHint, { color: colors.textMuted }]}>
                {t('social.tapToAddPhoto')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption input */}
        <View style={[styles.captionInputWrap, { borderColor: colors.borderSubtle }]}>
          <TextInput
            style={[styles.captionInput, { color: colors.textPrimary }]}
            placeholder={t('social.captionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={caption}
            onChangeText={text => setCaption(text.slice(0, 300))}
            multiline
            maxLength={300}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>
            {caption.length}/300
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────

type FeedTab = 'following' | 'explore';

export const SocialFeedScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [showCreate, setShowCreate] = useState(false);

  // ── Search state ─────────────────────────────────────────────────────────
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    clearTimeout(debounceTimer.current);
    // 400 ms debounce — fires ~10× fewer requests than typing speed
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 400);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setDebouncedQuery('');
    Keyboard.dismiss();
  }, []);

  // Only enabled when query ≥ 2 chars — avoids single-character DB scans
  // staleTime 60 s — same search won't re-fetch for a full minute
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['user-search', debouncedQuery],
    queryFn: () => socialApi.searchUsers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });
  const searchResults: PostAuthor[] = searchData?.users ?? [];

  // ── Infinite query: 30s stale time = won't refetch unless data is 30s old ──
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['social', activeTab],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      activeTab === 'following'
        ? socialApi.getFeed(pageParam)
        : socialApi.getExplore(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 30_000,      // 30 s cache — avoids hammering the API
    gcTime: 5 * 60_000,     // Keep in memory 5 min after unmount
  });

  const posts: Post[] = data?.pages.flatMap(p => p.posts) ?? [];

  // ── Like handler: local optimistic update + API call ──────────────────────
  const handleLike = useCallback(async (postId: string) => {
    // Optimistically flip the UI immediately
    queryClient.setQueryData(['social', activeTab], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          posts: page.posts.map((p: Post) =>
            p._id === postId
              ? {
                  ...p,
                  likedByMe: !p.likedByMe,
                  likesCount: p.likedByMe ? p.likesCount - 1 : p.likesCount + 1,
                }
              : p
          ),
        })),
      };
    });
    // Fire API call — one request per tap, no debounce needed
    try {
      await socialApi.toggleLike(postId);
    } catch {
      // On failure, invalidate to restore true state from server
      queryClient.invalidateQueries({ queryKey: ['social', activeTab] });
    }
  }, [activeTab, queryClient]);

  const handleAuthorPress = useCallback((userId: string) => {
    navigation.navigate('PublicProfile', { userId });
  }, [navigation]);

  const handleDelete = useCallback((postId: string) => {
    Alert.alert(t('social.deletePost'), t('social.deletePostConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await socialApi.deletePost(postId);
            queryClient.setQueryData(['social', activeTab], (old: any) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page: any) => ({
                  ...page,
                  posts: page.posts.filter((p: Post) => p._id !== postId),
                })),
              };
            });
          } catch {
            Alert.alert(t('common.error'), t('social.deleteFailed'));
          }
        },
      },
    ]);
  }, [activeTab, queryClient, t]);

  const handlePostCreated = useCallback((newPost: Post) => {
    // Prepend to both feed caches so it's immediately visible
    ['following', 'explore'].forEach(tab => {
      queryClient.setQueryData(['social', tab], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: [
            { posts: [newPost], nextCursor: old.pages[0]?.posts[0]?._id ?? null, hasMore: true },
            ...old.pages,
          ],
        };
      });
    });
  }, [queryClient]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<Post>) => (
    <PostCard
      post={item}
      myUserId={user?._id ?? ''}
      onLike={handleLike}
      onAuthorPress={handleAuthorPress}
      onDelete={handleDelete}
    />
  ), [user?._id, handleLike, handleAuthorPress, handleDelete]);

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="people-outline" size={scale(48)} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          {activeTab === 'following' ? t('social.emptyFeed') : t('social.emptyExplore')}
        </Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>
          {activeTab === 'following' ? t('social.emptyFeedSub') : t('social.emptyExploreSub')}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + verticalScale(12), borderBottomColor: colors.divider },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.brandText, { color: colors.primary }]}>COMMUNITY</Text>
          <TouchableOpacity
            onPress={() => searchActive ? closeSearch() : setSearchActive(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={searchActive ? 'close' : 'search'}
              size={scale(20)}
              color={searchActive ? colors.primary : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Search input — only rendered when active */}
        {searchActive && (
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            <Ionicons name="search-outline" size={scale(15)} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={t('common.search')}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoFocus
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={scale(15)} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tab switcher — hidden while searching */}
        {!searchActive && (
          <View style={[styles.tabSwitcher, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
            {(['following', 'explore'] as FeedTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabBtn,
                  activeTab === tab && { backgroundColor: colors.primary, borderRadius: scale(8) },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab ? '#fff' : colors.textMuted },
                  ]}
                >
                  {t(`social.tab_${tab}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Search results panel */}
      {searchActive && (
        <View style={[styles.searchResults, { backgroundColor: colors.background }]}>
          {debouncedQuery.length < 2 ? (
            <Text style={[styles.searchHint, { color: colors.textMuted }]}>
              {t('social.searchHint')}
            </Text>
          ) : searchLoading ? (
            <ActivityIndicator style={{ marginTop: verticalScale(24) }} color={colors.primary} />
          ) : searchResults.length === 0 ? (
            <Text style={[styles.searchHint, { color: colors.textMuted }]}>
              {t('common.noResults')}
            </Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={u => u._id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResultRow, { borderBottomColor: colors.divider }]}
                  onPress={() => { closeSearch(); navigation.navigate('PublicProfile', { userId: item._id }); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.searchAvatar, { backgroundColor: colors.primarySoft }]}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={styles.searchAvatarImg} />
                    ) : (
                      <Ionicons name="person" size={scale(16)} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.searchUserMeta}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.searchUserName, { color: colors.textPrimary }]}>
                        {item.name}
                      </Text>
                      {item.isCreator && (
                        <View style={[styles.creatorBadge, { backgroundColor: colors.primary }]}>
                          <Ionicons name="checkmark" size={scale(7)} color="#fff" />
                        </View>
                      )}
                    </View>
                    {item.username ? (
                      <Text style={[styles.searchUserHandle, { color: colors.textMuted }]}>
                        @{item.username}
                      </Text>
                    ) : null}
                  </View>
                  {(item.followersCount ?? 0) > 0 && (
                    <Text style={[styles.searchFollowers, { color: colors.textMuted }]}>
                      {item.followersCount} {t('social.followers')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Feed — hidden while search panel is open */}
      {!searchActive && isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !searchActive && isError ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('common.error')}</Text>
          <TouchableOpacity onPress={() => refetch()} style={[styles.retryBtn, { borderColor: colors.borderSubtle }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : !searchActive ? (
        <FlatList
          data={posts}
          keyExtractor={item => item._id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + verticalScale(100) }}
        />
      ) : null}

      {/* FAB: create post */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + verticalScale(80),
          },
        ]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={scale(24)} color="#fff" />
      </TouchableOpacity>

      <CreatePostModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={handlePostCreated}
      />
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: verticalScale(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: verticalScale(12),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandText: {
    fontSize: scale(11),
    fontWeight: '700',
    letterSpacing: 4,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: scale(10),
    borderWidth: 1,
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    gap: scale(8),
  },
  searchInput: {
    flex: 1,
    fontSize: scale(14),
    paddingVertical: 0,
  },
  searchResults: {
    flex: 1,
  },
  searchHint: {
    textAlign: 'center',
    fontSize: scale(13),
    marginTop: verticalScale(32),
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: verticalScale(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: scale(12),
  },
  searchAvatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  searchAvatarImg: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
  },
  searchUserMeta: { flex: 1 },
  searchUserName: {
    fontSize: scale(14),
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  searchUserHandle: {
    fontSize: scale(12),
    marginTop: verticalScale(1),
  },
  searchFollowers: {
    fontSize: scale(11),
  },
  tabSwitcher: {
    flexDirection: 'row',
    borderRadius: scale(10),
    borderWidth: 1,
    padding: scale(3),
    gap: scale(2),
  },
  tabBtn: {
    flex: 1,
    paddingVertical: verticalScale(7),
    alignItems: 'center',
    borderRadius: scale(8),
  },
  tabLabel: {
    fontSize: scale(11),
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Post card
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: verticalScale(2),
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: verticalScale(12),
    gap: scale(10),
  },
  avatarWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
  },
  authorMeta: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  authorName: {
    fontSize: scale(13),
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  creatorBadge: {
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorHandle: {
    fontSize: scale(11),
    marginTop: verticalScale(1),
  },
  postTime: {
    fontSize: scale(11),
    fontWeight: '400',
  },

  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, // 1:1 square
  },

  actionsRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(4),
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  likeCount: {
    fontSize: scale(13),
    fontWeight: '500',
  },

  captionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: verticalScale(12),
  },
  captionAuthor: {
    fontSize: scale(13),
    fontWeight: '600',
  },
  captionText: {
    fontSize: scale(13),
    lineHeight: scale(18),
  },

  // Loading / empty
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { paddingVertical: verticalScale(20), alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: verticalScale(60),
    gap: verticalScale(10),
  },
  emptyTitle: {
    fontSize: scale(16),
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: scale(13),
    textAlign: 'center',
    lineHeight: scale(18),
  },
  retryBtn: {
    marginTop: verticalScale(8),
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(9),
    borderRadius: scale(10),
    borderWidth: 1,
  },
  retryText: { fontSize: scale(13), fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute',
    right: scale(20),
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },

  // Create post modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: verticalScale(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: scale(15),
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  shareBtn: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(7),
    borderRadius: scale(20),
    minWidth: scale(60),
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: scale(13),
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  imagePicker: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  imagePickerPlaceholder: {
    alignItems: 'center',
    gap: verticalScale(12),
  },
  imagePickerHint: {
    fontSize: scale(13),
    fontWeight: '400',
  },
  captionInputWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: verticalScale(12),
  },
  captionInput: {
    fontSize: scale(14),
    lineHeight: scale(20),
    minHeight: verticalScale(60),
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: scale(10),
    textAlign: 'right',
    paddingBottom: verticalScale(8),
  },
});

export default SocialFeedScreen;
