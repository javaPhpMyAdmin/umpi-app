import { View, Text } from 'react-native';

export function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.7,
          fontWeight: '800',
          color: '#4285F4',
          lineHeight: size * 0.75,
        }}
      >
        G
      </Text>
    </View>
  );
}
