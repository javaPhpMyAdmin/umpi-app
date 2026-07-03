import { Listing, Category } from '@/types';

export const mockCategories: Category[] = [
  { id: '1', name: 'Todos', slug: 'todos', icon: 'Sparkles', image_url: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg', total_count: 0, is_active: true, created_at: '2024-01-01' },
  { id: '2', name: 'Servicios', slug: 'servicios', icon: 'Wrench', image_url: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg', total_count: 14230, is_active: true, created_at: '2024-01-01' },
  { id: '3', name: 'Autos', slug: 'autos', icon: 'Car', image_url: 'https://images.pexels.com/photos/1149137/pexels-photo-1149137.jpeg', total_count: 8940, is_active: true, created_at: '2024-01-01' },
  { id: '4', name: 'Propiedades', slug: 'propiedades', icon: 'Home', image_url: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg', total_count: 6100, is_active: true, created_at: '2024-01-01' },
  { id: '5', name: 'Tecnologia', slug: 'tecnologia', icon: 'Laptop', image_url: 'https://images.pexels.com/photos/40185/mac-freelancer-macintosh-macbook-40185.jpeg', total_count: 5200, is_active: true, created_at: '2024-01-01' },
  { id: '6', name: 'Restoranes', slug: 'restoranes', icon: 'UtensilsCrossed', image_url: 'https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg', total_count: 3100, is_active: true, created_at: '2024-01-01' },
  { id: '7', name: 'Cafeterias', slug: 'cafeterias', icon: 'Coffee', image_url: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg', total_count: 2800, is_active: true, created_at: '2024-01-01' },
  { id: '8', name: 'Bares', slug: 'bares', icon: 'Wine', image_url: 'https://images.pexels.com/photos/1242321/pexels-photo-1242321.jpeg', total_count: 2200, is_active: true, created_at: '2024-01-01' },
  { id: '9', name: 'Destacados', slug: 'destacados', icon: 'Star', image_url: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg', total_count: 0, is_active: true, created_at: '2024-01-01' },
];

export const mockListings: Listing[] = [
  {
    id: 'l1', user_id: 'u1', category_id: '3', title: 'Ford Focus 2020 SE 1.6L', description: 'Excelente estado, 45.000 km. Unico dueno. Service al dia.', price: 18500000, price_type: 'fixed', location: 'Córdoba', images: ['https://images.pexels.com/photos/1149137/pexels-photo-1149137.jpeg'], is_featured: true, listing_priority: 2, status: 'active', rating: 4.8, created_at: '2024-12-20',
    category: mockCategories[2], user: { id: 'u1', full_name: 'Carlos Martinez', avatar_url: null, phone: null, rating: 4.8, total_sales: 3, total_listings: 1, subscription_type: 'oro', subscription_expires_at: null, location: 'Córdoba', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l2', user_id: 'u2', category_id: '4', title: 'Departamento 2 ambientes en Palermo', description: 'Luminoso, 55m2, balcon. Excelente ubicacion.', price: 320000, price_type: 'fixed', location: 'Buenos Aires', images: ['https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg'], is_featured: true, listing_priority: 3, status: 'active', rating: 5.0, created_at: '2024-12-18',
    category: mockCategories[3], user: { id: 'u2', full_name: 'Maria Gonzalez', avatar_url: null, phone: null, rating: 5.0, total_sales: 12, total_listings: 2, subscription_type: 'premium', subscription_expires_at: null, location: 'Buenos Aires', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l3', user_id: 'u3', category_id: '5', title: 'MacBook Pro 14 M3 Pro', description: 'Nuevo en caja. 512GB SSD, 18GB RAM. Garantia Apple.', price: 4200000, price_type: 'fixed', location: 'Rosario', images: ['https://images.pexels.com/photos/40185/mac-freelancer-macintosh-macbook-40185.jpeg'], is_featured: false, listing_priority: 0, status: 'active', rating: 4.9, created_at: '2024-12-15',
    category: mockCategories[4], user: { id: 'u3', full_name: 'Lucas Perez', avatar_url: null, phone: null, rating: 4.9, total_sales: 8, total_listings: 5, subscription_type: 'none', subscription_expires_at: null, location: 'Rosario', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l4', user_id: 'u4', category_id: '2', title: 'Plomero matriculado 24h', description: 'Servicio de plomeria general. Urgencias, instalaciones, reparaciones.', price: null, price_type: 'contact', location: 'Mendoza', images: ['https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg'], is_featured: true, listing_priority: 1, status: 'active', rating: 4.5, created_at: '2024-12-10',
    category: mockCategories[1], user: { id: 'u4', full_name: 'Roberto Diaz', avatar_url: null, phone: null, rating: 4.5, total_sales: 25, total_listings: 1, subscription_type: 'plata', subscription_expires_at: null, location: 'Mendoza', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l5', user_id: 'u5', category_id: '6', title: 'Parrilla Don Pepe - 20% off', description: 'Parrilla tradicional argentina. Carnes de primera calidad. Reserva con descuento.', price: null, price_type: 'contact', location: 'Buenos Aires', images: ['https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg'], is_featured: true, listing_priority: 2, status: 'active', rating: 4.7, created_at: '2024-12-08',
    category: mockCategories[5], user: { id: 'u5', full_name: 'Don Pepe Restaurantes', avatar_url: null, phone: null, rating: 4.7, total_sales: 100, total_listings: 3, subscription_type: 'oro', subscription_expires_at: null, location: 'Buenos Aires', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l6', user_id: 'u6', category_id: '7', title: 'Café especialidad - Barista', description: 'Cafes de especialidad de origen unico. Metodos: V60, Chemex, Aeropress.', price: null, price_type: 'contact', location: 'Córdoba', images: ['https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg'], is_featured: false, listing_priority: 0, status: 'active', rating: 4.6, created_at: '2024-12-05',
    category: mockCategories[6], user: { id: 'u6', full_name: 'Sofia Luna', avatar_url: null, phone: null, rating: 4.6, total_sales: 15, total_listings: 1, subscription_type: 'none', subscription_expires_at: null, location: 'Córdoba', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l7', user_id: 'u7', category_id: '8', title: 'Bar Jazz - Musica en vivo', description: 'Cocteles artesanales, musica jazz en vivo. Viernes y sabados.', price: null, price_type: 'contact', location: 'Buenos Aires', images: ['https://images.pexels.com/photos/1242321/pexels-photo-1242321.jpeg'], is_featured: true, listing_priority: 1, status: 'active', rating: 4.4, created_at: '2024-12-01',
    category: mockCategories[7], user: { id: 'u7', full_name: 'Bar Jazz BA', avatar_url: null, phone: null, rating: 4.4, total_sales: 30, total_listings: 1, subscription_type: 'plata', subscription_expires_at: null, location: 'Buenos Aires', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l8', user_id: 'u8', category_id: '3', title: 'Toyota Hilux 4x4 2023', description: 'Doble cabina, 25.000 km. Impecable. Accesorios originales.', price: 28500000, price_type: 'fixed', location: 'Salta', images: ['https://images.pexels.com/photos/1149137/pexels-photo-1149137.jpeg'], is_featured: true, listing_priority: 3, status: 'active', rating: 5.0, created_at: '2024-11-28',
    category: mockCategories[2], user: { id: 'u8', full_name: 'Juan Rodriguez', avatar_url: null, phone: null, rating: 5.0, total_sales: 2, total_listings: 1, subscription_type: 'premium', subscription_expires_at: null, location: 'Salta', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l9', user_id: 'u9', category_id: '5', title: 'iPhone 15 Pro Max 256GB', description: 'Nuevo sin usar. Titanium. Garantia oficial.', price: 1850000, price_type: 'fixed', location: 'Buenos Aires', images: ['https://images.pexels.com/photos/40185/mac-freelancer-macintosh-macbook-40185.jpeg'], is_featured: false, listing_priority: 0, status: 'active', rating: 4.8, created_at: '2024-11-25',
    category: mockCategories[4], user: { id: 'u9', full_name: 'Tech Store', avatar_url: null, phone: null, rating: 4.8, total_sales: 50, total_listings: 20, subscription_type: 'oro', subscription_expires_at: null, location: 'Buenos Aires', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l10', user_id: 'u10', category_id: '4', title: 'Casa quinta con pileta', description: '2000m2, 4 dormitorios, pileta, parque. Excelente inversion.', price: 450000, price_type: 'fixed', location: 'Pilar', images: ['https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg'], is_featured: true, listing_priority: 2, status: 'active', rating: 4.9, created_at: '2024-11-20',
    category: mockCategories[3], user: { id: 'u10', full_name: 'Inmobiliaria Pilar', avatar_url: null, phone: null, rating: 4.9, total_sales: 40, total_listings: 15, subscription_type: 'premium', subscription_expires_at: null, location: 'Pilar', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l11', user_id: 'u11', category_id: '2', title: 'Electricista matriculado', description: 'Instalaciones, cableado, tableros, certificaciones. Todo tipo de obra.', price: null, price_type: 'contact', location: 'Rosario', images: ['https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg'], is_featured: false, listing_priority: 0, status: 'active', rating: 4.3, created_at: '2024-11-15',
    category: mockCategories[1], user: { id: 'u11', full_name: 'Electricista Pro', avatar_url: null, phone: null, rating: 4.3, total_sales: 18, total_listings: 1, subscription_type: 'none', subscription_expires_at: null, location: 'Rosario', is_admin: false, created_at: '2024-01-01' }
  },
  {
    id: 'l12', user_id: 'u12', category_id: '6', title: 'Sushi Bar - 2x1 martes', description: 'Sushi fresco y creativo. Promociones todos los dias.', price: null, price_type: 'contact', location: 'Córdoba', images: ['https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg'], is_featured: false, listing_priority: 0, status: 'active', rating: 4.6, created_at: '2024-11-10',
    category: mockCategories[5], user: { id: 'u12', full_name: 'Sushi Bar', avatar_url: null, phone: null, rating: 4.6, total_sales: 22, total_listings: 2, subscription_type: 'none', subscription_expires_at: null, location: 'Córdoba', is_admin: false, created_at: '2024-01-01' }
  },
];
