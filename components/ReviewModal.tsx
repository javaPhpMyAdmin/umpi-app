import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number) => Promise<void>;
  conversationId: string;
}

export default function ReviewModal({ visible, onClose, onSubmit }: ReviewModalProps) {
  const [selectedRating, setSelectedRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (selectedRating < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(selectedRating);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar la calificación. Intentalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const reset = () => {
    setSelectedRating(0);
    setError(null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.title}>Calificar al vendedor</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => !submitting && setSelectedRating(star)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Star
                  size={36}
                  color={star <= selectedRating ? Colors.star : Colors.border}
                  fill={star <= selectedRating ? Colors.star : 'none'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitBtn, (selectedRating < 1 || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={selectedRating < 1 || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Enviar calificación</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} disabled={submitting} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, submitting && styles.cancelTextDisabled]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
    zIndex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 20,
    marginTop: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  cancelBtn: {
    paddingVertical: 6,
  },
  cancelText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelTextDisabled: {
    opacity: 0.4,
  },
});
