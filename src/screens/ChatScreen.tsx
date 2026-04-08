import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '../services/apiClient';
import { useUserId } from '../hooks/useUserId';
import { useAuth } from '../context/AuthContext';
import { AIMisuseWarning, hasAcknowledgedWarning } from '../components/AIMisuseWarning';
import { LoadingSpinner } from '../components/LoadingSpinner';
import GlassCard from '../components/GlassCard';
import { useThemeColors } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  conversationId: string;
  title: string;
  updatedAt: string;
  coachName?: string;
}

interface WardrobeBriefCategory {
  key: string;
  label: string;
  count: number;
}

interface WardrobeBrief {
  itemCount: number;
  categories: WardrobeBriefCategory[];
  palette: string[];
  styleSignatures: string[];
  dominantDressCodes: string[];
  wardrobeWins: string[];
  growthAreas: string[];
  heroPieces: string[];
  underusedPieces: string[];
  styleArchetype?: string;
  styleMantra?: string;
  styleInsight?: string;
  stylistFocus?: string;
  lovedColors: string[];
  lovedStyles: string[];
  lovedCategories: string[];
}

interface QuickPrompt {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  message: string;
}

interface StudioMode {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const DEFAULT_COACH_NAME = 'NOVA';
const PROMPT_CARD_WIDTH = (SCREEN_WIDTH - scale(52)) / 2;

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'audit',
    icon: 'sparkles-outline',
    title: 'Audit my wardrobe',
    subtitle: 'Read the closet like a pro',
    message: 'Give me a wardrobe audit based on what I own and teach me what my closet is already saying.',
  },
  {
    id: 'identity',
    icon: 'body-outline',
    title: 'Find my style identity',
    subtitle: 'Name the signature clearly',
    message: 'Based on my wardrobe, what is my style identity and how can I sharpen it without losing myself?',
  },
  {
    id: 'palette',
    icon: 'color-palette-outline',
    title: 'Teach my palette',
    subtitle: 'Explain what my colors do',
    message: 'Teach me how to use the colors already in my wardrobe more intelligently and explain why they work.',
  },
  {
    id: 'restyle',
    icon: 'repeat-outline',
    title: 'Restyle a hero piece',
    subtitle: 'Make one item work harder',
    message: 'Pick one hero piece from my wardrobe and teach me several ways to restyle it with intention.',
  },
  {
    id: 'elevate',
    icon: 'diamond-outline',
    title: 'Elevate my basics',
    subtitle: 'Make everything look richer',
    message: 'Teach me how to make my basics look more expensive, more styled, and more intentional.',
  },
  {
    id: 'shopping',
    icon: 'bag-handle-outline',
    title: 'Shop strategically',
    subtitle: 'Buy less, strengthen more',
    message: 'What are the most strategic additions that would strengthen my wardrobe without overbuying?',
  },
];

const STUDIO_MODES: StudioMode[] = [
  {
    id: 'wardrobe',
    icon: 'albums-outline',
    title: 'Wardrobe Director',
    description: 'Reads your closet, spots strengths, and shows where more range can come from.',
  },
  {
    id: 'educator',
    icon: 'school-outline',
    title: 'Fashion Educator',
    description: 'Explains color, silhouette, balance, and texture so you learn while you style.',
  },
  {
    id: 'cheerleader',
    icon: 'rose-outline',
    title: 'Confidence Builder',
    description: 'Supports, celebrates, and sharpens your style without tearing you down.',
  },
];

function fireAndForget(promise: Promise<unknown>) {
  promise.catch(() => {});
}

export default function ChatScreen() {
  const theme = useThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = useUserId();
  const { user } = useAuth();
  const userName = user?.name?.split(' ')[0] || 'You';
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [coachName, setCoachName] = useState(DEFAULT_COACH_NAME);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [wardrobeBrief, setWardrobeBrief] = useState<WardrobeBrief | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isUserScrolling = useRef(false);
  const shouldAutoScroll = useRef(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkWarning = useCallback(async () => {
    const acknowledged = await hasAcknowledgedWarning();
    if (!acknowledged) {
      setShowWarning(true);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const response = await apiClient.get(`/chat/conversations?userId=${userId}`);
      setConversations(response.data.conversations || []);
    } catch {
      setConversations([]);
    }
  }, [userId]);

  const loadWardrobeBrief = useCallback(async () => {
    if (!userId) {
      return;
    }

    setIsBriefLoading(true);
    try {
      const response = await apiClient.get(`/chat/brief?userId=${userId}`);
      setWardrobeBrief(response.data.brief || null);
      if (response.data.coachName) {
        setCoachName(response.data.coachName);
      }
    } catch {
      setWardrobeBrief(null);
    } finally {
      setIsBriefLoading(false);
    }
  }, [userId]);

  const loadChatHistory = useCallback(async (convId?: string) => {
    if (!userId) {
      return;
    }

    try {
      const url = convId
        ? `/chat/history?userId=${userId}&conversationId=${convId}`
        : `/chat/history?userId=${userId}`;
      const response = await apiClient.get(url);
      const rawMessages = response.data.messages || [];

      setMessages(
        rawMessages.map((message: any, index: number) => ({
          ...message,
          id: message._id || `${message.role}-${index}-${message.timestamp || Date.now()}`,
          timestamp: new Date(message.timestamp),
        })),
      );
      setConversationId(response.data.conversationId || null);
      setCoachName(response.data.coachName || DEFAULT_COACH_NAME);

      if (rawMessages.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 250);
      }
    } catch {
      setMessages([]);
      setConversationId(null);
      setCoachName(DEFAULT_COACH_NAME);
    }
  }, [userId]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();

    if (userId) {
      fireAndForget(checkWarning());
      fireAndForget(loadConversations());
      fireAndForget(loadWardrobeBrief());
      fireAndForget(loadChatHistory());
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [checkWarning, fadeAnim, loadChatHistory, loadConversations, loadWardrobeBrief, userId]);

  const startNewChat = () => {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    setMessages([]);
    setConversationId(null);
    setCoachName(DEFAULT_COACH_NAME);
    setShowHistory(false);
  };

  const selectConversation = (conversation: Conversation) => {
    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    setConversationId(conversation.conversationId);
    setCoachName(conversation.coachName || DEFAULT_COACH_NAME);
    fireAndForget(loadChatHistory(conversation.conversationId));
    setShowHistory(false);
  };

  const deleteConversation = async (convId: string) => {
    if (!userId) {
      return;
    }

    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    try {
      await apiClient.delete(`/chat/conversation?userId=${userId}&conversationId=${convId}`);
      setConversations((previous) => previous.filter((entry) => entry.conversationId !== convId));
      if (conversationId === convId) {
        setMessages([]);
        setConversationId(null);
        setCoachName(DEFAULT_COACH_NAME);
      }
    } catch {
      // Leave the current state untouched if deletion fails.
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading || !userId) {
      return;
    }

    fireAndForget(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((previous) => [...previous, userMessage]);
    setInputText('');
    setIsLoading(true);
    shouldAutoScroll.current = true;

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);

    try {
      const response = await apiClient.post('/chat/message', {
        userId,
        message: messageText,
        conversationId,
        language: 'en',
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };

      setMessages((previous) => [...previous, assistantMessage]);
      setCoachName(response.data.coachName || DEFAULT_COACH_NAME);
      setConversationId(response.data.conversationId || null);
      if (response.data.brief) {
        setWardrobeBrief(response.data.brief);
      }
      fireAndForget(loadConversations());
      fireAndForget(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

      if (shouldAutoScroll.current && !isUserScrolling.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 120);
      }
    } catch (error: any) {
      let content = 'Sorry, something went wrong. Please try again.';
      if (
        error?.status === 403 &&
        (error?.data?.error === 'upgrade_required' || error?.message?.includes('upgrade'))
      ) {
        content = 'The AI stylist chat is a Pro feature. Upgrade your plan to keep working with NOVA.';
      }

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
      };

      setMessages((previous) => [...previous, errorMessage]);

      if (shouldAutoScroll.current && !isUserScrolling.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 120);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleScrollBeginDrag = () => {
    isUserScrolling.current = true;
    shouldAutoScroll.current = false;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  };

  const handleScrollEndDrag = () => {
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 1000);
  };

  const handleMomentumScrollEnd = () => {
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
      shouldAutoScroll.current = true;
    }, 500);
  };

  const renderMetric = (value: string, label: string, icon: keyof typeof Ionicons.glyphMap) => (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={scale(16)} color={theme.primary} />
      </View>
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const renderChipList = (items: string[], tone: 'default' | 'accent' = 'default') => (
    <View style={styles.chipWrap}>
      {items.map((item, index) => (
        <View
          key={`${item}-${index}`}
          style={[tone === 'accent' ? styles.accentChip : styles.defaultChip]}
        >
          <Text style={tone === 'accent' ? styles.accentChipText : styles.defaultChipText}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderStudioModes = () => (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>How NOVA Works</Text>
      <Text style={styles.sectionTitle}>A full stylist, not a basic suggestion bot.</Text>
      <View style={styles.modeStack}>
        {STUDIO_MODES.map((mode) => (
          <GlassCard key={mode.id} style={styles.modeCard} intensity={16}>
            <View style={styles.modeIcon}>
              <Ionicons name={mode.icon} size={scale(18)} color={theme.primary} />
            </View>
            <View style={styles.modeCopy}>
              <Text style={styles.modeTitle}>{mode.title}</Text>
              <Text style={styles.modeDescription}>{mode.description}</Text>
            </View>
          </GlassCard>
        ))}
      </View>
    </View>
  );

  const renderWardrobeBrief = () => {
    if (isBriefLoading && !wardrobeBrief) {
      return (
        <GlassCard style={styles.briefCard} intensity={18}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={styles.loadingText}>Reading your wardrobe like a stylist...</Text>
          </View>
        </GlassCard>
      );
    }

    if (!wardrobeBrief || wardrobeBrief.itemCount === 0) {
      return (
        <GlassCard style={styles.briefCard} intensity={18}>
          <Text style={styles.sectionEyebrow}>Wardrobe Brief</Text>
          <Text style={styles.briefHeadline}>Start with a strong foundation.</Text>
          <Text style={styles.briefBody}>
            Add a few wardrobe pieces and NOVA will start reading your palette, your style
            signatures, and the smartest ways to build range without wasting money.
          </Text>
          <Text style={styles.briefSubheading}>Best first categories</Text>
          {renderChipList(['Tops', 'Bottoms', 'Shoes'], 'accent')}
        </GlassCard>
      );
    }

    return (
      <GlassCard style={styles.briefCard} intensity={18}>
        <Text style={styles.sectionEyebrow}>Wardrobe Brief</Text>
        <Text style={styles.briefHeadline}>
          {wardrobeBrief.styleArchetype || 'Your style signature is taking shape'}
        </Text>
        <Text style={styles.briefBody}>
          {wardrobeBrief.styleInsight || wardrobeBrief.stylistFocus}
        </Text>

        <View style={styles.briefSplit}>
          <View style={styles.briefColumn}>
            <Text style={styles.briefSubheading}>Palette</Text>
            {renderChipList(
              wardrobeBrief.palette.length > 0 ? wardrobeBrief.palette : ['Building now'],
              'accent',
            )}
          </View>
          <View style={styles.briefColumn}>
            <Text style={styles.briefSubheading}>Style signatures</Text>
            {renderChipList(
              wardrobeBrief.styleSignatures.length > 0
                ? wardrobeBrief.styleSignatures
                : ['Still emerging'],
            )}
          </View>
        </View>

        <Text style={styles.briefSubheading}>What is already working</Text>
        {wardrobeBrief.wardrobeWins.slice(0, 2).map((item, index) => (
          <View key={`win-${index}`} style={styles.insightRow}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>{item}</Text>
          </View>
        ))}

        <Text style={styles.briefSubheading}>Next power moves</Text>
        {wardrobeBrief.growthAreas.slice(0, 2).map((item, index) => (
          <View key={`growth-${index}`} style={styles.insightRow}>
            <View style={styles.insightDot} />
            <Text style={styles.insightText}>{item}</Text>
          </View>
        ))}

        {wardrobeBrief.heroPieces.length > 0 && (
          <>
            <Text style={styles.briefSubheading}>Hero pieces already in play</Text>
            {renderChipList(wardrobeBrief.heroPieces.slice(0, 4))}
          </>
        )}
      </GlassCard>
    );
  };

  const renderPromptSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionEyebrow}>Consultation Starters</Text>
      <Text style={styles.sectionTitle}>Start a conversation like a premium styling session.</Text>
      <View style={styles.promptGrid}>
        {QUICK_PROMPTS.map((prompt) => (
          <TouchableOpacity
            key={prompt.id}
            activeOpacity={0.85}
            style={styles.promptCard}
            onPress={() => {
              fireAndForget(sendMessage(prompt.message));
            }}
          >
            <LinearGradient colors={[...theme.gradientCard]} style={styles.promptGradient}>
              <View style={styles.promptIcon}>
                <Ionicons name={prompt.icon} size={scale(18)} color={theme.primary} />
              </View>
              <Text style={styles.promptTitle}>{prompt.title}</Text>
              <Text style={styles.promptSubtitle}>{prompt.subtitle}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <ScrollView contentContainerStyle={styles.studioScroll} showsVerticalScrollIndicator={false}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <LinearGradient colors={[...theme.gradientCard]} style={styles.heroCard}>
          <View style={styles.heroHalo} />
          <View style={styles.heroTop}>
            <LinearGradient colors={[...theme.gradientAccent]} style={styles.heroAvatar}>
              <Ionicons name="sparkles" size={scale(26)} color={theme.textOnPrimary} />
            </LinearGradient>
            <View style={styles.liveBadge}>
              <Ionicons name="radio" size={scale(12)} color={theme.success} />
              <Text style={styles.liveBadgeText}>Wardrobe intelligence live</Text>
            </View>
          </View>

          <Text style={styles.heroEyebrow}>Celebrity Stylist Studio</Text>
          <Text style={styles.heroTitle}>{coachName}</Text>
          <Text style={styles.heroSubtitle}>
            A full stylist who teaches your wardrobe, sharpens your taste, and keeps your
            confidence high without criticism.
          </Text>
          <Text style={styles.heroFocus}>
            {wardrobeBrief?.stylistFocus ||
              'Bring your closet in, and NOVA will start decoding what is strong, what can stretch further, and what to refine next.'}
          </Text>

          <View style={styles.metricRow}>
            {renderMetric(String(wardrobeBrief?.itemCount || 0), 'Pieces', 'shirt-outline')}
            {renderMetric(wardrobeBrief?.palette?.[0] || 'Palette', 'Anchor', 'color-palette-outline')}
            {renderMetric(
              wardrobeBrief?.styleSignatures?.[0] || 'Identity',
              'Signature',
              'diamond-outline',
            )}
          </View>
        </LinearGradient>
      </Animated.View>

      {renderStudioModes()}
      {renderWardrobeBrief()}
      {renderPromptSection()}
    </ScrollView>
  );

  const renderConversationHeader = () => {
    if (!wardrobeBrief) {
      return null;
    }

    return (
      <GlassCard style={styles.bannerCard} intensity={14}>
        <Text style={styles.sectionEyebrow}>Live Styling Focus</Text>
        <Text style={styles.bannerTitle}>
          {wardrobeBrief.styleArchetype || 'Your wardrobe is being read in real time'}
        </Text>
        <Text style={styles.bannerBody}>
          {wardrobeBrief.stylistFocus || wardrobeBrief.styleInsight}
        </Text>
      </GlassCard>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const time = item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <LinearGradient colors={[...theme.gradientAccent]} style={styles.messageAvatar}>
            <Ionicons name="sparkles" size={scale(14)} color={theme.textOnPrimary} />
          </LinearGradient>
        )}

        <View style={[styles.messageColumn, isUser && styles.messageColumnUser]}>
          {!isUser && <Text style={styles.messageLabel}>NOVA</Text>}

          {isUser ? (
            <LinearGradient colors={[...theme.gradientAccent]} style={styles.userBubble}>
              <Text style={styles.userBubbleText}>{item.content}</Text>
              <Text style={styles.userTime}>{time}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantBubbleText}>{item.content}</Text>
              <Text style={styles.assistantTime}>{time}</Text>
            </View>
          )}
        </View>

        {isUser && (
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderTyping = () => {
    if (!isLoading) {
      return null;
    }

    return (
      <View style={styles.messageRow}>
        <LinearGradient colors={[...theme.gradientAccent]} style={styles.messageAvatar}>
          <Ionicons name="sparkles" size={scale(14)} color={theme.textOnPrimary} />
        </LinearGradient>
        <View style={styles.typingBubble}>
          <LoadingSpinner size="small" />
          <Text style={styles.typingText}>NOVA is tailoring your answer...</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[theme.background, theme.backgroundAlt, theme.background]}
        style={styles.container}
      >
        <AIMisuseWarning visible={showWarning} onAcknowledge={() => setShowWarning(false)} />

        <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modal, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Sessions</Text>
                <Text style={styles.modalTitle}>Stylist chat history</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setShowHistory(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerAction}
              >
                <Ionicons name="close" size={scale(22)} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.9} style={styles.newChatButton} onPress={startNewChat}>
              <LinearGradient colors={[...theme.gradientAccent]} style={styles.newChatButtonGradient}>
                <Ionicons name="add" size={scale(18)} color={theme.textOnPrimary} />
                <Text style={styles.newChatButtonText}>Start a fresh session</Text>
              </LinearGradient>
            </TouchableOpacity>

            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {conversations.length === 0 ? (
                <GlassCard style={styles.emptyHistoryCard} intensity={16}>
                  <Text style={styles.emptyHistoryTitle}>No sessions yet</Text>
                  <Text style={styles.emptyHistoryText}>
                    Your styling conversations will appear here once you start chatting.
                  </Text>
                </GlassCard>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversationId === conversation.conversationId;
                  return (
                    <TouchableOpacity
                      key={conversation.conversationId}
                      activeOpacity={0.85}
                      style={[styles.historyItem, isActive && styles.historyItemActive]}
                      onPress={() => selectConversation(conversation)}
                    >
                      <View style={styles.historyItemIcon}>
                        <Ionicons
                          name={isActive ? 'chatbubble' : 'chatbubble-outline'}
                          size={scale(18)}
                          color={theme.primary}
                        />
                      </View>
                      <View style={styles.historyCopy}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {conversation.title}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(conversation.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => {
                          fireAndForget(deleteConversation(conversation.conversationId));
                        }}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="trash-outline" size={scale(18)} color={theme.danger} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>

        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.headerAction}
            onPress={() => setShowHistory(true)}
          >
            <Ionicons name="menu" size={scale(22)} color={theme.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <LinearGradient colors={[...theme.gradientAccent]} style={styles.headerAvatar}>
              <Ionicons name="sparkles" size={scale(14)} color={theme.textOnPrimary} />
            </LinearGradient>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{coachName}</Text>
              <Text style={styles.headerSubtitle}>
                {wardrobeBrief?.styleArchetype || 'Celebrity stylist and wardrobe educator'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.headerAction}
            onPress={startNewChat}
          >
            <Ionicons name="add-circle-outline" size={scale(22)} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.messagesContainer}>
          {messages.length === 0 ? (
            renderEmpty()
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              ListHeaderComponent={renderConversationHeader}
              ListFooterComponent={renderTyping}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={10}
            />
          )}
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {inputText.length > 400 && (
            <Text style={styles.characterCounter}>{500 - inputText.length} left</Text>
          )}
          <View
            style={[
              styles.composerShell,
              { paddingBottom: verticalScale(56) + Math.max(insets.bottom, verticalScale(12)) },
            ]}
          >
            <View style={styles.composerCard}>
              <View style={styles.composerTop}>
                <Text style={styles.composerLabel}>Ask your stylist</Text>
                <Text style={styles.composerHint}>
                  Wardrobe audit, styling lesson, event prep, shopping strategy
                </Text>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask NOVA to decode your wardrobe, teach a fashion principle, or refine your next look..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                  ]}
                  onPress={() => {
                    fireAndForget(sendMessage());
                  }}
                  disabled={!inputText.trim() || isLoading}
                >
                  <LinearGradient
                    colors={
                      inputText.trim()
                        ? [...theme.gradientAccent]
                        : [theme.surfaceElevated, theme.surfaceElevated]
                    }
                    style={styles.sendButtonGradient}
                  >
                    <Ionicons name="arrow-up" size={scale(20)} color={theme.textOnPrimary} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: verticalScale(12),
      paddingBottom: verticalScale(14),
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    headerAction: {
      width: scale(42),
      height: scale(42),
      borderRadius: scale(21),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
      marginHorizontal: spacing.md,
    },
    headerAvatar: {
      width: scale(42),
      height: scale(42),
      borderRadius: scale(21),
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 10 },
      shadowRadius: 18,
      elevation: 8,
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      ...typography.bodyBold,
      fontSize: scale(15),
      color: colors.textPrimary,
    },
    headerSubtitle: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: verticalScale(2),
    },
    messagesContainer: {
      flex: 1,
      minHeight: 0,
    },
    studioScroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing['2xl'],
      gap: spacing.lg,
    },
    heroCard: {
      borderRadius: scale(28),
      padding: spacing.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      shadowColor: colors.primary,
      shadowOpacity: 0.18,
      shadowOffset: { width: 0, height: 16 },
      shadowRadius: 28,
      elevation: 10,
    },
    heroHalo: {
      position: 'absolute',
      top: -scale(36),
      right: -scale(24),
      width: scale(140),
      height: scale(140),
      borderRadius: scale(70),
      backgroundColor: colors.primarySoft,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    heroAvatar: {
      width: scale(58),
      height: scale(58),
      borderRadius: scale(29),
      justifyContent: 'center',
      alignItems: 'center',
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scale(6),
      paddingHorizontal: scale(12),
      paddingVertical: verticalScale(8),
      borderRadius: scale(999),
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surface,
    },
    liveBadgeText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    heroEyebrow: {
      ...typography.overline,
      color: colors.primary,
      marginBottom: verticalScale(8),
    },
    heroTitle: {
      ...typography.headline,
      fontSize: scale(28),
      color: colors.textPrimary,
      marginBottom: verticalScale(8),
    },
    heroSubtitle: {
      ...typography.body,
      fontSize: scale(15),
      lineHeight: scale(23),
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    heroFocus: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: scale(22),
      marginBottom: spacing.lg,
    },
    metricRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    metricCard: {
      flex: 1,
      padding: spacing.md,
      borderRadius: scale(18),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    metricIcon: {
      width: scale(30),
      height: scale(30),
      borderRadius: scale(15),
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: verticalScale(10),
    },
    metricValue: {
      ...typography.bodyBold,
      fontSize: scale(14),
      color: colors.textPrimary,
    },
    metricLabel: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: verticalScale(4),
    },
    section: {
      gap: spacing.sm,
    },
    sectionEyebrow: {
      ...typography.overline,
      color: colors.primary,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      marginBottom: verticalScale(6),
    },
    modeStack: {
      gap: spacing.sm,
    },
    modeCard: {
      padding: 0,
    },
    modeIcon: {
      width: scale(36),
      height: scale(36),
      borderRadius: scale(18),
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    modeCopy: {
      gap: verticalScale(4),
    },
    modeTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    modeDescription: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: scale(20),
    },
    briefCard: {
      padding: 0,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    briefHeadline: {
      ...typography.title,
      color: colors.textPrimary,
      marginTop: verticalScale(4),
      marginBottom: verticalScale(8),
    },
    briefBody: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: scale(22),
      marginBottom: spacing.md,
    },
    briefSplit: {
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    briefColumn: {
      gap: spacing.xs,
    },
    briefSubheading: {
      ...typography.sectionLabel,
      color: colors.textMuted,
      marginTop: spacing.sm,
      marginBottom: verticalScale(6),
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    defaultChip: {
      paddingHorizontal: scale(12),
      paddingVertical: verticalScale(8),
      borderRadius: scale(999),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    defaultChipText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    accentChip: {
      paddingHorizontal: scale(12),
      paddingVertical: verticalScale(8),
      borderRadius: scale(999),
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    accentChipText: {
      ...typography.caption,
      color: colors.primary,
    },
    insightRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: verticalScale(8),
    },
    insightDot: {
      width: scale(8),
      height: scale(8),
      borderRadius: scale(4),
      backgroundColor: colors.primary,
      marginTop: verticalScale(7),
    },
    insightText: {
      ...typography.body,
      flex: 1,
      color: colors.textSecondary,
      lineHeight: scale(21),
    },
    promptGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    promptCard: {
      width: PROMPT_CARD_WIDTH,
    },
    promptGradient: {
      minHeight: verticalScale(144),
      borderRadius: scale(22),
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      justifyContent: 'space-between',
    },
    promptIcon: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(19),
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    promptTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
      marginBottom: verticalScale(6),
    },
    promptSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: scale(18),
    },
    bannerCard: {
      marginBottom: spacing.lg,
      padding: 0,
    },
    bannerTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      marginTop: verticalScale(4),
      marginBottom: verticalScale(6),
    },
    bannerBody: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: scale(21),
    },
    messagesList: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      flexGrow: 1,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: spacing.md,
    },
    messageRowUser: {
      justifyContent: 'flex-end',
    },
    messageAvatar: {
      width: scale(30),
      height: scale(30),
      borderRadius: scale(15),
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    messageColumn: {
      maxWidth: '76%',
    },
    messageColumnUser: {
      alignItems: 'flex-end',
    },
    messageLabel: {
      ...typography.overline,
      color: colors.textMuted,
      marginBottom: verticalScale(6),
      marginLeft: scale(6),
    },
    assistantBubble: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: scale(20),
      borderBottomLeftRadius: scale(8),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    assistantBubbleText: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: scale(22),
    },
    assistantTime: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: verticalScale(8),
    },
    userBubble: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: scale(20),
      borderBottomRightRadius: scale(8),
      minWidth: scale(88),
    },
    userBubbleText: {
      ...typography.body,
      color: colors.textOnPrimary,
      lineHeight: scale(22),
    },
    userTime: {
      ...typography.caption,
      color: 'rgba(8,8,8,0.7)',
      marginTop: verticalScale(8),
      textAlign: 'right',
    },
    userAvatar: {
      width: scale(30),
      height: scale(30),
      borderRadius: scale(15),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: spacing.sm,
    },
    userAvatarText: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    typingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: scale(18),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    typingText: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    composerShell: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.cardSoft,
    },
    composerCard: {
      borderRadius: scale(24),
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.cardElevated,
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 18,
      elevation: 8,
    },
    composerTop: {
      marginBottom: spacing.sm,
    },
    composerLabel: {
      ...typography.bodyBold,
      color: colors.textPrimary,
      marginBottom: verticalScale(4),
    },
    composerHint: {
      ...typography.caption,
      color: colors.textMuted,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      minHeight: verticalScale(50),
      maxHeight: verticalScale(120),
      paddingHorizontal: scale(4),
      paddingVertical: verticalScale(8),
      color: colors.textPrimary,
      ...typography.body,
    },
    sendButton: {
      width: scale(48),
      height: scale(48),
    },
    sendButtonDisabled: {
      opacity: 0.65,
    },
    sendButtonGradient: {
      width: scale(48),
      height: scale(48),
      borderRadius: scale(24),
      justifyContent: 'center',
      alignItems: 'center',
    },
    characterCounter: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'right',
      paddingHorizontal: spacing.lg,
      paddingBottom: verticalScale(6),
    },
    modal: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    modalTitle: {
      ...typography.title,
      color: colors.textPrimary,
      marginTop: verticalScale(4),
    },
    newChatButton: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.lg,
      borderRadius: scale(18),
      overflow: 'hidden',
    },
    newChatButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: verticalScale(14),
    },
    newChatButtonText: {
      ...typography.bodyBold,
      color: colors.textOnPrimary,
    },
    historyList: {
      flex: 1,
      paddingHorizontal: spacing.lg,
    },
    emptyHistoryCard: {
      marginTop: spacing.md,
      padding: 0,
    },
    emptyHistoryTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
      marginBottom: verticalScale(6),
    },
    emptyHistoryText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: scale(18),
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surface,
      marginBottom: spacing.sm,
    },
    historyItemActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    historyItemIcon: {
      width: scale(38),
      height: scale(38),
      borderRadius: scale(19),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.cardElevated,
      marginRight: spacing.sm,
    },
    historyCopy: {
      flex: 1,
    },
    historyTitle: {
      ...typography.bodyBold,
      color: colors.textPrimary,
    },
    historyDate: {
      ...typography.caption,
      color: colors.textMuted,
      marginTop: verticalScale(2),
    },
    deleteButton: {
      padding: spacing.xs,
    },
  });
