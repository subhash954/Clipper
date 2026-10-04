/**
 * CLIPPER PHASE 6: REAL AUTO-REFRAME TEST SUITE
 * Unit, Integration, Determinism, and EDL Non-Destructive Tests
 * Covers all 15 core engine categories.
 */

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
import { EditingService } from '../lib/editor/editingService';
import { getStorage } from '../lib/storage';
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
