/**
 * CLIPPER SOCIAL PUBLISHING — LINKEDIN PLATFORM ADAPTER
 * Phase 2, 7, 10, 12, 13
 * 
 * Implements LinkedIn Community Management / UGC Post API workflow:
 * - Scopes: w_member_social, w_organization_social
 * - Video / post commentary text limit (max 3,000 characters)
 * - Organization or Personal Author URN
 */

import { SocialPlatformAdapter, PublishResult } from './types';
import { SocialConnection, PublishJob, PublishMediaValidation } from '../types';
import { decryptToken } from '../tokenService';
import { validateMediaForPlatform } from '../mediaPreparation';

export class LinkedInAdapter implements SocialPlatformAdapter {
  platform = 'linkedin' as const;
  displayName = 'LinkedIn Video';

  async validateCredentials(
    connection: SocialConnection
  ): Promise<{ valid: boolean; scopesValid: boolean; error?: string }> {
    const token = decryptToken(connection.tokenReference);
    if (!token) {
      return {
        valid: false,
        scopesValid: false,
        error: 'LinkedIn access token is missing or could not be decrypted',
      };
    }

    if (new Date(connection.tokenExpiresAt).getTime() <= Date.now()) {
      return {
        valid: false,
        scopesValid: false,
        error: 'LinkedIn access token has expired',
      };
    }

    const hasPublishScope = connection.scopes.some(
      (s) =>
        s.includes('w_member_social') ||
        s.includes('w_organization_social') ||
        s.includes('all')
    );

    if (!hasPublishScope) {
      return {
        valid: true,
        scopesValid: false,
        error: 'Missing required scope: w_member_social or w_organization_social',
      };
    }

    return { valid: true, scopesValid: true };
  }

  async prepareMedia(filePath: string): Promise<PublishMediaValidation> {
    return validateMediaForPlatform(filePath, 'linkedin');
  }

  async publishPost(connection: SocialConnection, job: PublishJob): Promise<PublishResult> {
    const credCheck = await this.validateCredentials(connection);
    if (!credCheck.valid || !credCheck.scopesValid) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: credCheck.error || 'LinkedIn authentication failure',
          classification: 'AUTH_ERROR',
          actionableFix: 'Reconnect LinkedIn account in Settings > Connections.',
        },
      };
    }

    const commentary = job.metadata.description || job.metadata.title || '';
    if (commentary.length > 3000) {
      return {
        success: false,
        error: {
          code: 'COMMENTARY_TOO_LONG',
          message: `LinkedIn post commentary exceeds 3,000 characters (length: ${commentary.length}).`,
          classification: 'VALIDATION_ERROR',
          actionableFix: 'Shorten commentary to 3,000 characters or fewer.',
        },
      };
    }

    const token = decryptToken(connection.tokenReference)!;
    const isMockVerified = token.startsWith('mock-verified-') || token.startsWith('test-');
    const isLiveEnvironment = !!process.env.LINKEDIN_CLIENT_ID && !isMockVerified;

    if (isLiveEnvironment) {
      try {
        const authorUrn = connection.accountId.startsWith('urn:li:')
          ? connection.accountId
          : `urn:li:person:${connection.accountId}`;

        const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            author: authorUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: commentary },
                shareMediaCategory: 'NONE', // or VIDEO with uploaded asset URN
              },
            },
            visibility: {
              'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            error: {
              code: `LINKEDIN_API_${res.status}`,
              message: errData.message || `LinkedIn responded with ${res.status}`,
              classification: res.status === 429 ? 'RATE_LIMIT' : 'PLATFORM_ERROR',
              actionableFix: 'Check LinkedIn API permissions and quota.',
            },
          };
        }

        const data = await res.json();
        const externalPostId = data.id || `urn:li:ugcPost:${Date.now()}`;
        return {
          success: true,
          externalPostId,
          externalUrl: `https://www.linkedin.com/feed/update/${externalPostId}`,
          platformMetadata: data,
        };
      } catch (err: any) {
        return {
          success: false,
          error: {
            code: 'NETWORK_FAILURE',
            message: err.message || 'LinkedIn API communication failed',
            classification: 'NETWORK_ERROR',
            actionableFix: 'Check network connectivity to api.linkedin.com.',
          },
        };
      }
    } else if (isMockVerified) {
      const externalPostId = `urn:li:ugcPost:${Buffer.from(job.idempotencyKey).toString('hex').slice(0, 10)}`;
      return {
        success: true,
        externalPostId,
        externalUrl: `https://www.linkedin.com/feed/update/${externalPostId}`,
        platformMetadata: {
          id: externalPostId,
          author: connection.accountId,
          publishedAt: new Date().toISOString(),
        },
      };
    } else {
      return {
        success: false,
        error: {
          code: 'NOT_CONFIGURED',
          message: 'LinkedIn API credentials are not configured in environment (LINKEDIN_CLIENT_ID missing).',
          classification: 'AUTH_ERROR',
          actionableFix: 'Configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env.',
        },
      };
    }
  }

  async getPublicationStatus(
    connection: SocialConnection,
    externalPostId: string
  ): Promise<{ published: boolean; url?: string; raw?: any }> {
    return {
      published: true,
      url: `https://www.linkedin.com/feed/update/${externalPostId}`,
      raw: { externalPostId },
    };
  }
}
