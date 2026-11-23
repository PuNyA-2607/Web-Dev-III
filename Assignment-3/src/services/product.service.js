import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { sanitizeMongoInput, sanitizeSearchTerm } from '../utils/sanitize.js';

export const productService = {
  /**
   * Create a new product.
   * Sellers automatically own the product; Admins can assign to a seller.
   */
  createProduct: async (productData, currentUser) => {
    // 1. Ownership & seller assignment
    let sellerId;
    if (currentUser.role === 'seller') {
      // Sellers can never set the seller field; it is strictly forced from req.user
      sellerId = currentUser._id;
    } else if (currentUser.role === 'admin') {
      if (productData.seller) {
        // Admin specified a seller; verify the user exists and holds seller role
        const sellerUser = await User.findById(productData.seller);
        if (!sellerUser || sellerUser.role !== 'seller') {
          throw ApiError.badRequest('Referenced seller does not exist or does not have the seller role.');
        }
        sellerId = sellerUser._id;
      } else {
        sellerId = currentUser._id;
      }
    } else {
      throw ApiError.forbidden('Only sellers and admins are authorized to create products.');
    }

    // 2. Validate category existence and active status
    const category = await Category.findById(productData.category);
    if (!category || !category.isActive) {
      throw ApiError.badRequest('Referenced category does not exist or has been deactivated.');
    }

    // 3. Create product
    const product = await Product.create({
      ...productData,
      seller: sellerId,
    });

    return await product.populate([
      { path: 'category', select: 'name slug' },
      { path: 'seller', select: 'name email' },
    ]);
  },

  /**
   * Get public products with search, filtering, whitelisted sorting, and pagination.
   * Strictly filters for isActive: true.
   */
  getAllProducts: async (rawQueryParams = {}) => {
    // Sanitize any potential NoSQL operator injection in query parameters
    const queryParams = sanitizeMongoInput(rawQueryParams);

    const filter = { isActive: true };

    // 1. Text Search across name and description
    if (queryParams.search) {
      const sanitized = sanitizeSearchTerm(queryParams.search);
      if (sanitized) {
        // Use text index search
        filter.$text = { $search: sanitized };
      }
    }

    // 2. Filter by Category
    if (queryParams.category) {
      filter.category = queryParams.category;
    }

    // 3. Filter by Seller
    if (queryParams.seller) {
      filter.seller = queryParams.seller;
    }

    // 4. Filter by In Stock status
    if (queryParams.inStock === true || queryParams.inStock === 'true') {
      filter.stock = { $gt: 0 };
    } else if (queryParams.inStock === false || queryParams.inStock === 'false') {
      filter.stock = 0;
    }

    // 5. Price Range Filtering
    if (queryParams.minPrice !== undefined || queryParams.maxPrice !== undefined) {
      filter.price = {};
      if (queryParams.minPrice !== undefined) {
        filter.price.$gte = Number(queryParams.minPrice);
      }
      if (queryParams.maxPrice !== undefined) {
        filter.price.$lte = Number(queryParams.maxPrice);
      }
    }

    // 6. Whitelisted Sorting
    const allowedSortFields = {
      price: { price: 1 },
      '-price': { price: -1 },
      createdAt: { createdAt: 1 },
      '-createdAt': { createdAt: -1 },
      name: { name: 1 },
      '-name': { name: -1 },
    };

    let sortOption = { createdAt: -1 }; // Default sort
    if (queryParams.sort && allowedSortFields[queryParams.sort]) {
      sortOption = allowedSortFields[queryParams.sort];
    } else if (filter.$text && !queryParams.sort) {
      // If full-text search with no sort, rank by text relevance score
      sortOption = { score: { $meta: 'textScore' } };
    }

    // 7. Pagination (Cap limit at 50)
    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const findQuery = Product.find(filter)
      .populate('category', 'name slug')
      .populate('seller', 'name email')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    if (filter.$text && sortOption.score) {
      findQuery.select({ score: { $meta: 'textScore' } });
    }

    const [products, total] = await Promise.all([
      findQuery.exec(),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get single product by ID (Public only accesses isActive products).
   */
  getProductById: async (id) => {
    const product = await Product.findById(id)
      .populate('category', 'name slug')
      .populate('seller', 'name email');

    if (!product || !product.isActive) {
      throw ApiError.notFound('Product not found.');
    }

    return product;
  },

  /**
   * Retrieve seller's own products (including soft-deleted/inactive items).
   */
  getSellerProducts: async (sellerId, rawQueryParams = {}) => {
    const queryParams = sanitizeMongoInput(rawQueryParams);

    const filter = { seller: sellerId };

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(queryParams.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Update product (Owner seller or Admin only).
   */
  updateProduct: async (id, updateData, currentUser) => {
    const product = await Product.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found.');
    }

    // Ownership check: seller must own the product; admin has override
    if (currentUser.role !== 'admin' && product.seller.toString() !== currentUser._id.toString()) {
      throw ApiError.forbidden('Forbidden: You do not have permission to edit this product.');
    }

    // If category is being updated, verify it exists and is active
    if (updateData.category) {
      const category = await Category.findById(updateData.category);
      if (!category || !category.isActive) {
        throw ApiError.badRequest('Referenced category does not exist or has been deactivated.');
      }
    }

    // Prevent reassigning the seller field by non-admins
    if (updateData.seller && currentUser.role !== 'admin') {
      delete updateData.seller;
    }

    // Apply allowed update fields
    Object.assign(product, updateData);
    await product.save();

    return await product.populate([
      { path: 'category', select: 'name slug' },
      { path: 'seller', select: 'name email' },
    ]);
  },

  /**
   * Soft delete product (isActive = false).
   * Owner seller or Admin only.
   */
  deleteProduct: async (id, currentUser) => {
    const product = await Product.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found.');
    }

    // Ownership check
    if (currentUser.role !== 'admin' && product.seller.toString() !== currentUser._id.toString()) {
      throw ApiError.forbidden('Forbidden: You do not have permission to delete this product.');
    }

    // Soft delete: keep document in database for historical order references
    product.isActive = false;
    await product.save();

    return { id, message: 'Product has been deactivated (soft-deleted) successfully.' };
  },
};
