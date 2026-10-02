/**
 * CLIPPER CONTENT FACTORY — QUALITY GATES AUDITOR
 * Phase 35, 52
 * 
 * Strict pre-publication quality validation.
 * If any critical requirement fails, the asset is quarantined as NEEDS_REVIEW.
 */

import { ContentAsset, ContentQualityGateResult } from './types';
import { getPlatformProfile } from './platformProfiles';

export function auditContentAsset(asset: ContentAsset): ContentQualityGateResult {
  const reasons: string[] = [];
  const profile = getPlatformProfile(asset.platform);

  // 1. Source Alignment Check
  const sourceAlignment = Boolean(
    asset.lineage &&
    asset.lineage.sourceStart >= 0 &&
    asset.lineage.sourceEnd > asset.lineage.sourceStart &&
    asset.lineage.sourceProjectId
  );
  if (!sourceAlignment) {
    reasons.push('Asset lineage missing or invalid source time boundaries.');
  }

  // 2. Narrative Completeness Check
  const narrativeCompleteness = Boolean(
    asset.durationSeconds >= 5 &&
    asset.title &&
    asset.description
  );
  if (!narrativeCompleteness) {
    reasons.push('Asset lacks minimum narrative structure or duration.');
  }

  // 3. Hook Validity Check
  const hookValidity = Boolean(
    asset.titles &&
    asset.titles.length > 0 &&
    asset.titles[0].title.length >= 8
  );
  if (!hookValidity) {
    reasons.push('Asset lacks verified opening hook or title.');
  }

  // 4. No Hallucinated Facts Check
  const hasExternalContext = asset.externalContextFlags && asset.externalContextFlags.length > 0;
  const noHallucinatedFacts = !hasExternalContext || asset.lockedFields.includes('verified_facts');
  if (hasExternalContext && !noHallucinatedFacts) {
    reasons.push('Asset contains unverified external context flags requiring human review.');
  }

  // 5. Duration Validity Check
  const durationValidity =
    asset.durationSeconds >= profile.minDurationSeconds &&
    asset.durationSeconds <= profile.maxDurationSeconds;
  if (!durationValidity) {
    reasons.push(
      `Duration (${asset.durationSeconds}s) violates ${profile.displayName} limits [${profile.minDurationSeconds}s - ${profile.maxDurationSeconds}s].`
    );
  }

  // 6. Platform Validity Check
  const platformValidity = profile.recommendedAspectRatios.includes(asset.aspectRatio);
  if (!platformValidity) {
    reasons.push(`Aspect ratio ${asset.aspectRatio} not recommended for ${profile.displayName}.`);
  }

  // 7. Caption Timing Check
  let captionTimingValid = true;
  if (asset.renderSpec && asset.renderSpec.captions && asset.renderSpec.captions.words) {
    const invalidWords = asset.renderSpec.captions.words.filter(
      (w) => w.start < 0 || w.end > asset.durationSeconds + 1.0 || w.start > w.end
    );
    if (invalidWords.length > 0) {
      captionTimingValid = false;
      reasons.push(`Captions contain ${invalidWords.length} out-of-bounds word timestamps.`);
    }
  }

  // 8. RenderSpec Validity Check
  let renderSpecValid = true;
  if (asset.renderSpec) {
    if (asset.renderSpec.duration <= 0) {
      renderSpecValid = false;
      reasons.push('RenderSpec duration is zero or negative.');
    }
    const videoTrack = asset.renderSpec.tracks.find((t) => t.type === 'VIDEO');
    if (!videoTrack || videoTrack.clips.length === 0) {
      renderSpecValid = false;
      reasons.push('RenderSpec video track missing source media clip.');
    }
  }

  const checks = {
    sourceAlignment,
    narrativeCompleteness,
    hookValidity,
    noHallucinatedFacts,
    durationValidity,
    platformValidity,
    captionTimingValid,
    renderSpecValid,
  };

  const totalChecks = Object.keys(checks).length;
  const passedChecksCount = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passedChecksCount / totalChecks) * 100);
  const passed = reasons.length === 0;

  return {
    passed,
    score,
    checks,
    reasons,
  };
}
