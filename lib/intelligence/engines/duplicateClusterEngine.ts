import { CandidateClip } from '../types';

export interface ClipCluster {
  clusterId: string;
  primaryClipId: string;
  alternativeClipIds: string[];
  sharedTheme: string;
}

/**
 * Computes Jaccard word set similarity between two strings
 */
function computeWordJaccardSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(
    textA
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const wordsB = new Set(
    textB
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Computes temporal interval overlap between [startA, endA] and [startB, endB]
 */
function computeTemporalOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  if (overlapEnd <= overlapStart) return 0;

  const overlapDuration = overlapEnd - overlapStart;
  const minDuration = Math.min(endA - startA, endB - startB);
  return minDuration > 0 ? overlapDuration / minDuration : 0;
}

/**
 * Duplicate & Similarity Clustering Engine
 * Groups near-duplicate or overlapping clips into cohesive clusters,
 * nominating the highest-performing clip as primary and subordinates as alternatives.
 */
export function clusterCandidateClips(clips: CandidateClip[]): {
  clusteredClips: CandidateClip[];
  clusters: ClipCluster[];
} {
  if (clips.length <= 1) {
    return {
      clusteredClips: clips.map((c) => ({ ...c, isPrimaryInCluster: true })),
      clusters: [],
    };
  }

  // Sort candidates by overall editorial score descending
  const sorted = [...clips].sort(
    (a, b) => b.editorialScore.overallScore - a.editorialScore.overallScore
  );

  const assignedCluster = new Map<string, string>();
  const clusters: ClipCluster[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (assignedCluster.has(current.id)) continue;

    const clusterId = `cluster-${clusters.length + 1}`;
    assignedCluster.set(current.id, clusterId);

    const alternativeIds: string[] = [];

    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];
      if (assignedCluster.has(other.id)) continue;

      const temporalOverlap = computeTemporalOverlap(
        current.start,
        current.end,
        other.start,
        other.end
      );
      const textSimilarity = computeWordJaccardSimilarity(
        current.transcript,
        other.transcript
      );

      // Overlap > 45% or textual similarity > 60% indicates a duplicate/variant
      if (temporalOverlap >= 0.45 || textSimilarity >= 0.60) {
        assignedCluster.set(other.id, clusterId);
        alternativeIds.push(other.id);
      }
    }

    clusters.push({
      clusterId,
      primaryClipId: current.id,
      alternativeClipIds: alternativeIds,
      sharedTheme: current.hook.text.slice(0, 50),
    });
  }

  // Update candidate clips with cluster membership and primary designation
  const clusteredClips = clips.map((clip) => {
    const clusterId = assignedCluster.get(clip.id);
    const cluster = clusters.find((c) => c.clusterId === clusterId);
    const isPrimary = cluster ? cluster.primaryClipId === clip.id : true;

    return {
      ...clip,
      clusterId,
      isPrimaryInCluster: isPrimary,
    };
  });

  return {
    clusteredClips,
    clusters,
  };
}
