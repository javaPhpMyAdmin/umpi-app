import { ReactNode } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: string;
  message: string;
  primaryLabel: string;
  primaryAction: () => void;
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
  secondaryLabel,
  destructiveSecondary,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={primaryAction}>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  destructiveBtn: {},
  destructiveBtnText: {
    color: Colors.error,
    fontWeight: '700',
  },
});
