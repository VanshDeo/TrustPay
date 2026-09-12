import mongoose, { Schema, Document } from 'mongoose';

export interface IPageView extends Document {
  path: string;
  referrer?: string;
  userAgent?: string;
  createdAt: Date;
}

const PageViewSchema = new Schema<IPageView>({
  path: { type: String, required: true, index: true },
  referrer: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const PageView = mongoose.model<IPageView>('PageView', PageViewSchema);
