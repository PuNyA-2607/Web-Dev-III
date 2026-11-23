import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      // TTL index: MongoDB will automatically delete expired tokens from disk
      index: { expires: 0 },
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.tokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Helper method to check if token is currently active
refreshTokenSchema.methods.isActive = function () {
  return !this.revokedAt && Date.now() < this.expiresAt.getTime();
};

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
