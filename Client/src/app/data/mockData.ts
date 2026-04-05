export const categories = [
  { id: 1, name: "Electronics", count: 245 },
  { id: 2, name: "Fashion", count: 532 },
  { id: 3, name: "Home & Kitchen", count: 389 },
  { id: 4, name: "Sports", count: 167 },
  { id: 5, name: "Books", count: 421 },
  { id: 6, name: "Beauty", count: 298 },
  { id: 7, name: "Toys", count: 156 },
  { id: 8, name: "Automotive", count: 234 },
];

export const products = [
  {
    id: 1,
    name: "Wireless Bluetooth Headphones",
    price: 79.99,
    originalPrice: 129.99,
    rating: 4.5,
    reviews: 234,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
    inStock: true,
    description: "Premium wireless headphones with noise cancellation and 30-hour battery life. Experience crystal-clear audio quality with deep bass and comfortable over-ear design."
  },
  {
    id: 2,
    name: "Men's Classic Cotton T-Shirt",
    price: 24.99,
    originalPrice: 39.99,
    rating: 4.8,
    reviews: 567,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    inStock: true,
    description: "100% cotton comfortable t-shirt in multiple colors. Perfect for casual wear with a modern fit."
  },
  {
    id: 3,
    name: "Smart Watch Series 5",
    price: 299.99,
    originalPrice: 399.99,
    rating: 4.7,
    reviews: 892,
    category: "Electronics",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
    inStock: true,
    description: "Advanced smartwatch with health tracking, GPS, and water resistance. Monitor your fitness goals and stay connected."
  },
  {
    id: 4,
    name: "Yoga Mat Pro",
    price: 49.99,
    originalPrice: 69.99,
    rating: 4.6,
    reviews: 423,
    category: "Sports",
    image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=400&fit=crop",
    inStock: true,
    description: "Premium non-slip yoga mat with extra cushioning. Perfect for yoga, pilates, and home workouts."
  },
  {
    id: 5,
    name: "Women's Running Shoes",
    price: 89.99,
    originalPrice: 129.99,
    rating: 4.9,
    reviews: 1234,
    category: "Sports",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
    inStock: true,
    description: "Lightweight running shoes with responsive cushioning and breathable mesh upper. Designed for comfort and performance."
  },
  {
    id: 6,
    name: "Coffee Maker Deluxe",
    price: 129.99,
    originalPrice: 179.99,
    rating: 4.4,
    reviews: 345,
    category: "Home & Kitchen",
    image: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=400&h=400&fit=crop",
    inStock: false,
    description: "Programmable coffee maker with thermal carafe. Brew perfect coffee every morning with customizable settings."
  },
  {
    id: 7,
    name: "Laptop Backpack",
    price: 59.99,
    originalPrice: 89.99,
    rating: 4.7,
    reviews: 678,
    category: "Fashion",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop",
    inStock: true,
    description: "Durable laptop backpack with multiple compartments and USB charging port. Perfect for work and travel."
  },
  {
    id: 8,
    name: "Organic Skincare Set",
    price: 69.99,
    originalPrice: 99.99,
    rating: 4.8,
    reviews: 456,
    category: "Beauty",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop",
    inStock: true,
    description: "Complete organic skincare routine with cleanser, toner, and moisturizer. Natural ingredients for healthy, glowing skin."
  },
];

export const featuredProducts = products.slice(0, 4);
export const trendingProducts = products.slice(2, 6);

export const reviews = [
  {
    id: 1,
    author: "Sarah Johnson",
    rating: 5,
    date: "2026-03-15",
    comment: "Absolutely love this product! The quality is outstanding and it arrived earlier than expected.",
    helpful: 24
  },
  {
    id: 2,
    author: "Mike Chen",
    rating: 4,
    date: "2026-03-10",
    comment: "Great value for money. Works exactly as described. Would recommend to friends.",
    helpful: 18
  },
  {
    id: 3,
    author: "Emma Wilson",
    rating: 5,
    date: "2026-03-05",
    comment: "This exceeded my expectations! The build quality is fantastic and customer service was helpful.",
    helpful: 31
  },
];

export const cartItems = [
  {
    ...products[0],
    quantity: 2
  },
  {
    ...products[4],
    quantity: 1
  }
];

export const adminStats = {
  totalProducts: 245,
  totalCategories: 8,
  totalOrders: 1543,
  totalUsers: 8932,
  revenue: 125430,
  growthRate: 12.5
};

export const salesData = [
  { month: "Jan", sales: 4200 },
  { month: "Feb", sales: 5100 },
  { month: "Mar", sales: 6800 },
  { month: "Apr", sales: 5900 },
  { month: "May", sales: 7200 },
  { month: "Jun", sales: 8500 },
];

export const recentOrders = [
  { id: "#ORD-001", customer: "John Doe", date: "2026-04-03", total: 299.99, status: "Delivered" },
  { id: "#ORD-002", customer: "Jane Smith", date: "2026-04-03", total: 149.99, status: "Shipped" },
  { id: "#ORD-003", customer: "Bob Johnson", date: "2026-04-02", total: 89.99, status: "Processing" },
  { id: "#ORD-004", customer: "Alice Brown", date: "2026-04-02", total: 199.99, status: "Pending" },
  { id: "#ORD-005", customer: "Charlie Wilson", date: "2026-04-01", total: 449.99, status: "Delivered" },
];
