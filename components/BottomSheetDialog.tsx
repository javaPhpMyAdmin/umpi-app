import { useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Pressable, Animated, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/contexts/ThemeContext';
import type { Palette } from '@/constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: string;
  message: string;
  primaryLabel: string;
  primaryAction: () => void;
  /** Disables the primary button while its action is pending (double-tap guard). */
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  destructiveSecondary?: boolean;
}

export default function BottomSheetDialog({
  visible,
  onClose,
  icon,
  title,
  message,
  primaryLabel,
  primaryAction,
  primaryDisabled,
  secondaryLabel,
  destructiveSecondary,
}: Props) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
      });
    }
  }, [visible, fadeAnim]);

  useEffect(() => {
    if (!visible) return;
    const handler = () => { onClose(); return true; };
    const subscription = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => subscription.remove();
  }, [visible, onClose]);

  if (!mounted) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrapper, { opacity: fadeAnim }]}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom }]} onPress={() => {}}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, primaryDisabled && styles.primaryBtnDisabled]}
            onPress={primaryAction}
            disabled={primaryDisabled}
          >
            <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
          </TouchableOpacity>
          {secondaryLabel && (
            <TouchableOpacity
              style={[styles.secondaryBtn, destructiveSecondary && styles.destructiveBtn]}
              onPress={secondaryLabel === 'Cancelar' ? onClose : undefined}
            >
              <Text style={[styles.secondaryBtnText, destructiveSecondary && styles.destructiveBtnText]}>
                {secondaryLabel}
              </Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  wrapper: {
    zIndex: 1000,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.peachSoft,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: c.white,
    fontWeight: '700',
    fontSize: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    backgroundColor: c.peachMid,
  },
  secondaryBtnText: {
    color: c.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  destructiveBtn: {},
  destructiveBtnText: {
    color: c.error,
    fontWeight: '700',
  },
});
