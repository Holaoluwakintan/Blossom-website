export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  author: string;
  cover_image_url: string;
  synopsis: string;
  description: string;
  genre: string;
  publication_year: number;
  price_ngn?: number;
  format: string;
  featured: boolean;
  availability_status: 'Available' | 'Pre-Order' | 'Out of Stock';
  created_at: string;
}

export interface JournalPost {
  id: string;
  title: string;
  slug: string;
  featured_image_url: string;
  excerpt: string;
  content_markdown: string;
  author: string;
  category_id?: string;
  category?: { name: string; slug: string };
  published: boolean;
  published_at?: string;
  reading_time_minutes: number;
  view_count: number;
  comments_enabled: boolean;
}

export interface Artwork {
  id: string;
  title: string;
  slug: string;
  image_url: string;
  caption?: string;
  story: string;
  moral_quote: string;
  category: string;
  alt_text: string;
  featured: boolean;
}

export interface Comment {
  id: string;
  article_id: string;
  author_name: string;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}