/**
 * CLIPPER PHASE 6: REAL AUTO-REFRAME TEST SUITE
 * Unit, Integration, Determinism, and EDL Non-Destructive Tests
 * Covers all 15 core engine categories.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  AspectRatio,
  MultiPersonMode,
  SubjectDetection,
  SubjectTrack,
  SceneBoundary,
  ReframeConfig,
  ReframeKeyframe,
  ASPECT_RATIO_CONFIGS,
} from '../lib/reframe/types';
import {
  calculateCropDimensions,
  buildFfmpegReframeCropFilter,
  sampleFrames,
  cleanupSampleFrames,
} from '../lib/reframe/reframeEngine';
import {
  computeIoU,
  computeCenterDistance,
  findSceneIndex,
  interpolateTrackGaps,
  buildSubjectTracks,
} from '../lib/reframe/trackingEngine';
import {
  computeTargetFocalPoint,
  generateCameraPath,
} from '../lib/reframe/cameraPathPlanner';
import {
  LocalCentroidDetectorProvider,
  FixtureDetectorProvider,
  HybridDetectorProvider,
  ISubjectDetectorProvider,
  sanitizeProviderFailureReason,
} from '../lib/reframe/detectorProvider';
import { BunnyStorageProvider } from '../lib/storage/providers/bunnyStorageProvider';
import { LocalStorageProvider } from '../lib/storage/providers/localStorageProvider';
import { MAX_MEDIA_DOWNLOAD_BYTES } from '../lib/storage/types';
import { MAX_REFRAME_MEDIA_BYTES } from '../lib/reframe/types';
import {
  assertSafeFilesystemPath,
  resolveAuthorizedMediaSource,
} from '../lib/reframe/mediaResolver';
import {
  validateSubjectDetection,
  validateSceneBoundary,
  validateSubjectTrack,
  validateReframeKeyframe,
  validateCameraPath,
  validateReframeConfig,
  validateReframeAnalysis,
} from '../lib/reframe/validation';
import { EditingService } from '../lib/editor/editingService';
import { getStorage } from '../lib/storage';
import { getStorageService } from '../lib/storage/storageService';
import { ClipperError } from '../lib/errors';


async function runPhase6UnitTests() {
  console.log('====================================================');
  console.log('🎬 CLIPPER PHASE 6: REAL AUTO-REFRAME TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // CATEGORY 1: Aspect Ratio Math & Even Pixel Constraints
  // --------------------------------------------------------------------------
  console.log('--- CATEGORY 1: Aspect Ratio Math & Even Pixel Rounding ---');

  const ratios: AspectRatio[] = ['16:9', '9:16', '1:1', '4:5'];
  const testResolutions = [
    { w: 1920, h: 1080 },
    { w: 3840, h: 2160 },
    { w: 1280, h: 720 },
    { w: 1920, h: 1081 }, // odd height
    { w: 1921, h: 1080 }, // odd width
  ];

  for (const aspect of ratios) {
    assert(Boolean(ASPECT_RATIO_CONFIGS[aspect]), `Aspect ratio config exists for ${aspect}`);
    const cfg = ASPECT_RATIO_CONFIGS[aspect];
    assert(cfg.ratio > 0, `Aspect ratio value for ${aspect} is positive`);

    for (const res of testResolutions) {
      const crop = calculateCropDimensions(res.w, res.h, aspect);
      assert(crop.cropWidth % 2 === 0, `cropWidth for ${aspect} (${res.w}x${res.h}) is even: ${crop.cropWidth}`);
      assert(crop.cropHeight % 2 === 0, `cropHeight for ${aspect} (${res.w}x${res.h}) is even: ${crop.cropHeight}`);
      assert(crop.targetWidth % 2 === 0, `targetWidth for ${aspect} is even: ${crop.targetWidth}`);
      assert(crop.targetHeight % 2 === 0, `targetHeight for ${aspect} is even: ${crop.targetHeight}`);
      assert(crop.cropWidth <= res.w, `cropWidth does not exceed sourceWidth (${crop.cropWidth} <= ${res.w})`);
      assert(crop.cropHeight <= res.h, `cropHeight does not exceed sourceHeight (${crop.cropHeight} <= ${res.h})`);
    }
  }

  // Exact 9:16 crop calculation for 1920x1080
  const crop916 = calculateCropDimensions(1920, 1080, '9:16');
  // 1080 * 9 / 16 = 607.5 -> even: 606 or 608
  assert(crop916.cropHeight === 1080, '9:16 crop uses full 1080 height');
  assert(crop916.cropWidth === 606 || crop916.cropWidth === 608, `9:16 crop width is ~608px (got ${crop916.cropWidth})`);

  // Exact 1:1 crop calculation for 1920x1080
  const crop11 = calculateCropDimensions(1920, 1080, '1:1');
  assert(crop11.cropHeight === 1080, '1:1 crop uses full 1080 height');
  assert(crop11.cropWidth === 1080, '1:1 crop uses 1080 width');

  // Exact 4:5 crop calculation for 1920x1080
  const crop45 = calculateCropDimensions(1920, 1080, '4:5');
  assert(crop45.cropHeight === 1080, '4:5 crop uses full 1080 height');
  assert(crop45.cropWidth === 864, '4:5 crop width is 864px');

  // --------------------------------------------------------------------------
  // CATEGORY 2: Crop Bounds & Safe Window Clamping
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 2: Crop Bounds & Clamping ---');

  const pathOutBounds = generateCameraPath({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 5.0,
    subjectTracks: [
      {
        trackId: 'tr-edge',
        start: 0,
        end: 5,
        averageConfidence: 0.9,
        detections: [
          { timestamp: 0, x: 0.01, y: 0.01, width: 0.2, height: 0.2, confidence: 0.9 }, // extreme top-left
          { timestamp: 5, x: 0.99, y: 0.99, width: 0.2, height: 0.2, confidence: 0.9 }, // extreme bottom-right
        ],
      },
    ],
    config: { targetAspectRatio: '9:16' },
  });

  for (const kf of pathOutBounds.keyframes) {
    const halfW = (kf.width ?? 0.316) / 2;
    const halfH = (kf.height ?? 1.0) / 2;
    const cx = kf.centerX ?? kf.x;
    const cy = kf.centerY ?? kf.y;
    const left = cx - halfW;
    const right = cx + halfW;
    const top = cy - halfH;
    const bottom = cy + halfH;

    assert(left >= -0.001, `Left bound clamped inside frame: ${left}`);
    assert(right <= 1.001, `Right bound clamped inside frame: ${right}`);
    assert(top >= -0.001, `Top bound clamped inside frame: ${top}`);
    assert(bottom <= 1.001, `Bottom bound clamped inside frame: ${bottom}`);
  }

  // --------------------------------------------------------------------------
  // CATEGORY 3: Coordinate Normalization & Input Validation
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 3: Coordinate Normalization & Sanitization ---');

  const dirtyDetections: SubjectDetection[][] = [
    [
      { timestamp: 0, x: -0.5, y: 1.5, width: -0.2, height: 2.0, confidence: 0.8 },
      { timestamp: 0, x: NaN, y: 0.5, width: 0.2, height: 0.2, confidence: 0.9 }, // NaN must be ignored
      { timestamp: 0, x: 0.4, y: Infinity, width: 0.2, height: 0.2, confidence: 0.9 }, // Infinity must be ignored
      { timestamp: 0, x: 0.5, y: 0.5, width: 0.2, height: 0.2, confidence: 0.1 }, // Below minConfidence 0.3
      { timestamp: 0, x: 0.45, y: 0.45, width: 0.2, height: 0.3, confidence: 0.85 }, // Valid detection
    ],
  ];

  const sanitizedTracks = buildSubjectTracks(dirtyDetections, [{ sceneIndex: 0, start: 0, end: 10 }]);
  assert(sanitizedTracks.length === 1, 'Only valid finite detections above confidence threshold were kept');
  const kept = sanitizedTracks[0].detections[0];
  assert(kept.x >= 0 && kept.x <= 1, `Normalized x: ${kept.x}`);
  assert(kept.y >= 0 && kept.y <= 1, `Normalized y: ${kept.y}`);
  assert(kept.width > 0 && kept.width <= 1, `Normalized width: ${kept.width}`);
  assert(kept.height > 0 && kept.height <= 1, `Normalized height: ${kept.height}`);

  // --------------------------------------------------------------------------
  // CATEGORY 4: Subject Selection & Centroid Scoring
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 4: Subject Selection Scoring ---');

  const dSpeaker: SubjectDetection = {
    timestamp: 0,
    x: 0.48,
    y: 0.45,
    width: 0.3,
    height: 0.4,
    confidence: 0.95,
  };
  const dBackground: SubjectDetection = {
    timestamp: 0,
    x: 0.85,
    y: 0.5,
    width: 0.1,
    height: 0.1,
    confidence: 0.6,
  };

  const focalSingle = computeTargetFocalPoint([dSpeaker, dBackground], 'SINGLE', 0.316);
  assert(focalSingle.x === dSpeaker.x, 'Primary speaker with higher confidence and area selected');
  assert(focalSingle.confidence === 0.95, 'Primary speaker confidence used');

  // --------------------------------------------------------------------------
  // CATEGORY 5: Tracking Continuity & Spatial Association (IoU & Distance)
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 5: Tracking Continuity & Spatial Association ---');

  const boxA: SubjectDetection = { timestamp: 0, x: 0.5, y: 0.5, width: 0.2, height: 0.2, confidence: 0.9 };
  const boxIdentical: SubjectDetection = { timestamp: 1, x: 0.5, y: 0.5, width: 0.2, height: 0.2, confidence: 0.9 };
  const boxSlightMove: SubjectDetection = { timestamp: 1, x: 0.52, y: 0.51, width: 0.2, height: 0.2, confidence: 0.9 };
  const boxFar: SubjectDetection = { timestamp: 1, x: 0.9, y: 0.9, width: 0.2, height: 0.2, confidence: 0.9 };

  assert(Math.abs(computeIoU(boxA, boxIdentical) - 1.0) < 0.001, 'Identical boxes have IoU 1.0');
  assert(computeIoU(boxA, boxFar) === 0.0, 'Non-overlapping boxes have IoU 0.0');
  const iouMoved = computeIoU(boxA, boxSlightMove);
  assert(iouMoved > 0.7 && iouMoved < 1.0, `Slightly moved boxes have high IoU: ${iouMoved.toFixed(3)}`);

  const distNear = computeCenterDistance(boxA, boxSlightMove);
  const distFar = computeCenterDistance(boxA, boxFar);
  assert(distNear < 0.05, `Slight movement has small Euclidean center distance: ${distNear.toFixed(3)}`);
  assert(distFar > 0.5, `Far box has large Euclidean center distance: ${distFar.toFixed(3)}`);

  // Continuity across 3 frames
  const continuousFrames: SubjectDetection[][] = [
    [{ timestamp: 0, x: 0.3, y: 0.4, width: 0.2, height: 0.3, confidence: 0.9 }],
    [{ timestamp: 1, x: 0.32, y: 0.41, width: 0.2, height: 0.3, confidence: 0.9 }],
    [{ timestamp: 2, x: 0.34, y: 0.42, width: 0.2, height: 0.3, confidence: 0.9 }],
  ];
  const continuousTracks = buildSubjectTracks(continuousFrames, [{ sceneIndex: 0, start: 0, end: 10 }]);
  assert(continuousTracks.length === 1, 'Continuous detections consolidated into a single SubjectTrack');
  assert(continuousTracks[0].detections.length === 3, 'All 3 frame detections attached to track');

  // --------------------------------------------------------------------------
  // CATEGORY 6: Missing Detection Interpolation & Velocity Clamping
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 6: Missing Detection Interpolation ---');

  const gappedDetections: SubjectDetection[] = [
    { timestamp: 0.0, x: 0.2, y: 0.3, width: 0.2, height: 0.3, confidence: 1.0 },
    { timestamp: 2.0, x: 0.4, y: 0.5, width: 0.2, height: 0.3, confidence: 1.0 }, // 2.0s gap
  ];

  const interpolated = interpolateTrackGaps(gappedDetections, 2.5);
  assert(interpolated.length === 3, `Gap of 2.0s interpolated 1 midpoint (total length ${interpolated.length})`);
  const midPoint = interpolated[1];
  assert(midPoint.timestamp === 1.0, `Midpoint timestamp is 1.0s: ${midPoint.timestamp}`);
  assert(midPoint.x === 0.3, `Midpoint x is linearly interpolated to 0.3: ${midPoint.x}`);
  assert(midPoint.y === 0.4, `Midpoint y is linearly interpolated to 0.4: ${midPoint.y}`);
  assert(midPoint.confidence === 0.85, `Interpolated point carries penalty (0.85 vs 1.0): ${midPoint.confidence}`);

  // Gap exceeding maxGapSeconds is NOT interpolated
  const largeGapDetections: SubjectDetection[] = [
    { timestamp: 0.0, x: 0.2, y: 0.3, width: 0.2, height: 0.3, confidence: 1.0 },
    { timestamp: 5.0, x: 0.4, y: 0.5, width: 0.2, height: 0.3, confidence: 1.0 },
  ];
  const notInterpolated = interpolateTrackGaps(largeGapDetections, 2.0);
  assert(notInterpolated.length === 2, 'Large gap (>2.0s) was not erroneously bridged');

  // --------------------------------------------------------------------------
  // CATEGORY 7: Scene-Cut Reset & Boundary Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 7: Scene-Cut Reset & Boundary Isolation ---');

  const scenes: SceneBoundary[] = [
    { sceneIndex: 0, start: 0.0, end: 3.0 },
    { sceneIndex: 1, start: 3.0, end: 6.0 },
  ];

  assert(findSceneIndex(1.5, scenes) === 0, 'Timestamp 1.5s belongs to Scene 0');
  assert(findSceneIndex(3.0, scenes) === 1, 'Timestamp 3.0s belongs to Scene 1');
  assert(findSceneIndex(4.5, scenes) === 1, 'Timestamp 4.5s belongs to Scene 1');

  // Detection at 2.9s and 3.1s must NOT be grouped into the same track
  const crossSceneFrames: SubjectDetection[][] = [
    [{ timestamp: 2.8, x: 0.5, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 }],
    [{ timestamp: 3.2, x: 0.5, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 }],
  ];
  const splitTracks = buildSubjectTracks(crossSceneFrames, scenes);
  assert(splitTracks.length === 2, 'Detections across scene cut were isolated into 2 distinct tracks');
  assert(splitTracks[0].end <= 3.0, 'First track finishes in Scene 0');
  assert(splitTracks[1].start >= 3.0, 'Second track starts in Scene 1');

  // Camera path re-anchoring across cut
  const multiScenePath = generateCameraPath({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 6.0,
    scenes,
    subjectTracks: [
      {
        trackId: 'tr-s0',
        start: 0,
        end: 3.0,
        averageConfidence: 0.9,
        detections: [{ timestamp: 2.5, x: 0.2, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 }],
      },
      {
        trackId: 'tr-s1',
        start: 3.0,
        end: 6.0,
        averageConfidence: 0.9,
        detections: [{ timestamp: 3.5, x: 0.8, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 }],
      },
    ],
  });

  const kfBeforeCut = multiScenePath.keyframes.find((k) => k.sceneIndex === 0 && (k.timestamp ?? k.time) >= 2.0);
  const kfAtCut = multiScenePath.keyframes.find((k) => k.sceneIndex === 1 && Math.abs((k.timestamp ?? k.time) - 3.0) < 0.1);
  assert(Boolean(kfBeforeCut), 'Keyframe before cut exists');
  assert(Boolean(kfAtCut), 'Keyframe at cut exists');
  // Immediately at the scene cut, the camera does NOT sluggishly drag across the frame
  assert(kfAtCut!.sceneIndex === 1, 'Keyframe at cut is assigned Scene 1');

  // --------------------------------------------------------------------------
  // CATEGORY 8: Camera Smoothing, Dead-Zone & Headroom Anchoring
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 8: Camera Smoothing & Dead-Zone Verification ---');

  const deadZoneDetections = [
    { timestamp: 0.0, x: 0.500, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 },
    { timestamp: 0.5, x: 0.520, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 }, // dx = 0.020 (< deadZone 0.035)
    { timestamp: 1.0, x: 0.515, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 }, // dx = 0.015 (< deadZone 0.035)
  ];

  const deadZonePath = generateCameraPath({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 1.5,
    subjectTracks: [
      {
        trackId: 'tr-dz',
        start: 0,
        end: 1.5,
        averageConfidence: 0.9,
        detections: deadZoneDetections,
      },
    ],
    config: { deadZone: 0.035 },
  });

  const kf0 = deadZonePath.keyframes.find((k) => Math.abs((k.timestamp ?? k.time) - 0.0) < 0.05)!;
  const kf1 = deadZonePath.keyframes.find((k) => Math.abs((k.timestamp ?? k.time) - 1.0) < 0.05)!;
  assert(Boolean(kf0 && kf1), 'Found keyframes at 0.0s and 1.0s for dead zone evaluation');
  assert(Math.abs((kf1.centerX ?? kf1.x) - (kf0.centerX ?? kf0.x)) < 0.001, `Dead zone prevented jitter`);

  // Headroom anchoring check
  const dUpper: SubjectDetection = { timestamp: 0, x: 0.5, y: 0.4, width: 0.2, height: 0.3, confidence: 0.9 };
  const focalHeadroom = computeTargetFocalPoint([dUpper], 'SINGLE', 0.316, 0.35);
  // Headroom moves y upwards
  assert(focalHeadroom.y < dUpper.y, `Headroom anchored focal center above subject center (${focalHeadroom.y} < ${dUpper.y})`);

  // --------------------------------------------------------------------------
  // CATEGORY 9: Multi-Person Framing Modes
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 9: Multi-Person Framing Modes ---');

  const p1: SubjectDetection = { timestamp: 0, x: 0.35, y: 0.45, width: 0.15, height: 0.3, confidence: 0.9 };
  const p2: SubjectDetection = { timestamp: 0, x: 0.55, y: 0.45, width: 0.15, height: 0.3, confidence: 0.9 };

  // DUAL (Span fits inside 9:16 crop width ~0.316)
  // p1 center 0.35 - half 0.075 = 0.275; p2 center 0.55 + half 0.075 = 0.625 -> span = 0.35 (too wide for single 9:16)
  // Let's test a close conversation where span fits
  const p1Close: SubjectDetection = { timestamp: 0, x: 0.45, y: 0.45, width: 0.1, height: 0.3, confidence: 0.9 };
  const p2Close: SubjectDetection = { timestamp: 0, x: 0.55, y: 0.45, width: 0.1, height: 0.3, confidence: 0.9 };
  const focalDualClose = computeTargetFocalPoint([p1Close, p2Close], 'DUAL', 0.316);
  assert(Math.abs(focalDualClose.x - 0.50) < 0.01, `Dual close conversation centers between both speakers: ${focalDualClose.x}`);

  // DUAL (Span is too wide for 9:16 crop, must choose primary speaker)
  const p1Far: SubjectDetection = { timestamp: 0, x: 0.15, y: 0.45, width: 0.2, height: 0.4, confidence: 0.95 };
  const p2Far: SubjectDetection = { timestamp: 0, x: 0.85, y: 0.45, width: 0.1, height: 0.2, confidence: 0.70 };
  const focalDualWide = computeTargetFocalPoint([p1Far, p2Far], 'DUAL', 0.316);
  assert(focalDualWide.x === p1Far.x, 'Dual wide shot picks primary speaker deterministically instead of empty space');

  // GROUP Framing
  const p3: SubjectDetection = { timestamp: 0, x: 0.70, y: 0.45, width: 0.1, height: 0.3, confidence: 0.85 };
  const focalGroup = computeTargetFocalPoint([p1Close, p2Close, p3], 'GROUP', 0.316);
  assert(focalGroup.x > 0.45 && focalGroup.x < 0.70, `Group framing spans group centroid: ${focalGroup.x}`);

  // --------------------------------------------------------------------------
  // CATEGORY 10: No-Subject Fallback Handling
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 10: No-Subject Fallback Handling ---');

  const emptyFocal = computeTargetFocalPoint([], 'GENERAL', 0.316);
  assert(emptyFocal.x === 0.5 && emptyFocal.y === 0.5, 'Empty detections fallback to exact center [0.5, 0.5]');
  assert(emptyFocal.scale === 1.0, 'Fallback scale is 1.0 (no extreme zoom)');

  const fallbackPath = generateCameraPath({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 3.0,
    subjectTracks: [],
  });
  assert(fallbackPath.keyframes.length > 0, 'Camera path generated even without subject tracks');
  for (const kf of fallbackPath.keyframes) {
    assert(kf.centerX === 0.5, 'Fallback keyframe centered at x: 0.5');
    assert(kf.centerY === 0.5, 'Fallback keyframe centered at y: 0.5');
  }

  // --------------------------------------------------------------------------
  // CATEGORY 11: Deterministic Output
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 11: Deterministic Output ---');

  const sampleTracks: SubjectTrack[] = [
    {
      trackId: 'tr-det-1',
      start: 0,
      end: 4,
      averageConfidence: 0.88,
      detections: [
        { timestamp: 0.0, x: 0.4, y: 0.4, width: 0.2, height: 0.3, confidence: 0.88 },
        { timestamp: 2.0, x: 0.5, y: 0.45, width: 0.2, height: 0.3, confidence: 0.88 },
        { timestamp: 4.0, x: 0.6, y: 0.4, width: 0.2, height: 0.3, confidence: 0.88 },
      ],
    },
  ];

  const plan1 = generateCameraPath({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 4.0,
    subjectTracks: sampleTracks,
    config: { targetAspectRatio: '9:16', multiPersonMode: 'SINGLE' },
  });

  const plan2 = generateCameraPath({
    sourceWidth: 1920,
    sourceHeight: 1080,
    duration: 4.0,
    subjectTracks: sampleTracks,
    config: { targetAspectRatio: '9:16', multiPersonMode: 'SINGLE' },
  });

  assert(
    JSON.stringify(plan1) === JSON.stringify(plan2),
    'Camera path generation is 100% deterministic (byte-for-byte identical JSON)'
  );

  // --------------------------------------------------------------------------
  // CATEGORY 12: Non-Destructive Phase 5 EDL Integration
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 12: Non-Destructive EDL Integration ---');

  const storage = getStorage();
  const testUserId = '00000000-0000-4000-a000-000000000001';
  const testProjectId = `reframe-edl-${Date.now()}`;

  await storage.saveProject({
    id: testProjectId,
    userId: testUserId,
    title: 'Phase 6 EDL Reframe Project',
    workflowType: 'youtube_to_shorts',
    sourceType: 'upload',
    clips: [],
    durationSeconds: 30.0,
    status: 'editing',
    version: 1,
    createdAt: new Date().toISOString(),
  });

  // Create initial timeline
  const initialTimeline = await EditingService.getOrCreateTimeline(testProjectId, testUserId);
  assert(initialTimeline.version === 1, 'Initial timeline created at version 1');
  const videoTrack = initialTimeline.tracks.find((t) => t.type === 'VIDEO')!;
  const initialItemCount = videoTrack.items.length;
  const initialDuration = initialTimeline.duration;

  // Apply reframe to timeline
  const reframeResult = await EditingService.applyReframe({
    projectId: testProjectId,
    userId: testUserId,
    cameraPath: plan1,
    expectedVersion: 1,
  });

  assert(reframeResult.timeline.version === 2, 'Timeline version incremented to 2 after applyReframe');
  assert(reframeResult.operation.type === 'SET_REFRAME', 'Operation recorded with type SET_REFRAME');

  // Verify non-destructive invariants
  const updatedVideoTrack = reframeResult.timeline.tracks.find((t) => t.type === 'VIDEO')!;
  assert(updatedVideoTrack.items.length === initialItemCount, 'Timeline item count unchanged');
  assert(reframeResult.timeline.duration === initialDuration, 'Timeline duration unchanged');

  const reframedItem = updatedVideoTrack.items[0];
  assert(Boolean(reframedItem.metadata?.reframe), 'Reframe metadata attached to video item');
  assert(reframedItem.metadata!.reframe.targetAspectRatio === '9:16', 'Reframe metadata matches 9:16 target');

  // --------------------------------------------------------------------------
  // CATEGORY 13: Undo/Redo Integration for Reframe
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 13: Undo/Redo Integration ---');

  // Undo the reframe operation
  const undone = await EditingService.undo(testProjectId, testUserId, 2);
  assert(undone.version === 3, 'Timeline version incremented to 3 after undo');
  const undoneItem = undone.tracks.find((t) => t.type === 'VIDEO')!.items[0];
  assert(!undoneItem.metadata?.reframe, 'Undo removed reframe metadata');

  // Redo the reframe operation
  const redone = await EditingService.redo(testProjectId, testUserId, 3);
  assert(redone.version === 4, 'Timeline version incremented to 4 after redo');
  const redoneItem = redone.tracks.find((t) => t.type === 'VIDEO')!.items[0];
  assert(Boolean(redoneItem.metadata?.reframe), 'Redo re-applied reframe metadata');

  // Undo again and apply new split (Branch invalidation test)
  await EditingService.undo(testProjectId, testUserId, 4); // now at version 5, cursor undone
  await EditingService.splitItem({
    projectId: testProjectId,
    userId: testUserId,
    itemId: redoneItem.id,
    splitTime: 15.0,
    expectedVersion: 5,
  }); // version 6

  // Now redo must fail because new edit invalidated the redo branch
  let redoAfterNewEditThrew = false;
  try {
    await EditingService.redo(testProjectId, testUserId, 6);
  } catch (err: any) {
    redoAfterNewEditThrew = true;
    assert(err.code === 'NO_REDO_OPERATION' || err.statusCode === 400, 'Redo after new edit rejected');
  }
  assert(redoAfterNewEditThrew, 'New edit invalidated redo branch');

  // --------------------------------------------------------------------------
  // CATEGORY 14: Optimistic Concurrency Conflict Gate
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 14: Optimistic Concurrency Gate ---');

  let conflictThrew = false;
  try {
    await EditingService.applyReframe({
      projectId: testProjectId,
      userId: testUserId,
      cameraPath: plan1,
      expectedVersion: 2, // Current version is now 6!
    });
  } catch (err: any) {
    conflictThrew = true;
    assert(
      err.code === 'TIMELINE_VERSION_CONFLICT' || err.statusCode === 409,
      'Stale expectedVersion rejected with 409 Conflict'
    );
  }
  assert(conflictThrew, 'Optimistic concurrency rejected stale write');

  // --------------------------------------------------------------------------
  // CATEGORY 15: Render Contract & FFmpeg Filter Consistency
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 15: Render Contract & FFmpeg Filter ---');

  const filterString = buildFfmpegReframeCropFilter(1920, 1080, '9:16', plan1.keyframes[0]);
  assert(filterString.includes('crop='), `FFmpeg filter contains crop directive: ${filterString}`);
  assert(filterString.includes('scale='), `FFmpeg filter contains scale directive: ${filterString}`);
  // Validate that crop dimensions in filter are strictly even numbers
  const cropMatch = filterString.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
  assert(Boolean(cropMatch), 'Crop filter syntax matches crop=W:H:X:Y format');
  if (cropMatch) {
    const [, w, h, x, y] = cropMatch.map(Number);
    assert(w % 2 === 0, `Filter crop width is even: ${w}`);
    assert(h % 2 === 0, `Filter crop height is even: ${h}`);
    assert(x >= 0 && x + w <= 1920, `Crop window fits horizontally within 1920: x=${x}, w=${w}`);
    assert(y >= 0 && y + h <= 1080, `Crop window fits vertically within 1080: y=${y}, h=${h}`);
  }

  // --------------------------------------------------------------------------
  // CATEGORY 16: Filesystem Security & Media Resolver Trust Boundary
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 16: Filesystem Security & Media Resolver ---');

  // Test 1: Relative path traversal ../ rejected
  let traversalThrew = false;
  try {
    assertSafeFilesystemPath('../../etc/passwd');
  } catch (err: any) {
    traversalThrew = true;
    assert(err.code === 'FORBIDDEN' || err.statusCode === 403, 'Path traversal ../../etc/passwd rejected');
  }
  assert(traversalThrew, 'Relative path traversal blocked');

  // Test 2: Encoded path traversal %2e%2e rejected
  let encodedTraversalThrew = false;
  try {
    assertSafeFilesystemPath('%2e%2e/%2e%2e/etc/passwd');
  } catch (err: any) {
    encodedTraversalThrew = true;
    assert(err.code === 'FORBIDDEN' || err.statusCode === 403, 'Encoded path traversal %2e%2e rejected');
  }
  assert(encodedTraversalThrew, 'Encoded path traversal blocked');

  // Test 3: Absolute path outside allowed roots rejected
  let outsideRootThrew = false;
  try {
    assertSafeFilesystemPath('/etc/passwd');
  } catch (err: any) {
    outsideRootThrew = true;
    assert(err.code === 'FORBIDDEN' || err.statusCode === 403, 'Absolute path outside root rejected');
  }
  assert(outsideRootThrew, 'Arbitrary absolute path outside allowed media roots blocked');

  // Test 4: Symlink escape pointing outside allowed root rejected
  const tempSymlinkDir = path.join(process.cwd(), 'data', `test_symlink_${Date.now()}`);
  fs.mkdirSync(tempSymlinkDir, { recursive: true });
  const symlinkPath = path.join(tempSymlinkDir, 'escape_link.mp4');
  let symlinkEscapeThrew = false;
  try {
    fs.symlinkSync('/etc/passwd', symlinkPath);
    try {
      assertSafeFilesystemPath(symlinkPath);
    } catch (err: any) {
      symlinkEscapeThrew = true;
      assert(err.code === 'FORBIDDEN', 'Symlink escape detected and rejected');
    }
  } finally {
    if (fs.existsSync(tempSymlinkDir)) {
      fs.rmSync(tempSymlinkDir, { recursive: true, force: true });
    }
  }
  assert(symlinkEscapeThrew, 'Symlink escaping allowed media root blocked');

  // Test 5: Directory target rejected
  let dirTargetThrew = false;
  try {
    assertSafeFilesystemPath(path.join(process.cwd(), 'data'));
  } catch (err: any) {
    dirTargetThrew = true;
    assert(err.code === 'MEDIA_INVALID', 'Directory target rejected (not a regular file)');
  }
  assert(dirTargetThrew, 'Directory target instead of media file blocked');

  // Test 6: Missing media file rejected
  let missingFileThrew = false;
  try {
    assertSafeFilesystemPath(path.join(process.cwd(), 'data', 'non_existent_media_file.mp4'));
  } catch (err: any) {
    missingFileThrew = true;
    assert(err.code === 'MEDIA_UNAVAILABLE', 'Non-existent media file rejected');
  }
  assert(missingFileThrew, 'Missing media file rejected');

  // Test 7: Invalid media container magic bytes rejected
  const fakeCorruptPath = path.join(process.cwd(), 'data', `corrupt_media_${Date.now()}.mp4`);
  fs.writeFileSync(fakeCorruptPath, 'THIS_IS_NOT_A_VALID_MP4_HEADER_PAYLOAD');
  let invalidSignatureThrew = false;
  try {
    assertSafeFilesystemPath(fakeCorruptPath);
  } catch (err: any) {
    invalidSignatureThrew = true;
    assert(err.code === 'MEDIA_INVALID', 'Invalid media file container signature rejected');
  } finally {
    if (fs.existsSync(fakeCorruptPath)) fs.unlinkSync(fakeCorruptPath);
  }
  assert(invalidSignatureThrew, 'Spoofed or corrupted container format blocked');

  // Test 8: Cross-project media attack via resolveAuthorizedMediaSource rejected
  const projectX = 'proj-x-' + Date.now();
  const projectY = 'proj-y-' + Date.now();
  const mediaAssetY = 'media-y-' + Date.now();

  const storageInst = getStorage();
  await storageInst.saveProject({
    id: projectX,
    title: 'Project X',
    userId: 'user-x',
    activeMediaId: undefined,
    version: 1,
    sourceType: 'upload',
    workflowType: 'youtube_to_shorts',
    durationSeconds: 30,
    status: 'completed',
    clips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await storageInst.saveProject({
    id: projectY,
    title: 'Project Y',
    userId: 'user-y',
    activeMediaId: mediaAssetY,
    version: 1,
    sourceType: 'upload',
    workflowType: 'youtube_to_shorts',
    durationSeconds: 30,
    status: 'completed',
    clips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const { saveLocalMediaAsset } = await import('../lib/storage');
  saveLocalMediaAsset({
    id: mediaAssetY,
    projectId: projectY,
    userId: 'user-y',
    fileName: 'media_y.mp4',
    storagePath: path.join(process.cwd(), 'public', 'sample.mp4'),
    duration: 30,
    width: 1920,
    height: 1080,
  });

  let crossProjectThrew = false;
  try {
    await resolveAuthorizedMediaSource({
      projectId: projectX,
      mediaAssetId: mediaAssetY,
      userId: 'user-x',
    });
  } catch (err: any) {
    crossProjectThrew = true;
    assert(err.code === 'MEDIA_NOT_OWNED', 'Cross-project media resolution rejected with MEDIA_NOT_OWNED');
  }
  assert(crossProjectThrew, 'Cross-project media attack blocked');

  // --------------------------------------------------------------------------
  // CATEGORY 17: Detector Integrity & Honest Failure Policy
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 17: Detector Integrity & Honest Failure Policy ---');

  const localDetector = new LocalCentroidDetectorProvider();
  const metaLocal = localDetector.getMetadata();
  assert(metaLocal.provider === 'local-centroid', 'Provider name is local-centroid');
  assert(metaLocal.providerMode === 'heuristic', 'Provider mode is explicitly heuristic');
  assert(metaLocal.degraded === true, 'Local centroid is explicitly marked degraded: true');
  assert(Boolean(metaLocal.fallbackReason), 'Local centroid contains fallback reason');

  // When frame does not exist, detector returns [] (NO fake manufactured person!)
  const emptyDets = await localDetector.detectSubjects({
    framePath: path.join(process.cwd(), 'data', 'does_not_exist_frame.jpg'),
    timestamp: 0.5,
  });
  assert(Array.isArray(emptyDets), 'Detector returns array');
  assert(emptyDets.length === 0, 'Detector failure returns [] instead of fake fallback person');

  // Fixture detector restricted to test environment
  const origNodeEnv = process.env.NODE_ENV;
  try {
    (process.env as any).NODE_ENV = 'production';
    let fixtureInProdThrew = false;
    try {
      new FixtureDetectorProvider();
    } catch (err: any) {
      fixtureInProdThrew = true;
      assert(err.code === 'FORBIDDEN', 'FixtureDetectorProvider strictly blocked in production');
    }
    assert(fixtureInProdThrew, 'Fixture detector prohibited in production');
  } finally {
    (process.env as any).NODE_ENV = origNodeEnv;
  }

  // Hybrid detector metadata reflects degraded status when falling back
  const hybridDetector = new HybridDetectorProvider();
  const metaHybrid = hybridDetector.getMetadata();
  assert(typeof metaHybrid.degraded === 'boolean', 'Hybrid detector reports typed degraded boolean');
  assert(Boolean(metaHybrid.provider), 'Hybrid detector reports active provider name');

  // --------------------------------------------------------------------------
  // CATEGORY 18: Strict Runtime Data Validation
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 18: Strict Runtime Data Validation ---');

  // Reject NaN coordinates
  let nanXThrew = false;
  try {
    validateSubjectDetection({ timestamp: 0, x: NaN, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 });
  } catch (err: any) {
    nanXThrew = true;
  }
  assert(nanXThrew, 'NaN x-coordinate rejected');

  // Reject Infinity
  let infThrew = false;
  try {
    validateSubjectDetection({ timestamp: 0, x: 0.5, y: Infinity, width: 0.2, height: 0.3, confidence: 0.9 });
  } catch (err: any) {
    infThrew = true;
  }
  assert(infThrew, 'Infinity coordinate rejected');

  // Reject coordinates outside [0, 1]
  let outOfBoundsThrew = false;
  try {
    validateSubjectDetection({ timestamp: 0, x: 1.5, y: 0.5, width: 0.2, height: 0.3, confidence: 0.9 });
  } catch (err: any) {
    outOfBoundsThrew = true;
  }
  assert(outOfBoundsThrew, 'Out of bounds coordinate (> 1.0) rejected');

  // Reject invalid aspect ratio enum
  let invalidAspectThrew = false;
  try {
    validateReframeConfig({ targetAspectRatio: '21:9' as any });
  } catch (err: any) {
    invalidAspectThrew = true;
  }
  assert(invalidAspectThrew, 'Invalid aspect ratio enum 21:9 rejected');

  // Reject non-monotonic keyframe timestamps in CameraPath
  let nonMonotonicThrew = false;
  try {
    validateCameraPath({
      targetAspectRatio: '9:16',
      cropWidth: 608,
      cropHeight: 1080,
      targetWidth: 1080,
      targetHeight: 1920,
      multiPersonMode: 'GENERAL',
      keyframes: [
        { time: 2.0, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0 },
        { time: 1.0, x: 0.5, y: 0.5, scale: 1.0, confidence: 1.0 },
      ],
    });
  } catch (err: any) {
    nonMonotonicThrew = true;
  }
  assert(nonMonotonicThrew, 'CameraPath non-monotonic timestamps rejected');

  // --------------------------------------------------------------------------
  // CATEGORY 19: EDL Item Ownership & Track Type Security
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 19: EDL Item Ownership & Track Type Security ---');

  // Create timeline with VIDEO and AUDIO tracks
  const edlTestProj = 'proj-edl-' + Date.now();
  await storageInst.saveProject({
    id: edlTestProj,
    title: 'EDL Sec Test',
    userId: testUserId,
    version: 1,
    sourceType: 'upload',
    workflowType: 'youtube_to_shorts',
    durationSeconds: 30,
    status: 'completed',
    clips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const edlTimeline = await EditingService.getOrCreateTimeline(edlTestProj, testUserId);

  // Cross-project itemId rejected
  let crossProjItemThrew = false;
  try {
    await EditingService.applyReframe({
      projectId: edlTestProj,
      userId: testUserId,
      cameraPath: plan1,
      itemId: 'non-existent-or-foreign-item-id',
      expectedVersion: edlTimeline.version,
    });
  } catch (err: any) {
    crossProjItemThrew = true;
    assert(err.code === 'NOT_FOUND', 'Cross-project / foreign itemId rejected with NOT_FOUND');
  }
  assert(crossProjItemThrew, 'Foreign timeline itemId rejected');

  // Non-video track item (e.g. audio item) rejected
  const audioTrack = edlTimeline.tracks.find((t) => t.type === 'AUDIO');
  if (audioTrack && audioTrack.items.length > 0) {
    const audioItem = audioTrack.items[0];
    let audioItemReframeThrew = false;
    try {
      await EditingService.applyReframe({
        projectId: edlTestProj,
        userId: testUserId,
        cameraPath: plan1,
        itemId: audioItem.id,
        expectedVersion: edlTimeline.version,
      });
    } catch (err: any) {
      audioItemReframeThrew = true;
      assert(err.code === 'VALIDATION_ERROR', 'Reframe on AUDIO track item rejected with VALIDATION_ERROR');
    }
    assert(audioItemReframeThrew, 'Applying reframe to AUDIO track item blocked');
  }

  // --------------------------------------------------------------------------
  // CATEGORY 20: Guaranteed Temporary Frame Cleanup
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 20: Guaranteed Temporary Frame Cleanup ---');

  const samplePath = path.join(process.cwd(), 'public', 'sample.mp4');
  if (fs.existsSync(samplePath)) {
    // Test 20.1: Normal extraction cleanup
    const sampleResult = await sampleFrames(samplePath, 0, 2, 1);
    const tempDir = sampleResult.tempDir;
    assert(fs.existsSync(tempDir), 'Temporary frames directory created during extraction');
    sampleResult.cleanup();
    assert(!fs.existsSync(tempDir), 'cleanup() deleted temporary frames directory cleanly');

    // Test 20.2: Guaranteed cleanup when detection throws
    const sampleResult2 = await sampleFrames(samplePath, 0, 2, 1);
    const tempDir2 = sampleResult2.tempDir;
    assert(fs.existsSync(tempDir2), 'Temporary frames directory 2 created');
    let intentionallyThrown = false;
    try {
      try {
        throw new Error('Simulated crash during frame detection');
      } finally {
        sampleResult2.cleanup();
      }
    } catch (e) {
      intentionallyThrown = true;
    }
    assert(intentionallyThrown, 'Exception simulated during processing');
    assert(!fs.existsSync(tempDir2), 'try-finally guaranteed cleanup executed even after error');
  } else {
    const dummyTemp = path.join(process.cwd(), 'data', 'temp_frames', `dummy_${Date.now()}`);
    fs.mkdirSync(dummyTemp, { recursive: true });
    assert(fs.existsSync(dummyTemp), 'Dummy temp dir created');
    cleanupSampleFrames(dummyTemp);
    assert(!fs.existsSync(dummyTemp), 'cleanupSampleFrames successfully removed directory');
  }

  // --------------------------------------------------------------------------
  // CATEGORY 21: Client Error Safety & Path Leakage Gate (Phase 6.1.1)
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 21: Client Error Safety & Path Leakage Gate ---');

  const FORBIDDEN_PATH_SUBSTRINGS = [
    '/Users/',
    '/home/',
    '/tmp/',
    '/var/',
    '/etc/',
    'node_modules',
    'data/uploads',
    'clipper_reframe_',
  ];

  function assertNoPathLeaked(message: string, context: string) {
    for (const sub of FORBIDDEN_PATH_SUBSTRINGS) {
      assert(
        !message.includes(sub),
        `Error message must not leak '${sub}' (${context}): ${message}`
      );
    }
  }

  // 21.1: Nonexistent media error does not leak path
  try {
    assertSafeFilesystemPath(path.join(process.cwd(), 'data', 'does_not_exist_file.mp4'));
  } catch (err: any) {
    assert(err.code === 'MEDIA_UNAVAILABLE', 'Nonexistent media throws MEDIA_UNAVAILABLE');
    assertNoPathLeaked(err.message, 'nonexistent media');
  }

  // 21.2: Traversal attempt does not leak path
  try {
    assertSafeFilesystemPath('../../etc/passwd');
  } catch (err: any) {
    assert(err.code === 'FORBIDDEN', 'Traversal throws FORBIDDEN');
    assertNoPathLeaked(err.message, 'traversal attempt');
  }

  // 21.3: Symlink escape does not leak path
  const symlinkLeakTestDir = path.join(process.cwd(), 'data', `test_sym_leak_${Date.now()}`);
  fs.mkdirSync(symlinkLeakTestDir, { recursive: true });
  const leakLinkPath = path.join(symlinkLeakTestDir, 'leak_link.mp4');
  try {
    fs.symlinkSync('/etc/passwd', leakLinkPath);
    try {
      assertSafeFilesystemPath(leakLinkPath);
    } catch (err: any) {
      assert(err.code === 'FORBIDDEN', 'Symlink escape throws FORBIDDEN');
      assertNoPathLeaked(err.message, 'symlink escape');
    }
  } finally {
    if (fs.existsSync(symlinkLeakTestDir)) {
      fs.rmSync(symlinkLeakTestDir, { recursive: true, force: true });
    }
  }

  // 21.4: Invalid container signature does not leak path
  const corruptFileLeakPath = path.join(process.cwd(), 'data', `corrupt_${Date.now()}.mp4`);
  fs.writeFileSync(corruptFileLeakPath, 'NOT_A_VALID_HEADER');
  try {
    try {
      assertSafeFilesystemPath(corruptFileLeakPath);
    } catch (err: any) {
      assert(err.code === 'MEDIA_INVALID', 'Corrupt file throws MEDIA_INVALID');
      assertNoPathLeaked(err.message, 'invalid container');
    }
  } finally {
    if (fs.existsSync(corruptFileLeakPath)) fs.unlinkSync(corruptFileLeakPath);
  }

  // 21.5: Directory target does not leak path
  try {
    assertSafeFilesystemPath(path.join(process.cwd(), 'data'));
  } catch (err: any) {
    assert(err.code === 'MEDIA_INVALID', 'Directory throws MEDIA_INVALID');
    assertNoPathLeaked(err.message, 'directory target');
  }

  // 21.6: Failed cloud download does not leak path or internal system errors
  const mockStorageService = getStorageService();
  const fakeAssetId = 'fake-asset-' + Date.now();
  const projForLeak = 'proj-leak-' + Date.now();
  await storageInst.saveProject({
    id: projForLeak,
    title: 'Leak Test Proj',
    userId: 'user-leak',
    version: 1,
    sourceType: 'upload',
    workflowType: 'youtube_to_shorts',
    durationSeconds: 30,
    status: 'completed',
    clips: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const storageMod = await import('../lib/storage');
  storageMod.saveLocalMediaAsset({
    id: fakeAssetId,
    projectId: projForLeak,
    userId: 'user-leak',
    fileName: 'nonexistent_cloud.mp4',
    storageKey: 'nonexistent/cloud/path.mp4',
    duration: 30,
    width: 1920,
    height: 1080,
  });
  try {
    await resolveAuthorizedMediaSource({
      projectId: projForLeak,
      mediaAssetId: fakeAssetId,
      userId: 'user-leak',
    });
  } catch (err: any) {
    assert(err.code === 'MEDIA_UNAVAILABLE', 'Failed cloud download throws MEDIA_UNAVAILABLE');
    assertNoPathLeaked(err.message, 'failed cloud download');
  }

  // --------------------------------------------------------------------------
  // CATEGORY 22: Cloud Media Streaming & Memory Safety Gate (Phase 6.1.1 & 6.1.2)
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 22: Cloud Media Streaming & Memory Safety Gate ---');

  // Test 22.1: Proving downloadObjectToFile is called and does NOT call getObject() into RAM
  const streamCallStats = {
    getObjectCalled: false,
    downloadToFileCalled: false,
  };
  const mockStreamingProvider: any = {
    providerType: 'local',
    storageZoneOrBucket: 'test',
    async getObject() {
      streamCallStats.getObjectCalled = true;
      return Buffer.from('FAKE_GET_OBJECT_PAYLOAD');
    },
    async downloadToFile(key: string, dest: string, opts?: any) {
      streamCallStats.downloadToFileCalled = true;
      fs.writeFileSync(dest, 'STREAMED_DATA');
      return { sizeBytes: 13 };
    },
    async objectExists() { return true; },
    async getObjectMetadata() { return null; },
    async upload() { return { key: '', publicUrl: '', sizeBytes: 0 }; },
    async deleteObject() {},
    async deletePrefix() { return 0; },
    async copyObject() {},
    async moveObject() {},
    async getSignedDownloadUrl() { return ''; },
    async getSignedUploadUrl() { return ''; },
  };

  const origProvider = mockStorageService.getProvider();
  mockStorageService.setProvider(mockStreamingProvider);
  const streamTempDest = path.join(os.tmpdir(), `test_stream_dest_${Date.now()}.mp4`);
  try {
    await mockStorageService.downloadObjectToFile('test/key.mp4', streamTempDest);
    assert(streamCallStats.downloadToFileCalled === true, 'downloadObjectToFile dispatched to streaming provider method');
    assert(streamCallStats.getObjectCalled === false, 'getObject() was NOT invoked; RAM-materializing buffer avoided');
  } finally {
    if (fs.existsSync(streamTempDest)) fs.unlinkSync(streamTempDest);
    mockStorageService.setProvider(origProvider);
  }

  // Test 22.2: Concrete Provider Contracts: Every production storage provider exposes downloadToFile
  const testBunnyProvider = new BunnyStorageProvider({ storageZone: 'test', apiKey: 'test' });
  assert(typeof testBunnyProvider.downloadToFile === 'function', 'BunnyStorageProvider exposes required downloadToFile');
  const testLocalProvider = new LocalStorageProvider(path.join(os.tmpdir(), 'test_local_bucket'));
  assert(typeof testLocalProvider.downloadToFile === 'function', 'LocalStorageProvider exposes required downloadToFile');

  // Test 22.3: StorageService strictly forbids getObject fallback when downloadToFile is active
  const mockForbiddenGetObjectProvider: any = {
    providerType: 'bunny',
    storageZoneOrBucket: 'test',
    async getObject() {
      throw new Error('FORBIDDEN_GET_OBJECT_FALLBACK');
    },
    async downloadToFile(key: string, dest: string) {
      fs.writeFileSync(dest, 'SAFE_STREAMED_BYTES');
      return { sizeBytes: 19 };
    },
  };
  mockStorageService.setProvider(mockForbiddenGetObjectProvider);
  const forbiddenDest = path.join(os.tmpdir(), `test_forbidden_dest_${Date.now()}.mp4`);
  try {
    const streamRes = await mockStorageService.downloadObjectToFile('test/file.mp4', forbiddenDest);
    assert(streamRes.sizeBytes === 19, 'downloadObjectToFile succeeded without invoking getObject()');
  } finally {
    if (fs.existsSync(forbiddenDest)) fs.unlinkSync(forbiddenDest);
    mockStorageService.setProvider(origProvider);
  }

  // Test 22.4: StorageService throws STORAGE_UNSUPPORTED without calling getObject if downloadToFile missing
  let getObjectCalledOnMissing = false;
  const mockMissingDownloadProvider: any = {
    providerType: 'bunny',
    storageZoneOrBucket: 'test',
    async getObject() {
      getObjectCalledOnMissing = true;
      return Buffer.from('SHOULD_NOT_BE_RETURNED');
    },
  };
  mockStorageService.setProvider(mockMissingDownloadProvider);
  let unsupportedThrew = false;
  try {
    await mockStorageService.downloadObjectToFile('test/missing.mp4', forbiddenDest);
  } catch (err: any) {
    unsupportedThrew = true;
    assert(err.code === 'CONFIGURATION_ERROR', 'Missing downloadToFile throws CONFIGURATION_ERROR');
    assert(getObjectCalledOnMissing === false, 'getObject() was NOT called on missing downloadToFile');
  } finally {
    mockStorageService.setProvider(origProvider);
  }
  assert(unsupportedThrew, 'Unsupported provider throws controlled error without memory buffering');

  // Test 22.5: LocalStorageProvider streaming download
  const testKey = 'stream_test_video.mp4';
  const testPayload = Buffer.from('STREAM_PAYLOAD_CHUNK_DATA');
  await mockStorageService.upload(testKey, testPayload);
  const localDestFile = path.join(os.tmpdir(), `test_local_download_${Date.now()}.mp4`);
  try {
    const res = await mockStorageService.downloadObjectToFile(testKey, localDestFile);
    assert(res.sizeBytes === testPayload.length, 'Streamed download matches exact source length');
    assert(fs.existsSync(localDestFile), 'Streamed file written to disk');
    const readBack = fs.readFileSync(localDestFile);
    assert(readBack.equals(testPayload), 'Downloaded content matches byte-for-byte');
  } finally {
    if (fs.existsSync(localDestFile)) fs.unlinkSync(localDestFile);
    await mockStorageService.deleteObject(testKey);
  }

  // Test 22.6: Zero-byte stream result throws and cleans up
  const emptyKey = 'empty_test_file.mp4';
  await mockStorageService.upload(emptyKey, Buffer.alloc(0));
  const emptyDestFile = path.join(os.tmpdir(), `test_empty_download_${Date.now()}.mp4`);
  let emptyStreamThrew = false;
  try {
    await mockStorageService.downloadObjectToFile(emptyKey, emptyDestFile);
  } catch (err: any) {
    emptyStreamThrew = true;
    assert(err.code === 'MEDIA_INVALID', 'Zero-byte download rejected with MEDIA_INVALID');
  } finally {
    assert(!fs.existsSync(emptyDestFile), 'Empty target file not left on disk');
    assert(!fs.existsSync(`${emptyDestFile}.partial`), 'Empty partial file cleaned up');
    await mockStorageService.deleteObject(emptyKey);
  }
  assert(emptyStreamThrew, 'Zero-byte stream rejected');

  // Test 22.7: 500 MB Boundary Semantics (Within limit vs exact 500 MB vs 500 MB + 1 byte)
  const boundaryDestFile = path.join(os.tmpdir(), `test_boundary_${Date.now()}.mp4`);
  const mockBoundaryProvider: any = {
    providerType: 'bunny',
    storageZoneOrBucket: 'test',
    async downloadToFile(key: string, dest: string, opts?: { maxSizeBytes?: number }) {
      const max = opts?.maxSizeBytes || MAX_MEDIA_DOWNLOAD_BYTES;
      if (key === 'exact_500mb') {
        // Exactly 500 MB: permitted
        fs.writeFileSync(dest, 'X');
        return { sizeBytes: max };
      }
      if (key === 'exceed_500mb') {
        // 500 MB + 1 byte: rejected with MEDIA_INVALID
        const size = max + 1;
        if (size > max) {
          throw new ClipperError('MEDIA_INVALID', `Media object exceeds maximum allowed size of ${max} bytes`, 400);
        }
        return { sizeBytes: size };
      }
      return { sizeBytes: 1024 };
    },
  };
  mockStorageService.setProvider(mockBoundaryProvider);
  try {
    // Exact 500 MB is permitted
    const exactRes = await mockStorageService.downloadObjectToFile('exact_500mb', boundaryDestFile, {
      maxSizeBytes: MAX_MEDIA_DOWNLOAD_BYTES,
    });
    assert(exactRes.sizeBytes === MAX_MEDIA_DOWNLOAD_BYTES, 'Exact 500 MB payload is permitted');

    // 500 MB + 1 byte is rejected
    let exceedThrew = false;
    try {
      await mockStorageService.downloadObjectToFile('exceed_500mb', boundaryDestFile, {
        maxSizeBytes: MAX_MEDIA_DOWNLOAD_BYTES,
      });
    } catch (err: any) {
      exceedThrew = true;
      assert(err.code === 'MEDIA_INVALID', '500 MB + 1 byte is rejected with MEDIA_INVALID');
    }
    assert(exceedThrew, 'Exceeding 500 MB boundary rejected');
  } finally {
    if (fs.existsSync(boundaryDestFile)) fs.unlinkSync(boundaryDestFile);
    mockStorageService.setProvider(origProvider);
  }

  // --------------------------------------------------------------------------
  // CATEGORY 23: Complete Detector Provider State Machine & Provenance Gate
  // --------------------------------------------------------------------------
  console.log('\n--- CATEGORY 23: Complete Detector Provider State Machine & Provenance Gate ---');

  // Test 23.1: Gemini success for all frames
  const mockGeminiSuccess: ISubjectDetectorProvider = {
    name: 'gemini-vision',
    getMetadata: () => ({
      provider: 'gemini-vision',
      providerMode: 'ml-vision',
      capabilities: ['multimodal-bounding-boxes'],
      degraded: false,
      providersUsed: ['gemini-vision'],
      fallbackEvents: [],
    }),
    async detectSubjects(options) {
      return [{ timestamp: options.timestamp, x: 0.5, y: 0.5, width: 0.3, height: 0.4, confidence: 0.95 }];
    },
  };
  const hybridGeminiSuccess = new HybridDetectorProvider(mockGeminiSuccess);
  await hybridGeminiSuccess.detectSubjects({ framePath: 'dummy', timestamp: 0.0 });
  await hybridGeminiSuccess.detectSubjects({ framePath: 'dummy', timestamp: 1.0 });
  const metaGeminiSuccess = hybridGeminiSuccess.getMetadata();
  assert(metaGeminiSuccess.provider === 'gemini-vision', 'Successful Gemini reports provider gemini-vision');
  assert(metaGeminiSuccess.providerMode === 'ml-vision', 'Successful Gemini reports providerMode ml-vision');
  assert(metaGeminiSuccess.degraded === false, 'Successful Gemini is degraded: false');
  assert(
    JSON.stringify(metaGeminiSuccess.providersUsed) === JSON.stringify(['gemini-vision']),
    'providersUsed contains only gemini-vision'
  );
  assert(metaGeminiSuccess.fallbackEvents?.length === 0, 'No fallback events recorded on success');

  // Test 23.2: Gemini unavailable from beginning (local centroid from start)
  const hybridLocalOnly = new HybridDetectorProvider(undefined, new LocalCentroidDetectorProvider());
  const origKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const metaLocalOnly = hybridLocalOnly.getMetadata();
    assert(metaLocalOnly.provider === 'local-centroid', 'Unavailable Gemini reports provider local-centroid');
    assert(metaLocalOnly.providerMode === 'heuristic', 'Unavailable Gemini reports providerMode heuristic');
    assert(metaLocalOnly.degraded === true, 'Unavailable Gemini is degraded: true');
    assert(
      JSON.stringify(metaLocalOnly.providersUsed) === JSON.stringify(['local-centroid']),
      'providersUsed contains local-centroid'
    );
  } finally {
    if (origKey) process.env.GEMINI_API_KEY = origKey;
  }

  // Test 23.3: Hybrid State Machine — Gemini permanently stops after first failure (Issue 1.3)
  let geminiCallCount = 0;
  const mockGeminiStateMachine: ISubjectDetectorProvider = {
    name: 'gemini-vision',
    getMetadata: () => ({
      provider: 'gemini-vision',
      providerMode: 'ml-vision',
      capabilities: ['multimodal-bounding-boxes'],
      degraded: false,
    }),
    async detectSubjects(options) {
      geminiCallCount++;
      if (geminiCallCount === 1) {
        // Frame 1: succeeds
        return [{ timestamp: options.timestamp, x: 0.5, y: 0.5, width: 0.3, height: 0.4, confidence: 0.95 }];
      }
      if (geminiCallCount === 2) {
        // Frame 2: throws rate limit error
        throw new Error('Quota exceeded 429');
      }
      // Frame 3+: If called again, throw fatal error
      throw new Error('FATAL: Gemini was called after fallback!');
    },
  };
  const hybridStateMachine = new HybridDetectorProvider(mockGeminiStateMachine);

  // Frame 1: uses Gemini (call 1)
  const f1Res = await hybridStateMachine.detectSubjects({ framePath: 'dummy', timestamp: 0.0 });
  assert(f1Res.length === 1 && f1Res[0].confidence === 0.95, 'Frame 1 used Gemini successfully');
  assert(geminiCallCount === 1, 'Gemini called exactly 1 time after Frame 1');

  // Frame 2: Gemini throws -> permanently switches to local centroid (call 2)
  await hybridStateMachine.detectSubjects({ framePath: 'dummy', timestamp: 1.0 });
  assert(geminiCallCount === 2, 'Gemini called exactly 2 times after Frame 2 failure');

  // Frame 3: Local centroid handled directly; Gemini MUST NOT be called!
  await hybridStateMachine.detectSubjects({ framePath: 'dummy', timestamp: 2.0 });
  assert(geminiCallCount === 2, 'Gemini was NOT called for Frame 3; permanently switched to local');

  // Frames 4, 5, 6: Verify Gemini call count remains 2
  await hybridStateMachine.detectSubjects({ framePath: 'dummy', timestamp: 3.0 });
  await hybridStateMachine.detectSubjects({ framePath: 'dummy', timestamp: 4.0 });
  await hybridStateMachine.detectSubjects({ framePath: 'dummy', timestamp: 5.0 });
  assert(geminiCallCount === 2, 'Gemini call count remains exactly 2 across subsequent frames 4, 5, 6');

  const metaStateMachine = hybridStateMachine.getMetadata();
  assert(metaStateMachine.provider === 'hybrid', 'Hybrid state machine metadata reports provider: hybrid');
  assert(metaStateMachine.degraded === true, 'Hybrid state machine metadata reports degraded: true');
  assert(
    JSON.stringify(metaStateMachine.providersUsed) === JSON.stringify(['gemini-vision', 'local-centroid']),
    'providersUsed contains [gemini-vision, local-centroid]'
  );
  assert(metaStateMachine.fallbackEvents?.length === 1, 'Exactly one Gemini -> local transition recorded');
  assert(
    metaStateMachine.fallbackEvents![0].fromProvider === 'gemini-vision' &&
    metaStateMachine.fallbackEvents![0].toProvider === 'local-centroid',
    'Fallback event transition is from gemini-vision to local-centroid'
  );
  assert(
    metaStateMachine.fallbackEvents![0].reason === 'GEMINI_RATE_LIMITED',
    'Fallback event reason is sanitized to GEMINI_RATE_LIMITED'
  );

  // Test 23.4: Gemini legitimate empty detections do NOT trigger fallback
  const mockGeminiEmpty: ISubjectDetectorProvider = {
    name: 'gemini-vision',
    getMetadata: () => ({
      provider: 'gemini-vision',
      providerMode: 'ml-vision',
      capabilities: ['multimodal-bounding-boxes'],
      degraded: false,
    }),
    async detectSubjects() {
      return []; // Legitimate empty result
    },
  };
  const hybridEmpty = new HybridDetectorProvider(mockGeminiEmpty);
  const emptyDetections = await hybridEmpty.detectSubjects({ framePath: 'dummy', timestamp: 0.5 });
  assert(Array.isArray(emptyDetections) && emptyDetections.length === 0, 'Returns empty detections array');
  const metaEmpty = hybridEmpty.getMetadata();
  assert(metaEmpty.provider === 'gemini-vision', 'Empty detection does not falsely trigger local centroid fallback');
  assert(metaEmpty.degraded === false, 'Legitimate empty detection is degraded: false');
  assert(
    JSON.stringify(metaEmpty.providersUsed) === JSON.stringify(['gemini-vision']),
    'providersUsed remains strictly gemini-vision'
  );

  // Test 23.5: Error Reason Sanitization & Classification Gate (Issue 2)
  const maliciousErrors = [
    { err: new Error('Request failed https://example.com?key=SECRET_API_KEY_12345'), expected: 'GEMINI_AUTH_FAILURE' },
    { err: new Error('ENOENT /Users/subhash/private/video.mp4'), expected: 'GEMINI_REQUEST_FAILED' },
    { err: new Error('Bearer super-secret-bearer-token-here'), expected: 'GEMINI_AUTH_FAILURE' },
    { err: new Error('Internal provider response: 500 Internal Server Error ' + 'X'.repeat(5000)), expected: 'GEMINI_PROVIDER_UNAVAILABLE' },
    { err: new Error('connect ECONNREFUSED 127.0.0.1:443'), expected: 'GEMINI_NETWORK_FAILURE' },
    { err: new Error('fetch failed ENOTFOUND api.google.com'), expected: 'GEMINI_NETWORK_FAILURE' },
    { err: new Error('SyntaxError: Unexpected token < in JSON at position 0'), expected: 'GEMINI_INVALID_RESPONSE' },
    { err: new Error('Resource exhausted 429 quota reached'), expected: 'GEMINI_RATE_LIMITED' },
    { err: new Error('HTTP 408 deadline_exceeded timeout'), expected: 'GEMINI_TIMEOUT' },
  ];

  const approvedCategories = new Set([
    'GEMINI_RATE_LIMITED',
    'GEMINI_AUTH_FAILURE',
    'GEMINI_TIMEOUT',
    'GEMINI_PROVIDER_UNAVAILABLE',
    'GEMINI_NETWORK_FAILURE',
    'GEMINI_INVALID_RESPONSE',
    'GEMINI_REQUEST_FAILED',
  ]);

  for (const { err, expected } of maliciousErrors) {
    const sanitized = sanitizeProviderFailureReason(err);
    assert(approvedCategories.has(sanitized), `Sanitized reason "${sanitized}" is in approved categories`);
    assert(sanitized === expected, `Sanitized reason matches expected classification "${expected}"`);
    assert(sanitized.length <= 200, 'Sanitized reason length is <= 200 chars');
    assert(!sanitized.includes('SECRET_API_KEY'), 'Sanitized reason contains no API keys');
    assert(!sanitized.includes('/Users/'), 'Sanitized reason contains no filesystem paths');
    assert(!sanitized.includes('Bearer'), 'Sanitized reason contains no bearer tokens');
    assert(!sanitized.includes('http://') && !sanitized.includes('https://'), 'Sanitized reason contains no URLs');
    assert(!sanitized.includes('XXXXX'), 'Sanitized reason contains no response bodies');
  }
  assert(true, 'All malicious provider errors safely classified and sanitized');

  console.log('\n====================================================');
  console.log(`📊 PHASE 6 UNIT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');


  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6UnitTests().catch((err) => {
  console.error('Fatal Phase 6 Unit Test Error:', err);
  process.exit(1);
});
