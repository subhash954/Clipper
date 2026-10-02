/**
 * CLIPPER SOCIAL PUBLISHING — ADAPTER TYPES & INTERFACES
 * Phase 2, 7, 10
 */

import { SupportedPlatform } from '@/lib/factory/types';
import { SocialConnection, PublishJob, PublishMediaValidation, ErrorClassification } from '../types';

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  externalUrl?: string;
  platformMetadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
    classification: ErrorClassification;
    actionableFix: string;
  };
}

export interface SocialPlatformAdapter {
  platform: SupportedPlatform;
  displayName: string;

  /**
   * Validates whether OAuth tokens and scopes are currently active and authorized.
   */
  validateCredentials(
    connection: SocialConnection
  ): Promise<{ valid: boolean; scopesValid: boolean; error?: string }>;

  /**
   * Pre-flight checks on media file to verify compliance with platform specifications.
   */
  prepareMedia(filePath: string): Promise<PublishMediaValidation>;

  /**
   * Performs the real API upload and publication workflow.
   * Throws or returns an error if credentials are not configured or platform rejects.
   * NEVER returns simulated success.
   */
  publishPost(connection: SocialConnection, job: PublishJob): Promise<PublishResult>;

  /**
   * Checks external publication status directly from the platform.
   */
  getPublicationStatus(
    connection: SocialConnection,
    externalPostId: string
  ): Promise<{ published: boolean; url?: string; raw?: any }>;
}
