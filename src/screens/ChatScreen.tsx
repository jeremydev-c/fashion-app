import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiClient } from '../services/apiClient';
import { useUserId } from '../hooks/useUserId';
import { useAuth } from '../context/AuthContext';
import { AIMisuseWarning, hasAcknowledgedWarning } from '../components/AIMisuseWarning';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { scale, verticalScale, SCREEN_WIDTH } from '../utils/responsive';
import { useThemeColors } from '../theme/ThemeProvider';
import { colors } from '../theme/colors';
import { useTranslation } from 'react-i18next';

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

const PROMPTS = [
  { id: 'prompt-1', icon: '🔍', label: 'Wardrobe Audit' },
  { id: 'prompt-2', icon: '🎨', label: 'Color Theory' },
  { id: 'prompt-3', icon: '📚', label: 'Style Basics' },
  { id: 'prompt-4', icon: '🛍️', label: 'Shopping Tips' },
  { id: 'prompt-5', icon: '✨', label: 'Trend Guide' },
  { id: 'prompt-6', icon: '👗', label: 'Body Styling' },
];

const BADGES = [
  { id: 'badge-1', text: '🎓 Style Education' },
  { id: 'badge-2', text: '🎨 Color Theory' },
  { id: 'badge-3', text: '📈 Trends' },
];

export default function ChatScreen() {
  const colors = useThemeColors();
  const userId = useUserId();
  const { user } = useAuth();
  const { t } = useTranslation();
  const userName = user?.name?.split(' ')[0] || 'Your';
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [coachName, setCoachName] = useState(`${userName}'s Style Coach`);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isUserScrolling = useRef(false);
  const shouldAutoScroll = useRef(true);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    
    if (userId) {
      checkWarning();
      loadConversations();
      loadChatHistory();
    }

    // Cleanup timeout on unmount
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [userId]);

  const checkWarning = async () => {
    const acknowledged = await hasAcknowledgedWarning();
    if (!acknowledged) {
      setShowWarning(true);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await apiClient.get(`/chat/conversations?userId=${userId}`);
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.log('No conversations');
    }
  };

  const loadChatHistory = async (convId?: string) => {
    try {
      const url = convId 
        ? `/chat/history?userId=${userId}&conversationId=${convId}`
        : `/chat/history?userId=${userId}`;
      const response = await apiClient.get(url);
      
      if (response.data.messages && response.data.messages.length > 0) {
        setMessages(response.data.messages.map((msg: any) => ({
          ...msg,
          id: msg._id || `${Date.now()}_${Math.random()}`,
          timestamp: new Date(msg.timestamp),
        })));
        if (response.data.conversationId) setConversationId(response.data.conversationId);
        if (response.data.coachName) setCoachName(response.data.coachName);
        
        // Scroll to bottom when loading history
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 300);
      }
    } catch (error) {
      // No history, that's fine
    }
  };

  const startNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessages([]);
    setConversationId(null);
    setCoachName(`${userName}'s Style Coach`);
    setShowHistory(false);
  };

  const selectConversation = (conv: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConversationId(conv.conversationId);
    if (conv.coachName) setCoachName(conv.coachName);
    loadChatHistory(conv.conversationId);
    setShowHistory(false);
  };

  const deleteConversation = async (convId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await apiClient.delete(`/chat/conversation?userId=${userId}&conversationId=${convId}`);
      setConversations(prev => prev.filter(c => c.conversationId !== convId));
      if (conversationId === convId) {
        setMessages([]);
        setConversationId(null);
      }
    } catch (error) {
      console.log('Delete failed');
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading || !userId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

      setMessages(prev => [...prev, userMsg]);
      setInputText('');
      setIsLoading(true);
      // Auto-scroll when user sends a message
      shouldAutoScroll.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    try {
      const response = await apiClient.post('/chat/message', {
        userId,
        message: messageText,
        conversationId,
        language: 'en',
      });

      const assistantMsg: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
      };

      if (response.data.coachName) setCoachName(response.data.coachName);
      if (response.data.conversationId) setConversationId(response.data.conversationId);

      setMessages(prev => [...prev, assistantMsg]);
      loadConversations();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Auto-scroll when new message arrives (only if user is near bottom)
      if (shouldAutoScroll.current && !isUserScrolling.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      let content = 'Sorry, something went wrong. Please try again.';
      if (error?.status === 403 && (error?.data?.error === 'upgrade_required' || error?.message?.includes('upgrade'))) {
        content = '🔒 The AI Style Coach is a Pro feature. Upgrade your plan to chat with your personal stylist.';
      }
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      // Auto-scroll on error message too
      if (shouldAutoScroll.current && !isUserScrolling.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle scroll events to detect manual scrolling
  const handleScrollBeginDrag = () => {
    isUserScrolling.current = true;
    shouldAutoScroll.current = false;
    
    // Clear any pending scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  };

  const handleScrollEndDrag = () => {
    // Reset scrolling flag after a delay
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 1000);
  };

  const handleMomentumScrollEnd = () => {
    // After user stops scrolling, wait a bit then check if they're near bottom
    // If they are, re-enable auto-scroll for new messages
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
      // Re-enable auto-scroll - user can scroll back down if they want
      shouldAutoScroll.current = true;
    }, 500);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <LinearGradient colors={[...colors.gradientAccent]} style={styles.avatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        )}
        
        <View style={[styles.bubble, isUser ? styles.bubbleUser : [styles.bubbleAssistant, { borderColor: colors.borderSubtle }]]}>
          <Text style={[styles.msgText, { color: colors.textPrimary }, isUser && { color: colors.textOnPrimary }]}>{item.content}</Text>
          <Text style={[styles.time, { color: colors.textMuted }, isUser && { color: colors.textMuted, textAlign: 'right' as const }]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        {isUser && (
          <View style={[styles.avatarUser, { backgroundColor: colors.surface }]}>
            <Text style={[styles.avatarLetter, { color: colors.textPrimary }]}>{userName.charAt(0)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.emptyBox, { opacity: fadeAnim }]}>
        <LinearGradient colors={[...colors.gradientAccent]} style={styles.emptyIcon}>
          <Ionicons name="sparkles" size={36} color="#fff" />
        </LinearGradient>
        
        <Text style={styles.emptyTitle}>{coachName}</Text>
        <Text style={styles.emptyDesc}>Your personal fashion educator</Text>
        
        <View style={styles.badges}>
          {BADGES.map((badge, idx) => (
            <View key={`badge-${badge.id}-${idx}`} style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{badge.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.promptLabel}>{t('chat.quickPrompts')}</Text>
        
        <View style={styles.promptGrid}>
          {PROMPTS.map((p, idx) => (
            <TouchableOpacity
              key={`prompt-${p.id}-${idx}`}
              activeOpacity={0.75}
              style={[styles.promptBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              onPress={() => sendMessage(p.label)}
            >
              <Text style={styles.promptEmoji}>{p.icon}</Text>
              <Text style={styles.promptText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <Text style={styles.tip}>
          💡 I teach style principles. For outfit suggestions, use the Stylist tab!
        </Text>
      </Animated.View>
    </ScrollView>
  );

  const renderTyping = () => {
    if (!isLoading) return null;
    return (
      <View style={[styles.msgRow]}>
        <LinearGradient colors={[...colors.gradientAccent]} style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </LinearGradient>
        <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
          <LoadingSpinner size="small" />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.background, colors.card]}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        
        {/* AI Misuse Warning */}
        <AIMisuseWarning
          visible={showWarning}
          onAcknowledge={() => setShowWarning(false)}
        />
        
        {/* History Modal */}
        <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
          <View style={[styles.modal, { paddingTop: insets.top }]}>
            <View style={[styles.modalHeader, { paddingTop: verticalScale(20), borderBottomColor: colors.borderSubtle }]}>
              <Text style={styles.modalTitle}>{t('chat.chatHistory')}</Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setShowHistory(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={scale(28)} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity activeOpacity={0.85} style={styles.newBtn} onPress={startNewChat}>
              <LinearGradient colors={[...colors.gradientAccent]} style={styles.newBtnGrad}>
                <Ionicons name="add" size={scale(20)} color="#fff" />
                <Text style={styles.newBtnText}>{t('chat.newChat')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <ScrollView style={styles.convList}>
              {conversations.length === 0 ? (
                <Text style={styles.noConv}>{t('chat.noChats')}</Text>
              ) : (
                conversations.map((c, idx) => (
                  <TouchableOpacity
                    key={c.conversationId || `conv-${idx}`}
                    activeOpacity={0.75}
                    style={[styles.convItem, { backgroundColor: colors.surface }, conversationId === c.conversationId && styles.convActive]}
                    onPress={() => selectConversation(c)}
                  >
                    <Ionicons name="chatbubble" size={scale(18)} color="rgba(168,162,158,0.9)" />
                    <View style={styles.convInfo}>
                      <Text style={styles.convTitle} numberOfLines={1} ellipsizeMode="tail">{c.title}</Text>
                      <Text style={styles.convDate}>{new Date(c.updatedAt).toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => deleteConversation(c.conversationId)}>
                      <Ionicons name="trash-outline" size={scale(18)} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Header with safe area insets */}
        <View style={[styles.header, { paddingTop: verticalScale(12), borderBottomColor: colors.borderSubtle }]}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.headerBtn, { backgroundColor: colors.surface }]} onPress={() => setShowHistory(true)}>
            <Ionicons name="menu" size={scale(24)} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerMid}>
            <LinearGradient colors={[...colors.gradientAccent]} style={styles.headerAvatar}>
              <Ionicons name="sparkles" size={scale(16)} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.headerName}>{coachName}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Online</Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity activeOpacity={0.7} style={[styles.headerBtn, { backgroundColor: colors.surface }]} onPress={startNewChat}>
            <Ionicons name="add-circle-outline" size={scale(24)} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Messages or Empty - Wrapped in flex container */}
        <View style={styles.messagesContainer}>
          {messages.length === 0 ? (
            renderEmpty()
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.msgList}
              onScrollBeginDrag={handleScrollBeginDrag}
              onScrollEndDrag={handleScrollEndDrag}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              ListFooterComponent={renderTyping}
              showsVerticalScrollIndicator={false}
              inverted={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
              style={styles.flatList}
            />
          )}
        </View>

        {/* Input — extra bottom padding to clear the floating tab bar */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {inputText.length > 400 && (
            <Text style={{ fontSize: scale(11), color: colors.textMuted, textAlign: 'right', paddingHorizontal: scale(16), paddingBottom: verticalScale(4) }}>
              {500 - inputText.length} left
            </Text>
          )}
          <View style={[styles.inputBox, { paddingBottom: verticalScale(56) + Math.max(insets.bottom, verticalScale(12)), borderTopColor: colors.borderSubtle }]}>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnOff]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              <LinearGradient
                colors={inputText.trim() ? [...colors.gradientAccent] : [colors.surface, colors.surface]}
                style={styles.sendGrad}
              >
                <Ionicons name="arrow-up" size={scale(20)} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.card,
  },
  container: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  headerAvatar: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerName: {
    fontSize: scale(16),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: scale(11),
    color: colors.textMuted,
  },
  
  // Messages Container
  messagesContainer: {
    flex: 1,
    minHeight: 0, // Important for flex children
  },
  flatList: {
    flex: 1,
  },
  msgList: {
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(16),
    paddingBottom: verticalScale(20),
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: verticalScale(12),
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(8),
  },
  avatarUser: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(8),
  },
  avatarLetter: {
    fontSize: scale(12),
    fontWeight: '700',
  },
  bubble: {
    maxWidth: '72%',
    padding: scale(12),
    borderRadius: scale(16),
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: scale(4),
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: scale(4),
    borderWidth: 1,
  },
  typingBubble: {
    paddingVertical: verticalScale(14),
    paddingHorizontal: scale(20),
  },
  msgText: {
    fontSize: scale(15),
    lineHeight: scale(21),
  },
  msgTextUser: {},
  time: {
    fontSize: scale(10),
    marginTop: verticalScale(4),
  },
  timeUser: {
    textAlign: 'right',
  },
  
  // Empty State
  emptyScroll: {
    flex: 1,
    paddingVertical: verticalScale(20),
    paddingBottom: verticalScale(20),
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: scale(24),
  },
  emptyIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  emptyTitle: {
    fontSize: scale(22),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: verticalScale(4),
  },
  emptyDesc: {
    fontSize: scale(14),
    color: colors.textMuted,
    marginBottom: verticalScale(20),
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: verticalScale(24),
  },
  badge: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    borderRadius: scale(16),
  },
  badgeText: {
    fontSize: scale(12),
  },
  promptLabel: {
    fontSize: scale(12),
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: scale(1),
    marginBottom: verticalScale(12),
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(10),
    marginBottom: verticalScale(24),
  },
  promptBtn: {
    width: (SCREEN_WIDTH - scale(78)) / 3,
    borderRadius: scale(12),
    paddingVertical: verticalScale(14),
    alignItems: 'center',
    borderWidth: 1,
  },
  promptEmoji: {
    fontSize: scale(24),
    marginBottom: verticalScale(6),
  },
  promptText: {
    fontSize: scale(11),
    color: colors.textMuted,
    fontWeight: '500',
  },
  tip: {
    fontSize: scale(12),
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: scale(18),
    paddingHorizontal: scale(20),
  },
  
  // Input
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: scale(12),
    paddingTop: verticalScale(12),
    borderTopWidth: 1,
    backgroundColor: colors.card,
    gap: scale(10),
  },
  input: {
    flex: 1,
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    fontSize: scale(15),
    maxHeight: verticalScale(100),
    borderWidth: 1,
  },
  sendBtn: {
    width: scale(44),
    height: scale(44),
  },
  sendBtnOff: {
    opacity: 0.5,
  },
  sendGrad: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Modal
  modal: {
    flex: 1,
    backgroundColor: colors.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingBottom: verticalScale(20),
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  newBtn: {
    margin: scale(16),
  },
  newBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: verticalScale(14),
    borderRadius: scale(12),
  },
  newBtnText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  convList: {
    flex: 1,
    paddingHorizontal: scale(16),
  },
  noConv: {
    fontSize: scale(14),
    color: '#78716c',
    textAlign: 'center',
    marginTop: verticalScale(40),
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: scale(14),
    borderRadius: scale(12),
    marginBottom: verticalScale(8),
    gap: scale(12),
  },
  convActive: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  convInfo: {
    flex: 1,
  },
  convTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
  },
  convDate: {
    fontSize: scale(11),
    color: '#78716c',
    marginTop: verticalScale(2),
  },
});
