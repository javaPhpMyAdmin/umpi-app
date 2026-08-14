import { Wrench, Car, Home, Laptop, UtensilsCrossed, Coffee, Wine, Star, Sparkles, Smartphone, Store } from 'lucide-react-native';
import { useThemeColors } from '@/contexts/ThemeContext';

const iconMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  Wrench,
  Car,
  Home,
  Laptop,
  UtensilsCrossed,
  Coffee,
  Wine,
  Star,
  Smartphone,
  Store,
};

interface CategoryIconProps {
  icon: string;
  size?: number;
  color?: string;
}

export function CategoryIcon({ icon, size = 20, color }: CategoryIconProps) {
  const c = useThemeColors();
  const IconComponent = iconMap[icon] || Sparkles;
  return <IconComponent size={size} color={color || c.primary} strokeWidth={2} />;
}
