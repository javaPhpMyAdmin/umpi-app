import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';

interface MessageTickProps {
  isRead: boolean;
}

/**
 * WhatsApp-style read receipt ticks for sent messages (React Native).
 *
 * - Unread (isRead=false): single grey checkmark
 * - Read (isRead=true): double blue checkmark
 */
export function MessageTick({ isRead }: MessageTickProps) {
  if (isRead) {
    return <CheckCheck size={14} color="#2563eb" style={styles.tick} />;
  }
  return <Check size={14} color="#95a5a6" style={styles.tick} />;
}

const styles = StyleSheet.create({
  tick: {
    marginLeft: 4,
    alignSelf: 'center',
  },
});
