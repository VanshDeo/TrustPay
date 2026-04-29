/**
 * MongoDB connection configuration using Mongoose.
 * Connects to the URI specified in MONGODB_URI env var.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trustpay';

/**
 * Connect to MongoDB. Retries once on failure.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Retry once after 3 seconds
    setTimeout(async () => {
      try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB (retry)');
      } catch (retryError) {
        console.error('❌ MongoDB retry failed:', retryError);
        process.exit(1);
      }
    }, 3000);
  }
}

export default mongoose;
