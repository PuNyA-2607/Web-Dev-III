import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/slugify.js';

/**
 * Seed database with:
 * 1. Admin, 2 Sellers, Customers
 * 2. 5 Categories
 * 3. 18 Products across the sellers (including low stock items)
 */
const seedDatabase = async () => {
  try {
    logger.info('Starting comprehensive seed script...');

    // Validate that admin credentials are provided via environment variables
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
      throw new Error(
        'Missing required admin seed credentials: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in .env'
      );
    }

    await connectDB();

    // ----------------------------------------------------
    // 1. Seed Users
    // ----------------------------------------------------
    const usersToSeed = [
      {
        name: env.ADMIN_NAME || 'Admin',
        email: env.ADMIN_EMAIL.toLowerCase(),
        password: env.ADMIN_PASSWORD,
        role: 'admin',
        isActive: true,
      },
      {
        name: 'Apex Retailer (Seller A)',
        email: 'seller@example.com',
        password: 'SellerPass123!',
        role: 'seller',
        isActive: true,
      },
      {
        name: 'Zenith Tech (Seller B)',
        email: 'seller2@example.com',
        password: 'SellerPass123!',
        role: 'seller',
        isActive: true,
      },
      {
        name: 'Jane Customer',
        email: 'customer@example.com',
        password: 'CustomerPass123!',
        role: 'customer',
        isActive: true,
      },
      {
        name: 'Deactivated Customer',
        email: 'inactive@example.com',
        password: 'CustomerPass123!',
        role: 'customer',
        isActive: false,
      },
    ];

    const userMap = {};
    for (const userData of usersToSeed) {
      let user = await User.findOne({ email: userData.email });
      if (!user) {
        const passwordHash = await bcrypt.hash(userData.password, 12);
        user = await User.create({
          name: userData.name,
          email: userData.email,
          passwordHash,
          role: userData.role,
          isActive: userData.isActive,
        });
        logger.info(`Created ${userData.role} user: ${userData.email}`);
      } else {
        logger.info(`User '${userData.email}' already exists.`);
      }
      userMap[userData.email] = user;
    }

    const sellerA = userMap['seller@example.com'];
    const sellerB = userMap['seller2@example.com'];

    // ----------------------------------------------------
    // 2. Seed Categories
    // ----------------------------------------------------
    const categoriesToSeed = [
      {
        name: 'Electronics',
        description: 'Smartphones, laptops, accessories, and smart devices.',
      },
      {
        name: 'Clothing & Apparel',
        description: 'Fashionable outfits, footwear, and designer clothing.',
      },
      {
        name: 'Home & Kitchen',
        description: 'Furniture, cookware, smart home appliances, and decor.',
      },
      {
        name: 'Books & Media',
        description: 'Bestselling novels, educational books, and digital media.',
      },
      {
        name: 'Sports & Fitness',
        description: 'Workout gear, outdoor equipment, and fitness accessories.',
      },
    ];

    const categoryMap = {};
    for (const catData of categoriesToSeed) {
      const slug = slugify(catData.name);
      let cat = await Category.findOne({ slug });
      if (!cat) {
        cat = await Category.create({
          name: catData.name,
          slug,
          description: catData.description,
          isActive: true,
        });
        logger.info(`Created category: ${cat.name}`);
      } else {
        logger.info(`Category '${cat.name}' already exists.`);
      }
      categoryMap[cat.name] = cat;
    }

    // ----------------------------------------------------
    // 3. Seed Products (18 items, with 2 low/out-of-stock items)
    // ----------------------------------------------------
    const productsToSeed = [
      // Electronics (Seller A)
      {
        name: 'Pro Wireless Noise Cancelling Headphones',
        description: 'High-fidelity audio with 40-hour battery life and active noise cancellation.',
        price: 199.99,
        category: categoryMap['Electronics']._id,
        seller: sellerA._id,
        stock: 50,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e'],
        isActive: true,
      },
      {
        name: 'Ultra-Slim Mechanical Gaming Keyboard',
        description: 'Tactile blue switches, per-key RGB backlighting, and aerospace aluminum frame.',
        price: 89.99,
        category: categoryMap['Electronics']._id,
        seller: sellerA._id,
        stock: 25,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1548347663-9d68552ae13b'],
        isActive: true,
      },
      {
        name: '4K Ultra-HD Action Camera',
        description: 'Waterproof up to 30m, 60fps video recording, dual touchscreens.',
        price: 149.5,
        category: categoryMap['Electronics']._id,
        seller: sellerB._id,
        stock: 30,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1540492465403-1733f12f600a'],
        isActive: true,
      },
      // Low stock product 1: stock <= lowStockThreshold
      {
        name: 'Flagship OLED 120Hz Smartphone',
        description: 'Latest generation processor, ceramic shield, and triple camera array.',
        price: 899.0,
        category: categoryMap['Electronics']._id,
        seller: sellerB._id,
        stock: 3, // LOW STOCK (Threshold is 5)
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9'],
        isActive: true,
      },
      // Out of stock product 2: stock = 0 <= lowStockThreshold
      {
        name: 'Ergonomic Vertical Wireless Mouse',
        description: 'Natural hand posture design, silent clicks, rechargeable USB-C battery.',
        price: 39.99,
        category: categoryMap['Electronics']._id,
        seller: sellerA._id,
        stock: 0, // OUT OF STOCK
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1586349906319-48d20e9d17e5'],
        isActive: true,
      },

      // Clothing & Apparel
      {
        name: 'Classic Vintage Denim Jacket',
        description: '100% organic cotton, heavy-duty stitching, timeless casual trucker cut.',
        price: 69.99,
        category: categoryMap['Clothing & Apparel']._id,
        seller: sellerA._id,
        stock: 40,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1485811661309-ab85183a729c'],
        isActive: true,
      },
      {
        name: 'Breathable Merino Wool Athletic Hoodie',
        description: 'Moisture-wicking, thermal regulating, anti-odor performance zip hoodie.',
        price: 85.0,
        category: categoryMap['Clothing & Apparel']._id,
        seller: sellerB._id,
        stock: 18,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77'],
        isActive: true,
      },
      {
        name: 'Minimalist Leather Oxford Shoes',
        description: 'Handcrafted full-grain leather shoes suitable for business or formal events.',
        price: 130.0,
        category: categoryMap['Clothing & Apparel']._id,
        seller: sellerA._id,
        stock: 15,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1616663308968-58162d332720'],
        isActive: true,
      },

      // Home & Kitchen
      {
        name: 'Precision Electric Coffee Burr Grinder',
        description: 'Stainless steel conical burrs with 30 precise grind settings for espresso to drip.',
        price: 119.0,
        category: categoryMap['Home & Kitchen']._id,
        seller: sellerB._id,
        stock: 22,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1531582750043-221f07a6a0fc'],
        isActive: true,
      },
      {
        name: 'Pre-Seasoned Cast Iron Skillet 12-inch',
        description: 'Heavy duty cast iron skillet with silicone handle cover, oven safe.',
        price: 34.95,
        category: categoryMap['Home & Kitchen']._id,
        seller: sellerA._id,
        stock: 35,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1603038124597-2c5c207edf47'],
        isActive: true,
      },
      {
        name: 'Smart Air Purifier with HEPA Filter',
        description: 'Filters 99.97% of airborne particles, whisper-quiet sleep mode, WiFi connected.',
        price: 159.99,
        category: categoryMap['Home & Kitchen']._id,
        seller: sellerB._id,
        stock: 12,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1572274679890-ddb14d22553e'],
        isActive: true,
      },

      // Books & Media
      {
        name: 'Designing Data-Intensive Applications',
        description: 'The definitive guide to the architecture, storage, and processing of distributed data systems.',
        price: 44.99,
        category: categoryMap['Books & Media']._id,
        seller: sellerA._id,
        stock: 45,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c'],
        isActive: true,
      },
      {
        name: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        description: 'Essential best practices for writing clean, maintainable, and readable code.',
        price: 38.5,
        category: categoryMap['Books & Media']._id,
        seller: sellerA._id,
        stock: 30,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1565229284535-2cbbe3049123'],
        isActive: true,
      },
      {
        name: 'The Pragmatic Programmer: 20th Anniversary Edition',
        description: 'Timeless principles for modern software development and career growth.',
        price: 42.0,
        category: categoryMap['Books & Media']._id,
        seller: sellerB._id,
        stock: 20,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794'],
        isActive: true,
      },

      // Sports & Fitness
      {
        name: 'Adjustable Quick-Select Dumbbell Set',
        description: 'Quick-adjust weights from 5 to 52.5 lbs per dumbbell, space-saving design.',
        price: 299.99,
        category: categoryMap['Sports & Fitness']._id,
        seller: sellerB._id,
        stock: 8,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2'],
        isActive: true,
      },
      {
        name: 'Non-Slip Eco-Friendly Natural Rubber Yoga Mat',
        description: 'Extra thick 6mm cushioning with alignment marks and carrying strap.',
        price: 49.99,
        category: categoryMap['Sports & Fitness']._id,
        seller: sellerA._id,
        stock: 60,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1592432678016-e910b452f9a2'],
        isActive: true,
      },
      {
        name: 'Insulated Stainless Steel Water Bottle 32oz',
        description: 'Double-wall vacuum insulation keeps liquids cold 24 hours or hot 12 hours.',
        price: 24.99,
        category: categoryMap['Sports & Fitness']._id,
        seller: sellerA._id,
        stock: 75,
        lowStockThreshold: 5,
        images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8'],
        isActive: true,
      },
    ];

    for (const prodData of productsToSeed) {
      const existing = await Product.findOne({ name: prodData.name });
      if (!existing) {
        await Product.create(prodData);
        logger.info(`Created product: ${prodData.name} (Stock: ${prodData.stock})`);
      } else {
        logger.info(`Product '${prodData.name}' already exists.`);
      }
    }

    logger.info('Database seeding completed successfully!');
  } catch (error) {
    logger.error(`Seed failed: ${error.message}`, error.stack);
    process.exit(1);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

seedDatabase();
