import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { useThemeColors } from '@/contexts/ThemeContext';

interface UserAvatarProps {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  backgroundColor?: string;
}

export function UserAvatar({ url, name, size = 44, backgroundColor }: UserAvatarProps) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);
  const initial = (name || '?')[0].toUpperCase();

  // Resetear el fallback si cambia la URL (nuevo avatar o cache-buster).
  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: backgroundColor || c.borderLight }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: backgroundColor || c.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: c.white }}>
        {initial}
      </Text>
    </View>
  );
}
