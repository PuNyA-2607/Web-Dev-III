import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [2, 'Product name must be at least 2 characters long'],
      maxlength: [120, 'Product name cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters long'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller reference is required'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required'],
      min: [0, 'Stock cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Stock must be an integer',
      },
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, 'Low stock threshold cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Low stock threshold must be an integer',
      },
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ==========================================
// INDEX SPECIFICATIONS & EXPLANATIONS
// ==========================================

// Index 1: Text Search Index
// Serves full-text search queries ($text: { $search: '...' }) across product names and descriptions.
// Enables keyword matching and relevance scoring without costly collection scans.
productSchema.index(
  { name: 'text', description: 'text' },
  { weights: { name: 10, description: 5 }, name: 'ProductTextIndex' }
);

// Index 2: Compound Index on Category and Price
// Serves queries that filter by category and sort by price (e.g. category=electronics&sort=price),
// or filter by category within a price range (e.g. category=electronics&minPrice=100&maxPrice=500).
// Follows the ESR (Equality, Sort, Range) rule where the equality filter (category) precedes sort/range (price).
productSchema.index({ category: 1, price: 1 });

// Index 3: Single-field Index on Seller
// Serves seller-specific inventory queries, the seller dashboard /mine route, and product ownership lookups.
productSchema.index({ seller: 1 });

export const Product = mongoose.model('Product', productSchema);
