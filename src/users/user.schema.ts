import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document & {
  comparePassword(candidatePassword: string): Promise<boolean>;
  toJSON(): Omit<UserDocument, 'password' | '__v'>;
};

@Schema({
  timestamps: true,
  collection: 'users',
  // _id: true,
})

export class User {
  _id: string;

  @Prop({ 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    index: true,
    email: true 
  })
  email: string;

  @Prop({ 
    required: true,
    select: false  // Don't return password hash in queries by default
  })
  password: string;

  @Prop({ 
    required: true, 
    enum: ['creator', 'eventee'],
    index: true
  })
  role: string;

  @Prop({
    type: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, trim: true },
      avatar: { type: String }
    },
    required: true,
    _id: false
  })
  profile: {
    fullName: string;
    phone?: string;
    avatar?: string;
  };

  @Prop({ 
    default: false,
    index: true 
  })
  isVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);


UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

UserSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj._id;
  delete obj.createdAt;
  delete obj.updatedAt;
  // delete obj.verificationToken;
  // delete obj.verificationTokenExpiry;
  // delete obj.passwordResetToken;
  // delete obj.passwordResetExpiry;
  // delete obj.failedLoginAttempts;
  // delete obj.accountLockedUntil;
  delete obj.__v;
  return obj;
};