// src/schemas/messages.schema.js
import { z } from 'zod';

// Types de messages de base
export const MessageType = z.enum(['request', 'response', 'notification', 'error']);

// Message de base
export const BaseMessageSchema = z.object({
    protocol: z.literal('helios-starling').optional(), // Optionnel pour rétrocompatibilité
    version: z.string().regex(/^\d+\.\d+\.\d+$/), // Semver
    timestamp: z.number().int().positive(),
    type: MessageType
});

// Schéma Request
export const RequestSchema = BaseMessageSchema.extend({
    type: z.literal('request'),
    requestId: z.string().uuid(),
    method: z.string().min(3).regex(/^[a-zA-Z][\w.:]*$/),
    payload: z.any().optional()
});

// Schéma Response
export const ResponseSchema = BaseMessageSchema.extend({
    type: z.literal('response'),
    requestId: z.string().uuid(),
    success: z.boolean(),
    data: z.any().optional(),
    error: z.object({
        code: z.string(),
        message: z.string()
    }).optional()
});

// Schéma Notification
export const NotificationSchema = BaseMessageSchema.extend({
    type: z.literal('notification'),
    notification: z.any()
});

// Schéma Error
export const ErrorSchema = BaseMessageSchema.extend({
    type: z.literal('error'),
    error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional()
    })
});

// Union de tous les types de messages
export const StandardMessageSchema = z.discriminatedUnion('type', [
    RequestSchema,
    ResponseSchema,
    NotificationSchema,
    ErrorSchema
]);

// Helper pour créer des messages standards
export const createStandardMessage = (type, data = {}) => ({
    protocol: 'helios-starling',
    version: '1.0.0',
    timestamp: Date.now(),
    type,
    ...data
});