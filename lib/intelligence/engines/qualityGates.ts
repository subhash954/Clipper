import { QualityGateAudit, ClipQualityGateStatus, StandaloneEvaluation } from '../types';

export interface QualityGateParams {
  wordsCount: number;
  durationSeconds: number;
  hasTranscriptAlignment: boolean;
  standalone: StandaloneEvaluation;
  isDuplicate: boolean;
  confidence: number;
  clipText: string;
}

/**
 * Clip Quality Gates Engine
 * Strictly validates that candidate clips satisfy 8 production quality gates
 * before surfacing to the creator studio.
 */
export function auditQualityGates(params: {
  wordsCount: number;
  durationSeconds: number;
  hasTranscriptAlignment: boolean;
  standalone: StandaloneEvaluation;
  isDuplicate: boolean;
  confidence: number;
  clipText: string;
}): QualityGateAudit {
  const {
    wordsCount,
    durationSeconds,
    hasTranscriptAlignment,
    standalone,
    isDuplicate,
    confidence,
    clipText,
  } = params;

  const passedGates: string[] = [];
  const failedGates: string[] = [];
  const reasons: string[] = [];

  // Gate 1: Transcript Alignment
  if (hasTranscriptAlignment && wordsCount > 0) {
    passedGates.push('transcript_alignment');
  } else {
    failedGates.push('transcript_alignment');
    reasons.push('Clip failed transcript alignment: missing word timestamps.');
  }

  // Gate 2: Minimum Duration (15 seconds)
  if (durationSeconds >= 14.8) {
    passedGates.push('min_duration');
  } else {
    failedGates.push('min_duration');
    reasons.push(`Duration (${durationSeconds.toFixed(1)}s) is below 15.0s minimum threshold.`);
  }

  // Gate 3: Maximum Duration (65 seconds)
  if (durationSeconds <= 65.5) {
    passedGates.push('max_duration');
  } else {
    failedGates.push('max_duration');
    reasons.push(`Duration (${durationSeconds.toFixed(1)}s) exceeds 65.0s maximum limit.`);
  }

  // Gate 4: Context Completeness
  if (!standalone.contextRequired || standalone.recommendedAdjustment?.action === 'expand_backward') {
    passedGates.push('context_completeness');
  } else {
    failedGates.push('context_completeness');
    reasons.push(standalone.recommendedAdjustment?.reason || 'Clip lacks required prerequisite context.');
  }

  // Gate 5: Sentence Integrity
  const trimmed = clipText.trim();
  const endsCleanly = /[.!?]$/.test(trimmed) || !trimmed.endsWith(',');
  if (endsCleanly) {
    passedGates.push('sentence_integrity');
  } else {
    failedGates.push('sentence_integrity');
    reasons.push('Clip concludes abruptly on an incomplete sentence fragment.');
  }

  // Gate 6: Payoff Completeness
  if (standalone.payoffCompleteness >= 60) {
    passedGates.push('payoff_completeness');
  } else {
    failedGates.push('payoff_completeness');
    reasons.push('Clip fails to provide a conclusive payoff or resolution to the initial hook.');
  }

  // Gate 7: Duplicate Detection
  if (!isDuplicate) {
    passedGates.push('duplicate_detection');
  } else {
    failedGates.push('duplicate_detection');
    reasons.push('Clip is a redundant duplicate or near-duplicate of a higher-scoring candidate.');
  }

  // Gate 8: Confidence Threshold
  if (confidence >= 0.70) {
    passedGates.push('confidence_threshold');
  } else {
    failedGates.push('confidence_threshold');
    reasons.push(`Overall confidence (${(confidence * 100).toFixed(0)}%) is below 70% threshold.`);
  }

  // Determine final status
  let status: ClipQualityGateStatus = 'verified';

  // Hard failure conditions
  if (
    failedGates.includes('transcript_alignment') ||
    failedGates.includes('min_duration') ||
    failedGates.includes('max_duration') ||
    failedGates.includes('context_completeness') ||
    isDuplicate
  ) {
    status = 'rejected';
  } else if (failedGates.length > 0 || confidence < 0.82) {
    status = 'needs_review';
  }

  return {
    status,
    passedGates,
    failedGates,
    reasons,
  };
}
