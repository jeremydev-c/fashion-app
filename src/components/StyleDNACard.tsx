import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { scale, verticalScale } from '../utils/responsive';

interface StyleDNA {
  primaryStyle: string;
  styleArchetype?: string;
  styleMantra?: string;
  styleInsight?: string;
  capsuleEssentials?: string[];
  secondaryStyles: string[];
  colorPreferences: {
    dominantColors: { color: string; name?: string; percentage: number }[];
    colorPalette: string[];
    seasonalColors: { spring: string[]; summer: string[]; fall: string[]; winter: string[] };
  };
  brandAffinity: { brand: string; count: number; score: number }[];
  uniquenessScore: number;
  styleConsistency: number;
  trendAlignment: number;
}

interface Props {
  dna: StyleDNA;
  username?: string;
}

const SEASON_ICONS: Record<string, string> = {
  spring: '🌸',
  summer: '☀️',
  fall: '🍂',
  winter: '❄️',
};

function ScoreDot({ filled }: { filled: boolean }) {
  return (
    <View style={[styles.dot, filled && styles.dotFilled]} />
  );
}

function ScoreBar({ value, label, icon }: { value: number; label: string; icon: string }) {
  const pct = Math.round(value * 100);
  const filled = Math.round(value * 5);
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreIcon}>{icon}</Text>
      <View style={styles.scoreMiddle}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <ScoreDot key={i} filled={i < filled} />
          ))}
        </View>
      </View>
      <Text style={styles.scorePct}>{pct}%</Text>
    </View>
  );
}

const StyleDNACard = forwardRef<View, Props>(({ dna, username }, ref) => {
  const palette = dna.colorPreferences?.colorPalette?.slice(0, 6) || [];
  const dominant = dna.colorPreferences?.dominantColors?.slice(0, 4) || [];
  const brands = dna.brandAffinity?.slice(0, 4) || [];
  const seasonal = dna.colorPreferences?.seasonalColors;

  // Derive gradient from top two palette colors or use gold default
  const grad1 = palette[0] || '#c8a55a';
  const grad2 = palette[1] || '#1a1208';

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Header gradient band */}
      <LinearGradient
        colors={[grad1, '#0d0d0d', '#0d0d0d']}
        locations={[0, 0.45, 1]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={styles.dnaLabel}>
            <Ionicons name="finger-print" size={scale(13)} color={grad1} />
            <Text style={[styles.dnaLabelText, { color: grad1 }]}>STYLE DNA</Text>
          </View>
          {username ? <Text style={styles.usernameText}>@{username}</Text> : null}
        </View>

        {/* Archetype + Primary */}
        <View style={styles.heroSection}>
          {dna.styleArchetype ? (
            <Text style={styles.archetypeText}>{dna.styleArchetype}</Text>
          ) : null}
          <Text style={[styles.primaryStyleText, { color: grad1 }]}>
            {dna.primaryStyle?.toUpperCase()}
          </Text>
          {dna.styleMantra ? (
            <Text style={styles.mantraText}>"{dna.styleMantra}"</Text>
          ) : null}
        </View>

        {/* Colour palette strip */}
        {palette.length > 0 && (
          <View style={styles.paletteStrip}>
            {palette.map((hex, i) => (
              <View key={i} style={[styles.paletteBlock, { backgroundColor: hex }]} />
            ))}
          </View>
        )}
      </LinearGradient>

      {/* Body */}
      <View style={styles.body}>

        {/* Style Insight */}
        {dna.styleInsight ? (
          <View style={styles.insightBox}>
            <Text style={styles.sectionLabel}>STYLE INSIGHT</Text>
            <Text style={styles.insightText}>{dna.styleInsight}</Text>
          </View>
        ) : null}

        {/* Scores */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>STYLE METRICS</Text>
          <ScoreBar value={dna.uniquenessScore} label="Uniqueness" icon="✦" />
          <ScoreBar value={dna.styleConsistency} label="Consistency" icon="◈" />
          <ScoreBar value={dna.trendAlignment} label="Trend Alignment" icon="◎" />
        </View>

        {/* Secondary styles */}
        {dna.secondaryStyles?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>STYLE INFLUENCES</Text>
            <View style={styles.tagsRow}>
              {dna.secondaryStyles.map((s, i) => (
                <View key={i} style={[styles.tag, { borderColor: grad1 }]}>
                  <Text style={[styles.tagText, { color: grad1 }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Dominant colours */}
        {dominant.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COLOUR PROFILE</Text>
            <View style={styles.colorRow}>
              {dominant.map((c, i) => (
                <View key={i} style={styles.colorItem}>
                  <View style={[styles.colorSwatch, { backgroundColor: c.color }]} />
                  <Text style={styles.colorName} numberOfLines={1}>
                    {c.name || c.color}
                  </Text>
                  <Text style={styles.colorPct}>{Math.round(c.percentage)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Seasonal */}
        {seasonal && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SEASONAL PALETTE</Text>
            <View style={styles.seasonRow}>
              {(['spring', 'summer', 'fall', 'winter'] as const).map((s) => {
                const cols = seasonal[s]?.slice(0, 3) || [];
                return (
                  <View key={s} style={styles.seasonItem}>
                    <Text style={styles.seasonIcon}>{SEASON_ICONS[s]}</Text>
                    <View style={styles.seasonDots}>
                      {cols.map((hex, i) => (
                        <View key={i} style={[styles.seasonDot, { backgroundColor: hex }]} />
                      ))}
                      {cols.length === 0 && <View style={[styles.seasonDot, { backgroundColor: '#333' }]} />}
                    </View>
                    <Text style={styles.seasonName}>{s}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Capsule essentials */}
        {dna.capsuleEssentials?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CAPSULE ESSENTIALS</Text>
            {dna.capsuleEssentials.map((item, i) => (
              <View key={i} style={styles.capsuleItem}>
                <View style={[styles.capsuleDot, { backgroundColor: grad1 }]} />
                <Text style={styles.capsuleText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Brands */}
        {brands.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>BRAND AFFINITY</Text>
            <View style={styles.tagsRow}>
              {brands.map((b, i) => (
                <View key={i} style={styles.brandTag}>
                  <Text style={styles.brandText}>{b.brand}</Text>
                  <Text style={styles.brandCount}>×{b.count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer watermark */}
        <View style={styles.footer}>
          <View style={[styles.footerLine, { backgroundColor: grad1 }]} />
          <Text style={styles.footerText}>Fashion Fit · Style DNA</Text>
          <View style={[styles.footerLine, { backgroundColor: grad1 }]} />
        </View>
      </View>
    </View>
  );
});

StyleDNACard.displayName = 'StyleDNACard';
export default StyleDNACard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0d0d0d',
    borderRadius: scale(20),
    overflow: 'hidden',
    width: '100%',
  },
  headerGradient: {
    paddingTop: verticalScale(20),
    paddingHorizontal: scale(20),
    paddingBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(18),
  },
  dnaLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
  },
  dnaLabelText: {
    fontSize: scale(10),
    fontWeight: '700',
    letterSpacing: scale(2),
  },
  usernameText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: scale(0.5),
  },
  heroSection: {
    marginBottom: verticalScale(20),
  },
  archetypeText: {
    fontSize: scale(13),
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: scale(0.5),
    marginBottom: verticalScale(4),
  },
  primaryStyleText: {
    fontSize: scale(32),
    fontWeight: '800',
    letterSpacing: scale(3),
    lineHeight: verticalScale(38),
  },
  mantraText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
    marginTop: verticalScale(6),
    lineHeight: verticalScale(17),
  },
  paletteStrip: {
    flexDirection: 'row',
    height: verticalScale(6),
    borderRadius: scale(3),
    overflow: 'hidden',
    marginBottom: verticalScale(-1),
  },
  paletteBlock: {
    flex: 1,
  },
  body: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(16),
    gap: verticalScale(4),
  },
  section: {
    marginBottom: verticalScale(16),
  },
  sectionLabel: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: scale(2),
    fontWeight: '700',
    marginBottom: verticalScale(8),
  },
  insightBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: scale(10),
    padding: scale(12),
    marginBottom: verticalScale(16),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  insightText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.7)',
    lineHeight: verticalScale(18),
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
    gap: scale(10),
  },
  scoreIcon: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.4)',
    width: scale(16),
    textAlign: 'center',
  },
  scoreMiddle: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.6)',
    marginBottom: verticalScale(3),
  },
  dotsRow: {
    flexDirection: 'row',
    gap: scale(4),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  dotFilled: {
    backgroundColor: '#c8a55a',
    borderColor: '#c8a55a',
  },
  scorePct: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.4)',
    width: scale(34),
    textAlign: 'right',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(6),
  },
  tag: {
    borderWidth: 1,
    borderRadius: scale(20),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
  },
  tagText: {
    fontSize: scale(11),
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  colorRow: {
    flexDirection: 'row',
    gap: scale(10),
  },
  colorItem: {
    alignItems: 'center',
    flex: 1,
  },
  colorSwatch: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    marginBottom: verticalScale(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  colorName: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  colorPct: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.3)',
  },
  seasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seasonItem: {
    alignItems: 'center',
    flex: 1,
  },
  seasonIcon: {
    fontSize: scale(16),
    marginBottom: verticalScale(4),
  },
  seasonDots: {
    flexDirection: 'row',
    gap: scale(3),
    marginBottom: verticalScale(4),
  },
  seasonDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  seasonName: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'capitalize',
    letterSpacing: scale(0.5),
  },
  capsuleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: scale(8),
    marginBottom: verticalScale(6),
  },
  capsuleDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
    marginTop: verticalScale(5),
  },
  capsuleText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.65)',
    flex: 1,
    lineHeight: verticalScale(17),
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(4),
    borderRadius: scale(20),
    gap: scale(4),
  },
  brandText: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  brandCount: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.3)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    marginTop: verticalScale(8),
    paddingTop: verticalScale(12),
  },
  footerLine: {
    flex: 1,
    height: 1,
    opacity: 0.25,
  },
  footerText: {
    fontSize: scale(9),
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: scale(1.5),
  },
});
