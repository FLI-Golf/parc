import { z } from 'zod';

export const userSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	email: z.string().email('Invalid email address'),
	username: z.string().optional(),
	password: z.string().min(8, 'Password must be at least 8 characters'),
	passwordConfirm: z.string().min(8, 'Password confirmation is required'),
	phone: z.string().optional(),
	role: z.enum(['Manager', 'Server']).default('Server'),
	emailVisibility: z.boolean().default(true),
	avatar: z.instanceof(File).optional()
});

export type UserSchema = typeof userSchema;