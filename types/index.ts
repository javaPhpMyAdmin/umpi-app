export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image_url: string | null;
  total_count: number;
  is_active: boolean;
  created_at: string;
}

export interface Listing {
  id: string;
  user_id: string;
  category_id: string | null;
  category?: Category;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string;
  location: string | null;
  images: string[];
  is_featured: boolean;
  listing_priority: number;
  status: string;
  rating: number;
  created_at: string;
  user?: Profile;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  rating: number;
  total_sales: number;
  total_listings: number;
  subscription_type: string;
  subscription_expires_at: string | null;
  location: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
  listing?: Listing;
  other_user?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  features: string[];
  listing_priority: number;
  created_at: string;
}
