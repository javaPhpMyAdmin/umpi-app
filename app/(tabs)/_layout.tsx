import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View, Platform, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function AnimatedTabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.05 : 0.85,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {children}
    </Animated.View>
  );
}

function AnimatedTabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [focused, anim]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.05],
  });

  return (
    <Animated.Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color,
        marginTop: 2,
        transform: [{ scale }],
      }}
    >
      {children}
    </Animated.Text>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 4);

  return (
    <View style={[styles.tabBar, { paddingBottom: bottomInset, height: 56 + bottomInset }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        const iconColor = focused ? Colors.primary : Colors.textSecondary;
        const labelColor = focused ? Colors.primaryDark : Colors.textSecondary;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
          >
            <View style={[styles.tabBg, focused && styles.tabBgFocused]}>
              {options.tabBarIcon?.({ focused, color: iconColor, size: 24 })}
              {options.tabBarLabel !== undefined
                ? typeof options.tabBarLabel === 'function'
                  ? options.tabBarLabel({ focused, color: labelColor, position: 'below-icon', children: options.title ?? '' })
                  : null
                : null
              }
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ size, color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Home size={size} color={color} strokeWidth={focused ? 2.5 : 2} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <AnimatedTabLabel focused={focused} color={color}>{children}</AnimatedTabLabel>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ size, color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <Search size={size} color={color} strokeWidth={focused ? 2.5 : 2} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <AnimatedTabLabel focused={focused} color={color}>{children}</AnimatedTabLabel>
          ),
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: 'Publicar',
          tabBarIcon: ({ size, color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <PlusCircle size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <AnimatedTabLabel focused={focused} color={color}>{children}</AnimatedTabLabel>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ size, color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <MessageCircle size={size} color={color} strokeWidth={focused ? 2.5 : 2} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <AnimatedTabLabel focused={focused} color={color}>{children}</AnimatedTabLabel>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ size, color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <User size={size} color={color} strokeWidth={focused ? 2.5 : 2} />
            </AnimatedTabIcon>
          ),
          tabBarLabel: ({ focused, color, children }) => (
            <AnimatedTabLabel focused={focused} color={color}>{children}</AnimatedTabLabel>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tabBg: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tabBgFocused: {
    backgroundColor: 'rgba(255, 107, 53, 0.35)',
  },
});
