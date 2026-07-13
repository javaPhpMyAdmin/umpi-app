import { useEffect } from 'react';
import { Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

interface Props {
  uri: string;
  size: number;
  isActive: boolean;
}

export default function ZoomableImage({ uri, size, isActive }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset al dejar de ser la imagen activa (swipe a otra foto)
  useEffect(() => {
    if (!isActive) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
  }, [isActive]);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const newScale = Math.max(1, Math.min(savedScale.value * e.scale, 5));
      scale.value = newScale;
      // Al volver a escala original, resetear posición (sin bordes blancos)
      if (newScale === 1) {
        translateX.value = 0;
        translateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_event, stateManager) => {
      if (scale.value > 1) {
        stateManager.activate();
      } else {
        stateManager.fail();
      }
    })
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const maxPan = (size * scale.value - size) / 2;
      translateX.value = Math.max(
        -maxPan,
        Math.min(maxPan, savedTranslateX.value + e.translationX),
      );
      translateY.value = Math.max(
        -maxPan,
        Math.min(maxPan, savedTranslateY.value + e.translationY),
      );
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width: size, height: size, overflow: 'hidden' }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </Animated.View>
    </GestureDetector>
  );
}
