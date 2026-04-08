import { apiRequest } from './apiClient';

export interface PostAuthor {
  _id: string;
  name: string;
  username?: string;
  avatar?: string | null;
  isCreator?: boolean;
  followersCount?: number;
}

export interface Post {
  _id: string;
  userId: PostAuthor;
  imageUrl: string;
  caption: string;
  likesCount: number;
  likedByMe: boolean;
  tags: string[];
  createdAt: string;
}

export interface FeedPage {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PublicProfile {
  _id: string;
  name: string;
  username?: string;
  avatar?: string | null;
  bio?: string;
  isCreator?: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  createdAt: string;
}

export interface GridPost {
  _id: string;
  imageUrl: string;
  likesCount: number;
  caption: string;
  createdAt: string;
}

export interface GridPage {
  posts: GridPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const socialApi = {
  getFeed: (cursor?: string): Promise<FeedPage> =>
    apiRequest(`/social/feed${cursor ? `?cursor=${cursor}` : ''}`),

  getExplore: (cursor?: string): Promise<FeedPage> =>
    apiRequest(`/social/explore${cursor ? `?cursor=${cursor}` : ''}`),

  createPost: (data: {
    imageBase64: string;
    caption: string;
    tags?: string[];
  }): Promise<{ post: Post }> =>
    apiRequest('/social/posts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deletePost: (postId: string): Promise<{ ok: boolean }> =>
    apiRequest(`/social/posts/${postId}`, { method: 'DELETE' }),

  toggleLike: (postId: string): Promise<{ liked: boolean; likesCount: number }> =>
    apiRequest(`/social/posts/${postId}/like`, { method: 'POST' }),

  getProfile: (userId: string): Promise<{ user: PublicProfile }> =>
    apiRequest(`/social/users/${userId}`),

  getUserPosts: (userId: string, cursor?: string): Promise<GridPage> =>
    apiRequest(`/social/users/${userId}/posts${cursor ? `?cursor=${cursor}` : ''}`),

  toggleFollow: (userId: string): Promise<{ following: boolean }> =>
    apiRequest(`/social/follow/${userId}`, { method: 'POST' }),

  searchUsers: (q: string): Promise<{ users: PostAuthor[] }> =>
    apiRequest(`/social/search?q=${encodeURIComponent(q)}`),

  updateProfile: (data: { bio?: string; isCreator?: boolean }): Promise<{ ok: boolean }> =>
    apiRequest('/social/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
