import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

const TOTAL_DOTS = 3;

interface SplashOverlayProps {
  onFinish: () => void;
}

export function SplashOverlay({ onFinish }: SplashOverlayProps) {
  const { isLoading } = useAuth();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dots, setDots] = useState(0);

  const translateY = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const barProgress = useRef(new Animated.Value(0)).current;

  // Mínimo 3 segundos de splash
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Animación: rebote vertical suave (más fluido que scale)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -40,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Puntos que aparecen uno a uno en loop
    const interval = setInterval(() => {
      setDots(prev => (prev + 1) % (TOTAL_DOTS + 1));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Barra de progreso animada (indeterminada: llena y vacía en loop)
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(barProgress, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(barProgress, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Salir cuando auth cargó + mínimo tiempo cumplido
  const ready = !isLoading && minTimePassed && !exiting;

  useEffect(() => {
    if (!ready) return;

    setExiting(true);
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      onFinish();
    });
  }, [ready]);

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.container, { opacity: containerOpacity }]}
    >
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <View style={styles.loadingRow}>
        <Text style={styles.loadingText}>Cargando</Text>
        {Array.from({ length: TOTAL_DOTS }).map((_, i) => (
          <Text
            key={i}
            style={[
              styles.dot,
              { opacity: i < dots ? 1 : 0.2 },
            ]}
          >
            .
          </Text>
        ))}
      </View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: barProgress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  logo: {
    width: 220,
    height: 220,
    borderRadius: 44,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 48,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
  },
  dot: {
    fontSize: 32,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 26,
  },
  progressTrack: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 28,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 3,
  },
});
