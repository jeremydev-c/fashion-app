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
  Dimensions,
  Modal,
  ScrollView,
  SafeAreaView,
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

const { width, width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => Math.round((SCREEN_WIDTH / 393) * size);

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
  const userId = useUserId();
  const { user } = useAuth();
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
      console.error('Delete failed');
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
    } catch (error) {
      const errorMsg: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
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
          <LinearGradient colors={['#ff6b9c', '#7f5dff']} style={styles.avatar}>
            <Ionicons name="sparkles" size={14} color="#fff" />
          </LinearGradient>
        )}
        
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.msgText, isUser && styles.msgTextUser]}>{item.content}</Text>
          <Text style={[styles.time, isUser && styles.timeUser]}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        {isUser && (
          <View style={styles.avatarUser}>
            <Text style={styles.avatarLetter}>{userName.charAt(0)}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <ScrollView contentContainerStyle={styles.emptyScroll} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.emptyBox, { opacity: fadeAnim }]}>
        <LinearGradient colors={['#ff6b9c', '#7f5dff']} style={styles.emptyIcon}>
          <Ionicons name="sparkles" size={36} color="#fff" />
        </LinearGradient>
        
        <Text style={styles.emptyTitle}>{coachName}</Text>
        <Text style={styles.emptyDesc}>Your personal fashion educator</Text>
        
        <View style={styles.badges}>
          {BADGES.map((badge) => (
            <View key={badge.id} style={styles.badge}>
              <Text style={styles.badgeText}>{badge.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.promptLabel}>Quick prompts:</Text>
        
        <View style={styles.promptGrid}>
          {PROMPTS.map((p) => (
            <TouchableOpacity 
              key={p.id} 
              style={styles.promptBtn}
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
        <LinearGradient colors={['#ff6b9c', '#7f5dff']} style={styles.avatar}>
          <Ionicons name="sparkles" size={14} color="#fff" />
        </LinearGradient>
        <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
          <LoadingSpinner size="small" />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
        
        {/* AI Misuse Warning */}
        <AIMisuseWarning
          visible={showWarning}
          onAcknowledge={() => setShowWarning(false)}
        />
        
        {/* History Modal */}
        <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modal}>
            <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, scale(20)) }]}>
              <Text style={styles.modalTitle}>Chat History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={scale(28)} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.newBtn} onPress={startNewChat}>
              <LinearGradient colors={['#ff6b9c', '#7f5dff']} style={styles.newBtnGrad}>
                <Ionicons name="add" size={scale(20)} color="#fff" />
                <Text style={styles.newBtnText}>New Chat</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <ScrollView style={styles.convList}>
              {conversations.length === 0 ? (
                <Text style={styles.noConv}>No conversations yet</Text>
              ) : (
                conversations.map((c) => (
                  <TouchableOpacity 
                    key={c.conversationId} 
                    style={[styles.convItem, conversationId === c.conversationId && styles.convActive]}
                    onPress={() => selectConversation(c)}
                  >
                    <Ionicons name="chatbubble" size={scale(18)} color="#94a3b8" />
                    <View style={styles.convInfo}>
                      <Text style={styles.convTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.convDate}>{new Date(c.updatedAt).toLocaleDateString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteConversation(c.conversationId)}>
                      <Ionicons name="trash-outline" size={scale(18)} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Header with safe area insets */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, scale(12)) }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowHistory(true)}>
            <Ionicons name="menu" size={scale(24)} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerMid}>
            <LinearGradient colors={['#ff6b9c', '#7f5dff']} style={styles.headerAvatar}>
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
          
          <TouchableOpacity style={styles.headerBtn} onPress={startNewChat}>
            <Ionicons name="add-circle-outline" size={scale(24)} color="#fff" />
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

        {/* Input with safe area insets */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[styles.inputBox, { paddingBottom: Math.max(insets.bottom, scale(12)) }]}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about style, colors, trends..."
              placeholderTextColor="#64748b"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnOff]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              <LinearGradient
                colors={inputText.trim() ? ['#ff6b9c', '#7f5dff'] : ['#334155', '#334155']}
                style={styles.sendGrad}
              >
                <Ionicons name="arrow-up" size={scale(20)} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
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
    paddingVertical: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: scale(11),
    color: '#94a3b8',
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
    padding: scale(16),
    paddingBottom: scale(80),
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
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
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: scale(8),
  },
  avatarLetter: {
    fontSize: scale(12),
    fontWeight: '700',
    color: '#fff',
  },
  bubble: {
    maxWidth: '72%',
    padding: 12,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: '#ff6b9c',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  msgText: {
    fontSize: scale(15),
    color: '#e2e8f0',
    lineHeight: scale(21),
  },
  msgTextUser: {
    color: '#fff',
  },
  time: {
    fontSize: scale(10),
    color: '#64748b',
    marginTop: scale(4),
  },
  timeUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  
  // Empty State
  emptyScroll: {
    flex: 1,
    paddingVertical: scale(20),
    paddingBottom: scale(80),
    justifyContent: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  emptyTitle: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(4),
  },
  emptyDesc: {
    fontSize: scale(14),
    color: '#94a3b8',
    marginBottom: scale(20),
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: scale(12),
    color: '#cbd5e1',
  },
  promptLabel: {
    fontSize: scale(12),
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: scale(12),
  },
  promptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  promptBtn: {
    width: (SCREEN_WIDTH - scale(78)) / 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: scale(12),
    paddingVertical: scale(14),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  promptEmoji: {
    fontSize: scale(24),
    marginBottom: scale(6),
  },
  promptText: {
    fontSize: scale(11),
    color: '#94a3b8',
    fontWeight: '500',
  },
  tip: {
    fontSize: scale(12),
    color: '#64748b',
    textAlign: 'center',
    lineHeight: scale(18),
    paddingHorizontal: scale(20),
  },
  
  // Input
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: scale(12),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0f172a',
    gap: scale(10),
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    color: '#fff',
    fontSize: scale(15),
    maxHeight: scale(100),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: '#0f172a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    paddingBottom: scale(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#fff',
  },
  newBtn: {
    margin: 16,
  },
  newBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  newBtnText: {
    fontSize: scale(16),
    fontWeight: '600',
    color: '#fff',
  },
  convList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  noConv: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  convActive: {
    borderWidth: 1,
    borderColor: '#ff6b9c',
  },
  convInfo: {
    flex: 1,
  },
  convTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  convDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
});
