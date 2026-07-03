import { Wrench, Car, Home, Laptop, UtensilsCrossed, Coffee, Wine, Star, Sparkles } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

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
};

interface CategoryIconProps {
  icon: string;
  size?: number;
  color?: string;
}

export function CategoryIcon({ icon, size = 20, color = Colors.primary }: CategoryIconProps) {
  const IconComponent = iconMap[icon] || Sparkles;
  return <IconComponent size={size} color={color} strokeWidth={2} />;
}
