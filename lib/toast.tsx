import Toast, { BaseToast, BaseToastProps } from 'react-native-toast-message';
import { Colors } from '@/constants/colors';

/*
 * Configuración visual de toasts.
 * Usar desde los componentes:
 *
 *   showSuccess('Listo', 'Publicación creada');
 *   showError('Error', error.message);
 *   showInfo('Aviso', 'No hay resultados');
 */

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#22C55E',
        borderLeftWidth: 0,
        borderRadius: 14,
        height: 'auto',
        paddingVertical: 14,
        paddingHorizontal: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '700',
        color: Colors.white,
      }}
      text2Style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
      }}
    />
  ),

  error: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#EF4444',
        borderLeftWidth: 0,
        borderRadius: 14,
        height: 'auto',
        paddingVertical: 14,
        paddingHorizontal: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '700',
        color: Colors.white,
      }}
      text2Style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
      }}
    />
  ),

  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{
        backgroundColor: '#FF6B35',
        borderLeftWidth: 0,
        borderRadius: 14,
        height: 'auto',
        paddingVertical: 14,
        paddingHorizontal: 20,
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
      }}
      text1Style={{
        fontSize: 15,
        fontWeight: '700',
        color: Colors.white,
      }}
      text2Style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
        marginTop: 2,
      }}
    />
  ),
};

// helpers para usar en los componentes
export const showSuccess = (title: string, message?: string) => {
  Toast.show({ type: 'success', text1: title, text2: message, visibilityTime: 3000, topOffset: 60 });
};

export const showError = (title: string, message?: string) => {
  Toast.show({ type: 'error', text1: title, text2: message, visibilityTime: 4000, topOffset: 60 });
};

export const showInfo = (title: string, message?: string) => {
  Toast.show({ type: 'info', text1: title, text2: message, visibilityTime: 3000, topOffset: 60 });
};
