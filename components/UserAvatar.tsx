import { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Colors } from '@/constants/colors';

interface UserAvatarProps {
  url: string | null | undefined;
  name: string | null | undefined;
  size?: number;
}

export function UserAvatar({ url, name, size = 44 }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initial = (name || '?')[0].toUpperCase();

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.borderLight }}
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
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '700', color: Colors.white }}>
        {initial}
      </Text>
    </View>
  );
}
