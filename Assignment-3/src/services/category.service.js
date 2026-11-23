import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slugify.js';

export const categoryService = {
  /**
   * Create a new category
   */
  createCategory: async ({ name, description = '', isActive = true }) => {
    const slug = slugify(name);

    // Check duplicate name or slug
    const existing = await Category.findOne({
      $or: [{ name: new RegExp(`^${name.trim()}$`, 'i') }, { slug }],
    });

    if (existing) {
      throw ApiError.conflict('Category with this name or slug already exists.');
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      description,
      isActive,
    });

    return category;
  },

  /**
   * Get all categories
   */
  getAllCategories: async (includeInactive = false) => {
    const filter = includeInactive ? {} : { isActive: true };
    const categories = await Category.find(filter).sort({ name: 1 });
    return categories;
  },

  /**
   * Get category by ID
   */
  getCategoryById: async (id) => {
    const category = await Category.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found.');
    }
    return category;
  },

  /**
   * Update category
   */
  updateCategory: async (id, updateData) => {
    const category = await Category.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    if (updateData.name && updateData.name.trim() !== category.name) {
      const newSlug = slugify(updateData.name);
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        $or: [{ name: new RegExp(`^${updateData.name.trim()}$`, 'i') }, { slug: newSlug }],
      });

      if (duplicate) {
        throw ApiError.conflict('Category with this name or slug already exists.');
      }

      category.name = updateData.name.trim();
      category.slug = newSlug;
    }

    if (updateData.description !== undefined) {
      category.description = updateData.description.trim();
    }

    if (typeof updateData.isActive === 'boolean') {
      category.isActive = updateData.isActive;
    }

    await category.save();
    return category;
  },

  /**
   * Delete category (Block deletion if category still has products)
   */
  deleteCategory: async (id) => {
    const category = await Category.findById(id);
    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    // Check if any product references this category
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      throw ApiError.conflict(
        `Cannot delete category '${category.name}'. It is referenced by ${productCount} product(s).`
      );
    }

    await Category.findByIdAndDelete(id);
    return { id, message: `Category '${category.name}' deleted successfully.` };
  },
};
