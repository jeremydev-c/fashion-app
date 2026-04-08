import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useThemeColors } from '../theme/ThemeProvider';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { scale, verticalScale } from '../utils/responsive';
import { ClothingItem, createClothingItem, deleteClothingItem, fetchWardrobeItems, ClothingCategory } from '../services/wardrobeApi';
import { smartCategorizeImage, type EnhancedAiCategorizationResponse } from '../services/aiCategorization';
import { uploadImageFile } from '../services/uploadService';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useUserId } from '../hooks/useUserId';
import CameraScreen from './CameraScreen';
import BulkCameraScreen from './BulkCameraScreen';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../services/apiClient';

const CATEGORIES: (ClothingCategory | 'all')[] = ['all', 'top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'other'];

export const WardrobeScreen: React.FC = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const { t } = useTranslation();

  const [addOpen, setAddOpen] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [bulkCameraOpen, setBulkCameraOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ClothingCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  
  // Form state
  const [category, setCategory] = useState<ClothingCategory>('top');
  const [color, setColor] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedName, setGeneratedName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiResult, setAiResult] = useState<EnhancedAiCategorizationResponse | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [style, setStyle] = useState('');
  const [pattern, setPattern] = useState('');
  const [fit, setFit] = useState('');
  const [occasion, setOccasion] = useState<string[]>([]);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<ClothingItem[], Error>({
    queryKey: ['wardrobe', userId],
    queryFn: () => fetchWardrobeItems(userId!),
    enabled: !!userId,
  });

  // Filter and search items
  const filteredItems = useMemo(() => {
    let filtered = data ?? [];
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.color?.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.subcategory?.toLowerCase().includes(query) ||
        item.style?.toLowerCase().includes(query) ||
        item.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [data, selectedCategory, searchQuery]);

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error('User not available');
      }

      let finalImageUrl = imageUri;
      let thumbnailUrl: string | undefined;
      let mediumUrl: string | undefined;
      let cloudinaryPublicId: string | undefined;

      // Upload to Cloudinary if image exists
      if (imageUri) {
        try {
          setUploading(true);
          const uploadResult = await uploadImageFile(imageUri, {
            enhance: true,
            folder: 'wardrobe',
          });
          finalImageUrl = uploadResult.image.url;
          thumbnailUrl = uploadResult.image.thumbnailUrl;
          mediumUrl = uploadResult.image.mediumUrl;
          cloudinaryPublicId = uploadResult.image.publicId;
        } catch (error) {
          console.log('Cloudinary upload failed:', error);
          // Continue with local URI if upload fails
        } finally {
          setUploading(false);
        }
      }

      return createClothingItem({
        userId,
        name: generatedName || 'Wardrobe item',
        category,
        subcategory: subcategory || undefined,
        color: color.trim() || undefined,
        colorPalette: aiResult?.colorPalette || undefined,
        brand: aiResult?.brand || undefined,
        size: undefined,
        imageUrl: finalImageUrl,
        thumbnailUrl,
        mediumUrl,
        cloudinaryPublicId,
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        style: style || undefined,
        pattern: pattern || undefined,
        fit: fit || undefined,
        occasion: occasion.length > 0 ? occasion : undefined,
        favorite: false,
        aiConfidence: aiResult?.confidence,
        aiProcessed: !!aiResult,
        semanticProfile: aiResult?.semanticProfile,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe', userId] });
      queryClient.invalidateQueries({ queryKey: ['styleDNA', userId] });
      setGeneratedName('');
      setColor('');
      setTagsText('');
      setSubcategory('');
      setStyle('');
      setPattern('');
      setFit('');
      setOccasion([]);
      setImageUri(undefined);
      setAiResult(null);
      setFormError(null);
      setAddOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClothingItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe', userId] });
    },
  });

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setFormError('We need photo permissions to pick an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      // Reset previous AI understanding when a new photo is chosen
      setGeneratedName('');
      setCategory('top');
      setColor('');
      setTagsText('');
      setSubcategory('');
      setStyle('');
      setPattern('');
      setFit('');
      setOccasion([]);
      setAiResult(null);
      setFormError(null);
    }
  };

  const handleRunAi = async () => {
    if (!imageUri) {
      setFormError('Pick a photo first.');
      return;
    }

    try {
      setFormError(null);
      setAiLoading(true);
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await smartCategorizeImage(base64);
      
      // Store full AI result
      setAiResult(res);
      
      // Auto-fill all fields from AI
      if (res.category) {
        setCategory(res.category as typeof category);
      }
      if (res.subcategory) {
        setSubcategory(res.subcategory);
      }
      if (res.color) {
        setColor(res.color);
      }
      if (res.style) {
        setStyle(res.style);
      }
      if (res.pattern) {
        setPattern(res.pattern);
      }
      if (res.fit) {
        setFit(res.fit);
      }
      if (res.occasion && res.occasion.length > 0) {
        setOccasion(res.occasion);
      }
      if (res.tags && res.tags.length > 0) {
        setTagsText(res.tags.join(', '));
      }
      
      // Generate smart name
      const nameParts = [];
      if (res.color) nameParts.push(res.color);
      if (res.subcategory) {
        nameParts.push(res.subcategory);
      } else if (res.category) {
        nameParts.push(res.category);
      }
      setGeneratedName(nameParts.join(' ').trim() || 'Wardrobe item');
    } catch (err) {
      console.warn('Smart categorize failed', err);
      setFormError(
        (err as Error)?.message || 'AI categorization failed. You can still save manually.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!imageUri) {
      setFormError('Pick a photo first.');
      return;
    }
    setFormError(null);
    addItemMutation.mutate();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t('wardrobe.removeItem'),
      t('wardrobe.removeItemConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ],
    );
  };

  // Helper function to get color hex (simplified)
  function getColorHex(colorName: string): string {
    const colorMap: Record<string, string> = {
      black: '#000000',
      white: '#ffffff',
      gray: '#808080',
      grey: '#808080',
      navy: '#000080',
      blue: '#0000ff',
      red: '#ff0000',
      green: '#008000',
      yellow: '#ffff00',
      orange: '#ffa500',
      pink: '#ffc0cb',
      purple: '#800080',
      brown: '#a52a2a',
      beige: '#f5f5dc',
      tan: '#d2b48c',
      khaki: '#c3b091',
    };
    const lower = colorName.toLowerCase();
    return colorMap[lower] || colorMap[lower.split(' ')[0]] || '#808080';
  }

  // Camera screens
  if (cameraOpen) {
    return (
      <CameraScreen
        onClose={() => setCameraOpen(false)}
        onSave={() => {
          setCameraOpen(false);
          refetch();
        }}
      />
    );
  }

  if (bulkCameraOpen) {
    return (
      <BulkCameraScreen
        onClose={() => setBulkCameraOpen(false)}
        onComplete={() => {
          setBulkCameraOpen(false);
          refetch();
        }}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: spacing['2xl'] + insets.top }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.title}>{t('wardrobe.title')}</Text>
          <Text style={styles.subtitle}>
            {t('wardrobe.subtitle')}
          </Text>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('wardrobe.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContainer}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryTab,
                  selectedCategory === cat && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    selectedCategory === cat && styles.categoryTabTextActive,
                  ]}
                >
                  {cat === 'all' ? t('wardrobe.categories.all') : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Stats Row */}
          <View style={styles.row}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <Text style={styles.summaryLabel}>{t('wardrobe.totalItems')}</Text>
              <Text style={styles.summaryValue}>{data?.length || 0}</Text>
              <Text style={styles.summaryHint}>
                {filteredItems.length === (data?.length || 0)
                  ? t('wardrobe.allItemsLabel')
                  : `${filteredItems.length} ${t('wardrobe.shown')}`}
              </Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <Text style={styles.summaryLabel}>{t('wardrobe.viewMode')}</Text>
              <View style={styles.viewModeToggle}>
                <TouchableOpacity
                  style={[styles.viewModeButton, viewMode === 'grid' && styles.viewModeButtonActive]}
                  onPress={() => setViewMode('grid')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="grid"
                    size={18}
                    color={viewMode === 'grid' ? colors.background : colors.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
                  onPress={() => setViewMode('list')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons 
                    name="list" 
                    size={18} 
                    color={viewMode === 'list' ? colors.background : colors.textMuted} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {isLoading && (
            <View style={styles.stateContainer}>
              <LoadingSpinner size="medium" message="Loading your wardrobe…" />
            </View>
          )}

          {isError && (
            <View style={styles.stateContainer}>
              <Text style={styles.errorTitle}>{t('wardrobe.failedToLoad')}</Text>
              <Text style={styles.errorText}>{error?.message}</Text>
            </View>
          )}

          {!isLoading && !isError && (data?.length || 0) === 0 && (
            <Card variant="outlined" style={styles.gridEmpty}>
              <Ionicons name="shirt-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('wardrobe.noItems')}</Text>
              <Text style={styles.emptyBody}>
                {t('wardrobe.addFirstItem')}
              </Text>
            </Card>
          )}

          {!isLoading && !isError && (data?.length || 0) > 0 && filteredItems.length === 0 && (
            <Card variant="outlined" style={styles.gridEmpty}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('common.noResults')}</Text>
              <Text style={styles.emptyBody}>
                {t('wardrobe.adjustFilter')}
              </Text>
            </Card>
          )}

          {!isLoading && !isError && filteredItems.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {selectedCategory === 'all' ? 'All Items' : selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                </Text>
                <Text style={styles.itemCount}>{filteredItems.length} items</Text>
              </View>
              {viewMode === 'grid' ? (
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item._id}
                  scrollEnabled={false}
                  numColumns={2}
                  columnWrapperStyle={{ gap: spacing.md }}
                  contentContainerStyle={{ gap: spacing.md }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.itemCard, { backgroundColor: colors.card }]}
                      onPress={() => setSelectedItem(item)}
                      activeOpacity={0.7}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.deleteBadge}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDelete(item._id);
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Ionicons name="close" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                      <Image
                        source={{ uri: item.thumbnailUrl || item.mediumUrl || item.imageUrl }}
                        style={styles.itemImageLarge}
                        resizeMode="cover"
                        onError={() => {}}
                      />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <View style={styles.chipRow}>
                          <Badge 
                            label={item.category.toUpperCase()} 
                            variant="primary" 
                            style={styles.categoryBadge}
                            textStyle={styles.categoryBadgeText}
                          />
                          {item.color && (
                            <View style={[styles.colorDot, { backgroundColor: getColorHex(item.color) }]} />
                          )}
                          {item.favorite && (
                            <Ionicons name="star" size={14} color={colors.accent} style={styles.favoriteIcon} />
                          )}
                        </View>
                        {item.subcategory && (
                          <Text style={styles.itemSubcategory} numberOfLines={1}>
                            {item.subcategory}
                          </Text>
                        )}
                        {item.style && (
                          <Text style={styles.itemMeta} numberOfLines={1}>
                            {item.style} • {item.pattern || 'solid'}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              ) : (
                <View style={styles.listContainer}>
                  {filteredItems.map((item) => (
                    <TouchableOpacity
                      key={item._id}
                      style={styles.listItem}
                      onPress={() => setSelectedItem(item)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: item.thumbnailUrl || item.mediumUrl || item.imageUrl }}
                        style={styles.listItemImage}
                        resizeMode="cover"
                        onError={() => {}}
                      />
                      <View style={styles.listItemInfo}>
                        <View style={styles.listItemHeader}>
                          <Text style={styles.listItemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDelete(item._id);
                            }}
                            style={styles.listDeleteButton}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                        {item.subcategory && (
                          <Text style={styles.listItemSubcategory} numberOfLines={1}>
                            {item.subcategory}
                          </Text>
                        )}
                        <View style={styles.listItemMeta}>
                          <Badge label={item.category} variant="primary" style={styles.listBadge} />
                          {item.color && (
                            <>
                              <View style={[styles.colorDot, { backgroundColor: getColorHex(item.color) }]} />
                              <Text style={styles.listItemColor}>{item.color}</Text>
                            </>
                          )}
                          {item.style && (
                            <Text style={styles.listItemStyle}>• {item.style}</Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Add button with options */}
      {!addOpen && !cameraOpen && !bulkCameraOpen && (
        <>
          {showAddOptions && (
            <View style={styles.fabOptions}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.fabOption}
                onPress={() => { setShowAddOptions(false); setCameraOpen(true); }}
              >
                <Ionicons name="camera" size={20} color={colors.textPrimary} />
                <Text style={styles.fabOptionText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.fabOption}
                onPress={async () => {
                  setShowAddOptions(false);
                  try {
                    await apiClient.get(`/wardrobe/can-bulk?userId=${userId}`);
                    setBulkCameraOpen(true);
                  } catch (e: any) {
                    if (e?.message?.includes('upgrade') || e?.message?.includes('requires')) {
                      Alert.alert('Pro Feature', 'Bulk Upload requires a Pro plan. Upgrade to add multiple items at once.');
                    } else {
                      setBulkCameraOpen(true);
                    }
                  }
                }}
              >
                <Ionicons name="images" size={20} color={colors.textPrimary} />
                <Text style={styles.fabOptionText}>{t('wardrobe.bulkAdd')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.fabOption}
                onPress={() => { setShowAddOptions(false); setAddOpen(true); }}
              >
                <Ionicons name="create" size={20} color={colors.textPrimary} />
                <Text style={styles.fabOptionText}>{t('wardrobe.addManually')}</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.fab, showAddOptions && styles.fabActive]}
            onPress={() => setShowAddOptions(!showAddOptions)}
          >
            <Ionicons name={showAddOptions ? "close" : "add"} size={24} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
        <View style={styles.modalOverlay}>
          <Card
            variant="elevated"
            style={StyleSheet.flatten([styles.modalCard, { backgroundColor: colors.card }])}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Item Details</Text>
              <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setSelectedItem(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedItem.imageUrl && (
                <Image
                  source={{ uri: selectedItem.imageUrl }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.modalContent}>
                <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                {selectedItem.subcategory && (
                  <Text style={styles.modalSubcategory}>{selectedItem.subcategory}</Text>
                )}
                <View style={styles.modalDetails}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalLabel}>Category:</Text>
                    <Badge label={selectedItem.category} variant="primary" />
                  </View>
                  {selectedItem.color && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Color:</Text>
                      <View style={styles.modalColorRow}>
                        <View style={[styles.modalColorDot, { backgroundColor: getColorHex(selectedItem.color) }]} />
                        <Text style={styles.modalValue}>{selectedItem.color}</Text>
                      </View>
                    </View>
                  )}
                  {selectedItem.brand && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Brand:</Text>
                      <Text style={styles.modalValue}>{selectedItem.brand}</Text>
                    </View>
                  )}
                  {selectedItem.style && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Style:</Text>
                      <Text style={styles.modalValue}>{selectedItem.style}</Text>
                    </View>
                  )}
                  {selectedItem.pattern && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Pattern:</Text>
                      <Text style={styles.modalValue}>{selectedItem.pattern}</Text>
                    </View>
                  )}
                  {selectedItem.fit && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Fit:</Text>
                      <Text style={styles.modalValue}>{selectedItem.fit}</Text>
                    </View>
                  )}
                  {selectedItem.occasion && selectedItem.occasion.length > 0 && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Occasions:</Text>
                      <Text style={styles.modalValue}>{selectedItem.occasion.join(', ')}</Text>
                    </View>
                  )}
                  {selectedItem.tags && selectedItem.tags.length > 0 && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>Tags:</Text>
                      <View style={styles.modalTags}>
                        {selectedItem.tags.map((tag, idx) => (
                          <Badge key={idx} label={tag} variant="neutral" style={styles.modalTag} />
                        ))}
                      </View>
                    </View>
                  )}
                  {selectedItem.aiConfidence && (
                    <View style={styles.modalDetailRow}>
                      <Text style={styles.modalLabel}>AI Confidence:</Text>
                      <Text style={styles.modalValue}>{Math.round(selectedItem.aiConfidence * 100)}%</Text>
                    </View>
                  )}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDeleteButton}
              onPress={() => {
                setSelectedItem(null);
                handleDelete(selectedItem._id);
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.modalDeleteText}>Delete Item</Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}

      {/* Full-screen Add overlay */}
      {addOpen && (
        <View style={styles.addOverlay}>
          <View style={[styles.addOverlayCard, { backgroundColor: colors.card }]}>
            <View style={styles.addOverlayHeader}>
              <Text style={styles.addPanelTitle}>Add wardrobe item</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!addItemMutation.isPending) setAddOpen(false);
                }}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.bigPhotoArea}
              onPress={handlePickImage}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.bigPhoto} />
              ) : (
                <Text style={styles.photoButtonText}>Tap to pick a photo</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.aiButton,
                (!imageUri || aiLoading) && { opacity: 0.5 },
              ]}
              onPress={handleRunAi}
              disabled={!imageUri || aiLoading}
            >
              {aiLoading ? (
                <View style={styles.aiButtonContent}>
                  <ActivityIndicator color={colors.background} size="small" />
                  <Text style={styles.aiButtonText}>Analyzing with AI…</Text>
                </View>
              ) : (
                <Text style={styles.aiButtonText}>Let AI understand this item</Text>
              )}
            </TouchableOpacity>

            {aiResult && (
              <View style={styles.aiSummary}>
                <Text style={styles.aiSummaryTitle}>
                  AI Analysis ({Math.round(aiResult.confidence * 100)}% confidence)
                </Text>
                <View style={styles.aiDetails}>
                  {!!generatedName && (
                    <Text style={styles.aiSummaryText}>Name: {generatedName}</Text>
                  )}
                  <Text style={styles.aiSummaryText}>Category: {category}</Text>
                  {!!subcategory && (
                    <Text style={styles.aiSummaryText}>Subcategory: {subcategory}</Text>
                  )}
                  {!!color && (
                    <Text style={styles.aiSummaryText}>Color: {color}</Text>
                  )}
                  {!!style && (
                    <Text style={styles.aiSummaryText}>Style: {style}</Text>
                  )}
                  {!!pattern && (
                    <Text style={styles.aiSummaryText}>Pattern: {pattern}</Text>
                  )}
                  {!!fit && (
                    <Text style={styles.aiSummaryText}>Fit: {fit}</Text>
                  )}
                  {occasion.length > 0 && (
                    <Text style={styles.aiSummaryText}>
                      Occasions: {occasion.join(', ')}
                    </Text>
                  )}
                  {aiResult.colorPalette && aiResult.colorPalette.length > 0 && (
                    <Text style={styles.aiSummaryText}>
                      Color Palette: {aiResult.colorPalette.join(', ')}
                    </Text>
                  )}
                  {aiResult.brand && (
                    <Text style={styles.aiSummaryText}>Brand: {aiResult.brand}</Text>
                  )}
                </View>
                <TextInput
                  style={styles.tagInput}
                  placeholder="Tags (you can tweak AI tags here)"
                  placeholderTextColor={colors.textMuted}
                  value={tagsText}
                  onChangeText={setTagsText}
                />
                <Text style={styles.aiHint}>
                  All fields auto-filled by AI. You can adjust any field before saving.
                </Text>
              </View>
            )}

            {formError && (
              <Text style={styles.formError}>{formError}</Text>
            )}

            {addItemMutation.isError && (
              <Text style={styles.formError}>
                {(addItemMutation.error as Error)?.message ??
                  'Failed to save item.'}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.addButton,
                (addItemMutation.isPending || uploading) && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={addItemMutation.isPending || uploading}
            >
              <Text style={styles.addButtonText}>
                {uploading
                  ? 'Uploading to Cloudinary…'
                  : addItemMutation.isPending
                  ? 'Saving…'
                  : 'Save item'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing['2xl'],
  },
  summaryCard: {
    flex: 1,
    borderRadius: scale(18),
    padding: spacing.lg,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  summaryLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.bodyBold,
    fontSize: scale(18),
    marginBottom: spacing.xs,
  },
  summaryHint: {
    ...typography.caption,
  },
  stateContainer: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    ...typography.caption,
  },
  errorTitle: {
    ...typography.bodyBold,
    fontSize: scale(16),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  gridEmpty: {
    marginTop: spacing['2xl'],
    padding: spacing['2xl'],
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.cardSoft,
  },
  emptyTitle: {
    ...typography.bodyBold,
    fontSize: scale(16),
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.body,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.md,
  },
  itemCard: {
    flex: 1,
    borderRadius: scale(14),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
  },
  deleteBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    zIndex: 10,
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  deleteBadgeText: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: scale(10),
  },
  itemImageLarge: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  itemInfo: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  itemName: {
    ...typography.bodyBold,
    marginBottom: verticalScale(2),
  },
  itemMeta: {
    ...typography.caption,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeChip: {
    paddingHorizontal: spacing.xs,
    paddingVertical: verticalScale(2),
    borderRadius: scale(999),
    backgroundColor: colors.primarySoft,
  },
  typeChipText: {
    ...typography.caption,
    color: colors.primary,
    fontSize: scale(10),
  },
  colorDotOuter: {
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotInner: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: colors.accent,
  },
  favorite: {
    ...typography.bodyBold,
    color: colors.accent,
    marginLeft: spacing.md,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: verticalScale(100),
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: scale(12),
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 8,
    zIndex: 100,
  },
  fabActive: {
    backgroundColor: colors.secondary,
  },
  fabOptions: {
    position: 'absolute',
    right: spacing.xl,
    bottom: verticalScale(170),
    gap: spacing.sm,
    zIndex: 99,
  },
  fabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: scale(12),
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  fabOptionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  fabPlus: {
    ...typography.bodyBold,
    color: colors.background,
    fontSize: scale(28),
    lineHeight: scale(28),
  },
  addOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  addOverlayCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: scale(24),
    padding: spacing.lg,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  addOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addPanelTitle: {
    ...typography.bodyBold,
    fontSize: scale(16),
  },
  closeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  photoButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: scale(999),
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  photoButtonText: {
    ...typography.caption,
    color: colors.primary,
  },
  photoPreview: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(10),
  },
  aiSummary: {
    marginTop: spacing.md,
    borderRadius: scale(14),
    padding: spacing.md,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  aiSummaryTitle: {
    ...typography.bodyBold,
    fontSize: scale(14),
    marginBottom: spacing.sm,
    color: colors.primary,
  },
  aiDetails: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  aiSummaryText: {
    ...typography.caption,
    fontSize: scale(12),
    lineHeight: scale(18),
  },
  tagInput: {
    marginTop: spacing.xs,
    borderRadius: scale(10),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    color: colors.textPrimary,
    backgroundColor: colors.inputBg,
  },
  aiHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  formError: {
    ...typography.caption,
    color: colors.danger,
  },
  addButton: {
    marginTop: spacing.sm,
    borderRadius: scale(999),
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  addButtonText: {
    ...typography.bodyBold,
    color: colors.background,
  },
  aiButton: {
    marginTop: spacing.md,
    borderRadius: scale(999),
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiButtonText: {
    ...typography.caption,
    color: colors.background,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.cardSoft,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  clearButton: {
    marginLeft: spacing.xs,
  },
  // Category tabs
  categoryScroll: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  categoryContainer: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  categoryTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: scale(999),
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  categoryTabActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  categoryTabText: {
    ...typography.caption,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  // View mode toggle
  viewModeToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  viewModeButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  itemCount: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // Grid view improvements
  categoryBadge: {
    marginRight: spacing.xs,
  },
  categoryBadgeText: {
    fontSize: scale(9),
  },
  colorDot: {
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  favoriteIcon: {
    marginLeft: spacing.xs,
  },
  itemSubcategory: {
    ...typography.caption,
    fontSize: scale(11),
    color: colors.textMuted,
    marginTop: verticalScale(2),
  },
  // List view
  listContainer: {
    gap: spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    backgroundColor: colors.cardSoft,
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  listItemImage: {
    width: scale(80),
    height: scale(100),
  },
  listItemInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  listItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  listItemName: {
    ...typography.bodyBold,
    flex: 1,
    marginRight: spacing.sm,
  },
  listDeleteButton: {
    padding: spacing.xs,
  },
  listItemSubcategory: {
    ...typography.caption,
    fontSize: scale(11),
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  listBadge: {
    marginRight: spacing.xs,
  },
  listItemColor: {
    ...typography.caption,
    fontSize: scale(11),
  },
  listItemStyle: {
    ...typography.caption,
    fontSize: scale(11),
    color: colors.textMuted,
  },
  // Modal
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 1000,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: scale(24),
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalTitle: {
    ...typography.title,
    fontSize: scale(20),
  },
  modalImage: {
    width: '100%',
    height: verticalScale(300),
    backgroundColor: colors.cardSoft,
  },
  modalContent: {
    padding: spacing.lg,
  },
  modalItemName: {
    ...typography.title,
    fontSize: scale(22),
    marginBottom: spacing.xs,
  },
  modalSubcategory: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  modalDetails: {
    gap: spacing.md,
  },
  modalDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  modalLabel: {
    ...typography.bodyBold,
    minWidth: scale(100),
  },
  modalValue: {
    ...typography.body,
    flex: 1,
  },
  modalColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalColorDot: {
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  modalTag: {
    marginRight: spacing.xs,
  },
  modalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  modalDeleteText: {
    ...typography.bodyBold,
    color: colors.danger,
  },
  bigPhotoArea: {
    width: '100%',
    height: verticalScale(200),
    borderRadius: scale(16),
    backgroundColor: colors.cardSoft,
    borderWidth: scale(2),
    borderColor: colors.borderSubtle,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  bigPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: scale(14),
  },
});
