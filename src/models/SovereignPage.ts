import mongoose, { Document, Schema } from 'mongoose';

// Gallery item
export interface IGalleryItem {
  url: string;
  caption?: string;
}

// Custom link
export interface ICustomLink {
  label: string;
  url: string;
}

// Social / project links
export interface IPageLinks {
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  github?: string;
  docs?: string;
  custom?: ICustomLink[];
}

// Roadmap milestone
export interface IRoadmapItem {
  title: string;
  description?: string;
  status: 'planned' | 'in-progress' | 'complete';
}

// Full page document
export interface ISovereignPage extends Document {
  sovereignId: number;
  creatorWallet: string;
  summary?: string;
  coverImage?: string;
  gallery: IGalleryItem[];
  videoEmbed?: string;
  links: IPageLinks;
  roadmap: IRoadmapItem[];
  updatedAt: Date;
  createdAt: Date;
}

const GalleryItemSchema = new Schema<IGalleryItem>(
  {
    url: { type: String, required: true },
    caption: { type: String, maxlength: 120 },
  },
  { _id: false }
);

const CustomLinkSchema = new Schema<ICustomLink>(
  {
    label: { type: String, required: true, maxlength: 40 },
    url: { type: String, required: true },
  },
  { _id: false }
);

const PageLinksSchema = new Schema<IPageLinks>(
  {
    website: { type: String },
    twitter: { type: String },
    telegram: { type: String },
    discord: { type: String },
    github: { type: String },
    docs: { type: String },
    custom: { type: [CustomLinkSchema], default: [], validate: [arrayLimit(3), 'Max 3 custom links'] },
  },
  { _id: false }
);

const RoadmapItemSchema = new Schema<IRoadmapItem>(
  {
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    status: { type: String, enum: ['planned', 'in-progress', 'complete'], default: 'planned' },
  },
  { _id: false }
);

function arrayLimit(max: number) {
  return (val: any[]) => val.length <= max;
}

const SovereignPageSchema = new Schema<ISovereignPage>(
  {
    sovereignId: { type: Number, required: true, unique: true, index: true },
    creatorWallet: { type: String, required: true },
    summary: { type: String, maxlength: 2000 },
    coverImage: { type: String },
    gallery: {
      type: [GalleryItemSchema],
      default: [],
      validate: [arrayLimit(6), 'Max 6 gallery images'],
    },
    videoEmbed: { type: String },
    links: { type: PageLinksSchema, default: () => ({}) },
    roadmap: {
      type: [RoadmapItemSchema],
      default: [],
      validate: [arrayLimit(8), 'Max 8 roadmap items'],
    },
  },
  {
    timestamps: true,
  }
);

export const SovereignPage = mongoose.model<ISovereignPage>('SovereignPage', SovereignPageSchema);
