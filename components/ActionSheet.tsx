import { ReactNode } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import { Colors } from '@/constants/colors';

interface ActionSheetOption {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  action: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  options: ActionSheetOption[];
}

export default function ActionSheet({ visible, onClose, options }: ActionSheetProps) {
  const handleOptionPress = (option: ActionSheetOption) => {
    option.action();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.option, index < options.length - 1 && styles.optionBorder]}
                onPress={() => handleOptionPress(option)}
              >
                {option.icon && <View style={styles.optionIcon}>{option.icon}</View>}
                <Text style={[styles.optionLabel, option.destructive && styles.optionDestructive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  optionDestructive: {
    color: Colors.error,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.borderLight,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
