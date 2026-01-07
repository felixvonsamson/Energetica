/**
 * Type definitions for notification features.
 *
 * This module provides two categories of types:
 *
 * 1. **OpenAPI Schema Types** - Extracted from backend API schemas using ApiSchema
 * 2. **Derived Types** - Custom interfaces derived from OpenAPI responses
 *
 * All types correspond to backend schemas in
 * energetica/schemas/notifications.py
 */

import type { ApiSchema } from "@/types/api-helpers";

// ============================================================================
// OpenAPI Schema Types
// ============================================================================
// These are extracted directly from the OpenAPI spec and always stay in sync
// with the backend. Use these for API responses and requests.

/**
 * Response from GET /api/v1/notifications - List of all notifications for the
 * current user.
 */
export type NotificationListResponse = ApiSchema<"NotificationListOut">;

// ============================================================================
// Derived Types
// ============================================================================
// These are extracted from OpenAPI responses for convenience and clarity.

/**
 * Represents a single notification. Extracted from NotificationOut for
 * convenient access to individual notification properties.
 */
export type Notification = ApiSchema<"NotificationOut">;
