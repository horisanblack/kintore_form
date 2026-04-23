import { useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FramePose, MuscleInfo, AnalysisResult, Landmark } from '../types';

const JOINT_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const MUSCLE_JOINTS = [
  { name: '左上腕二頭筋', joint: 13, upper: 11, lower: 15 },
  { name: '右上腕二頭筋', joint: 14, upper: 12, lower: 16 },
];

function calcAngle(
  lm: { x: number; y: number; z: number }[],
  joint: number, upper: number, lower: number
): number | null {
  const j = lm[joint], u = lm[upper], l = lm[lower];
  if (!j || !u || !l) return null;
  const v1 = { x: u.x - j.x, y: u.y - j.y, z: u.z - j.z };
  const v2 = { x: l.x - j.x, y: l.y - j.y, z: l.z - j.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2) *
              Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
  if (mag === 0) return null;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function calcBodyYaw(lm: Landmark[]): number {
  const ls = lm[11], rs = lm[12];
  if (!ls || !rs) return 0;
  return Math.atan2(rs.z - ls.z, rs.x - ls.x) * 180 / Math.PI;
}

function rotateLandmarksYaw(lm: Landmark[], angleDeg: number): Landmark[] {
  const lh = lm[23], rh = lm[24];
  const cx = lh && rh ? (lh.x + rh.x) / 2 : 0.5;
  const cz = lh && rh ? (lh.z + rh.z) / 2 : 0;
  const rad = angleDeg * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return lm.map(p => {
    if (!p) return p;
    const dx = p.x - cx, dz = p.z - cz;
    return { ...p, x: cx + dx * cos + dz * sin, z: cz - dx * sin + dz * cos };
  });
}

function alignSkeletonToShoulder(
  lm: Landmark[],
  targetCx: number,
  targetCy: number
): Landmark[] {
  const ls = lm[11], rs = lm[12];
  if (!ls || !rs) return lm;
  const cx = (ls.x + rs.x) / 2;
  const cy = (ls.y + rs.y) / 2;
  const dx = targetCx - cx;
  const dy = targetCy - cy;
  return lm.map(p => {
    if (!p) return p;
    return { ...p, x: p.x + dx, y: p.y + dy };
  });
}

function interpolateLandmarks(poses: FramePose[], t: number): Landmark[] | null {
  if (poses.length === 0) return null;
  if (poses.length === 1) return poses[0].landmarks;

  let before = poses[0];
  let after = poses[poses.length - 1];

  for (let i = 0; i < poses.length - 1; i++) {
    if (poses[i].timestamp <= t && poses[i + 1].timestamp >= t) {
      before = poses[i];
      after = poses[i + 1];
      break;
    }
  }

  const dur = after.timestamp - before.timestamp;
  if (dur === 0) return before.landmarks;
  const ratio = Math.max(0, Math.min(1, (t - before.timestamp) / dur));

  return before.landmarks.map((lm, i) => {
    const b = after.landmarks[i];
    if (!lm || !b) return lm;
    return {
      x: lm.x + (b.x - lm.x) * ratio,
      y: lm.y + (b.y - lm.y) * ratio,
      z: lm.z + (b.z - lm.z) * ratio,
      visibility: lm.visibility,
    };
  });
}

function analyzeMusclesFromPoses(poses: FramePose[]): MuscleInfo[] {
  return MUSCLE_JOINTS.map(({ name, joint, upper, lower }) => {
    const angles = poses
      .map(p => calcAngle(p.landmarks, joint, upper, lower))
      .filter((a): a is number => a !== null);

    if (angles.length === 0) {
      return { name, romDeg: 0, contractionPct: 0, loadIndex: 0, minAngle: 0, maxAngle: 0 };
    }

    const minAngle = Math.min(...angles);
    const maxAngle = Math.max(...angles);
    const romDeg = Math.round(maxAngle - minAngle);
    const contractionPct = Math.min(100, Math.round((180 - minAngle) / 1.5));

    const velocities = angles.slice(1).map((a, i) => Math.abs(a - angles[i]));
    const avgVelocity = velocities.length > 0
      ? velocities.reduce((s, v) => s + v, 0) / velocities.length : 0;
    const loadIndex = Math.min(100, Math.round(Math.sqrt(romDeg * (avgVelocity + 1)) * 1.5));

    return { name, romDeg, contractionPct, loadIndex, minAngle: Math.round(minAngle), maxAngle: Math.round(maxAngle) };
  });
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[],
  color: string,
  alpha: number,
  w: number,
  h: number,
  lineWidth: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [a, b] of JOINT_CONNECTIONS) {
    const la = lm[a], lb = lm[b];
    if (!la || !lb) continue;
    ctx.beginPath();
    ctx.moveTo(la.x * w, la.y * h);
    ctx.lineTo(lb.x * w, lb.y * h);
    ctx.stroke();
  }
  for (const l of lm) {
    if (!l) continue;
    ctx.beginPath();
    ctx.arc(l.x * w, l.y * h, lineWidth + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSkeleton3D(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[],
  baseColor: string,
  alpha: number,
  w: number,
  h: number,
  lineWidth: number
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // 骨格セグメントをシリンダー風に描画（横方向グラデで立体感）
  for (const [a, b] of JOINT_CONNECTIONS) {
    const la = lm[a], lb = lm[b];
    if (!la || !lb) continue;
    const ax = la.x * w, ay = la.y * h;
    const bx = lb.x * w, by = lb.y * h;
    const dx = bx - ax, dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;
    const nx = (-dy / len) * lineWidth;
    const ny = (dx / len) * lineWidth;

    const grad = ctx.createLinearGradient(ax + nx, ay + ny, ax - nx, ay - ny);
    grad.addColorStop(0,    'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, baseColor);
    grad.addColorStop(1,    'rgba(0,0,0,0.55)');

    ctx.beginPath();
    ctx.moveTo(ax + nx, ay + ny);
    ctx.lineTo(bx + nx, by + ny);
    ctx.lineTo(bx - nx, by - ny);
    ctx.lineTo(ax - nx, ay - ny);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // 関節をスフィア風に描画（放射グラデで球感）
  const jr = lineWidth * 1.6;
  for (const l of lm) {
    if (!l) continue;
    const x = l.x * w, y = l.y * h;
    const grad = ctx.createRadialGradient(
      x - jr * 0.3, y - jr * 0.35, jr * 0.05,
      x, y, jr
    );
    grad.addColorStop(0,   '#ffffff');
    grad.addColorStop(0.4,  baseColor);
    grad.addColorStop(1,   'rgba(0,0,0,0.6)');
    ctx.beginPath();
    ctx.arc(x, y, jr, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  ctx.restore();
}

function drawAngleLabel(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[],
  joint: number,
  angle: number,
  color: string,
  w: number,
  h: number
) {
  const j = lm[joint];
  if (!j) return;
  const x = j.x * w + 12;
  const y = j.y * h - 6;
  const fs = Math.max(14, Math.round(w / 45));
  ctx.save();
  ctx.font = `bold ${fs}px Arial`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(`${Math.round(angle)}°`, x, y);
  ctx.fillStyle = color;
  ctx.fillText(`${Math.round(angle)}°`, x, y);
  ctx.restore();
}

export function usePoseDetection() {
  const detectorRef = useRef<PoseLandmarker | null>(null);

  const init = useCallback(async () => {
    if (detectorRef.current) return;
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    detectorRef.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }, []);

  const extractPosesFromVideo = useCallback(
    async (videoFile: File, onProgress: (p: number) => void): Promise<FramePose[]> => {
      await init();
      const detector = detectorRef.current!;
      const SAMPLE_COUNT = 20;

      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.playsInline = true;

        const poses: FramePose[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let sampleTimes: number[] = [];
        let sampleIndex = 0;

        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const dur = video.duration;
          sampleTimes = Array.from({ length: SAMPLE_COUNT }, (_, i) =>
            ((2 * i + 1) / (2 * SAMPLE_COUNT)) * dur
          );
          video.currentTime = sampleTimes[0];
        };

        video.onseeked = () => {
          ctx.drawImage(video, 0, 0);
          const result = detector.detectForVideo(video, performance.now());
          if (result.landmarks.length > 0) {
            poses.push({
              frameIndex: sampleIndex,
              landmarks: result.landmarks[0],
              timestamp: video.currentTime,
            });
          }
          sampleIndex++;
          onProgress(sampleIndex / SAMPLE_COUNT);
          if (sampleIndex < sampleTimes.length) {
            video.currentTime = sampleTimes[sampleIndex];
          } else {
            URL.revokeObjectURL(video.src);
            resolve(poses);
          }
        };

        video.onerror = reject;
        video.load();
      });
    },
    [init]
  );

  const analyzeMuscles = useCallback(
    (refPoses: FramePose[], userPoses: FramePose[]): AnalysisResult => {
      if (!refPoses.length || !userPoses.length) {
        return { userMuscles: [], refMuscles: [], feedbackMessages: ['ポーズを検出できませんでした'], comparisonVideoUrl: null };
      }

      const refMiddle = refPoses[Math.floor(refPoses.length / 2)].landmarks;
      const userMiddle = userPoses[Math.floor(userPoses.length / 2)].landmarks;
      const yawDiff = calcBodyYaw(refMiddle) - calcBodyYaw(userMiddle);

      const normalizedUserPoses = Math.abs(yawDiff) > 5
        ? userPoses.map(p => ({ ...p, landmarks: rotateLandmarksYaw(p.landmarks, yawDiff) }))
        : userPoses;

      const refMuscles = analyzeMusclesFromPoses(refPoses);
      const userMuscles = analyzeMusclesFromPoses(normalizedUserPoses);

      const feedbackMessages: string[] = [];
      if (Math.abs(yawDiff) > 20) {
        feedbackMessages.push(`📐 カメラ角度を自動補正しました（約${Math.abs(yawDiff).toFixed(0)}°のずれを修正）`);
      }

      for (let i = 0; i < refMuscles.length; i++) {
        const ref = refMuscles[i];
        const user = userMuscles[i];
        if (ref.romDeg - user.romDeg > 20) {
          feedbackMessages.push(`${user.name}の可動域がプロより${ref.romDeg - user.romDeg}°少ないです`);
        }
        if (ref.contractionPct - user.contractionPct > 15) {
          feedbackMessages.push(`${user.name}の収縮が足りません（プロ: ${ref.contractionPct}% / あなた: ${user.contractionPct}%）`);
        }
      }

      if (feedbackMessages.length === 0 || feedbackMessages.every(m => m.startsWith('📐'))) {
        feedbackMessages.push('上腕二頭筋のフォームは良好です！💪');
      }

      return { userMuscles, refMuscles, feedbackMessages, comparisonVideoUrl: null };
    },
    []
  );

  const createComparisonVideo = useCallback(
    async (
      refFile: File,
      userFile: File,
      refPoses: FramePose[],
      userPoses: FramePose[],
      onProgress: (p: number) => void
    ): Promise<string> => {
      return new Promise((resolve, reject) => {
        const refVideo = document.createElement('video');
        const userVideo = document.createElement('video');
        refVideo.src = URL.createObjectURL(refFile);
        userVideo.src = URL.createObjectURL(userFile);
        refVideo.muted = true;
        userVideo.muted = true;
        refVideo.playsInline = true;
        userVideo.playsInline = true;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let refReady = false, userReady = false;

        const startRecording = () => {
          if (!refReady || !userReady) return;

          const W = userVideo.videoWidth || 1280;
          const H = userVideo.videoHeight || 720;
          canvas.width = W;
          canvas.height = H;

          let stream: MediaStream;
          try {
            stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30);
          } catch {
            reject(new Error('captureStream非対応'));
            return;
          }

          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';

          let recorder: MediaRecorder;
          try {
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
          } catch {
            reject(new Error('MediaRecorder非対応'));
            return;
          }

          const chunks: Blob[] = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            URL.revokeObjectURL(refVideo.src);
            URL.revokeObjectURL(userVideo.src);
            resolve(URL.createObjectURL(new Blob(chunks, { type: mimeType })));
          };

          const refLastTs = refPoses[refPoses.length - 1]?.timestamp ?? 1;
          const userLastTs = userPoses[userPoses.length - 1]?.timestamp ?? 1;
          recorder.start(100);

          const lw = Math.max(3, W / 160);

          const draw = () => {
            const t = userVideo.currentTime;
            if (userVideo.ended || t >= userVideo.duration - 0.1) {
              recorder.stop();
              return;
            }

            ctx.drawImage(userVideo, 0, 0, W, H);

            const syncedRefT = (t / userLastTs) * refLastTs;
            const refLm = interpolateLandmarks(refPoses, syncedRefT);
            const userLm = interpolateLandmarks(userPoses, t);

            // 肩の中心を基準にプロのスケルトンをユーザーの体に平行移動で位置合わせ
            const PRO_COLOR = '#ff9500';
            let alignedRefLm: typeof refLm = refLm;
            if (refLm && userLm) {
              const uls = userLm[11], urs = userLm[12];
              if (uls && urs) {
                const targetCx = (uls.x + urs.x) / 2;
                const targetCy = (uls.y + urs.y) / 2;
                let aligned = alignSkeletonToShoulder(refLm, targetCx, targetCy);

                // 向きが逆なら肩中心で水平フリップ
                const refFacingRight = aligned[11] && aligned[12]
                  ? aligned[11].x > aligned[12].x
                  : true;
                const userFacingRight = uls.x > urs.x;
                if (refFacingRight !== userFacingRight) {
                  aligned = aligned.map(p => p ? { ...p, x: 2 * targetCx - p.x } : p);
                }

                alignedRefLm = aligned;
              }
            }

            if (userLm) drawSkeleton(ctx, userLm, '#4fc3f7', 0.55, W, H, lw * 0.7);
            if (alignedRefLm) drawSkeleton3D(ctx, alignedRefLm, PRO_COLOR, 1.0, W, H, lw);

            if (alignedRefLm) {
              const la = calcAngle(alignedRefLm, 13, 11, 15);
              const ra = calcAngle(alignedRefLm, 14, 12, 16);
              if (la !== null) drawAngleLabel(ctx, alignedRefLm, 13, la, PRO_COLOR, W, H);
              if (ra !== null) drawAngleLabel(ctx, alignedRefLm, 14, ra, PRO_COLOR, W, H);
            }
            if (userLm) {
              const la = calcAngle(userLm, 13, 11, 15);
              const ra = calcAngle(userLm, 14, 12, 16);
              if (la !== null) drawAngleLabel(ctx, userLm, 13, la, '#4fc3f7', W, H);
              if (ra !== null) drawAngleLabel(ctx, userLm, 14, ra, '#4fc3f7', W, H);
            }

            const pad = Math.max(10, W / 72);
            const fs = Math.max(14, Math.round(W / 52));
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(pad, pad, fs * 5, fs * 2.8);
            ctx.font = `bold ${fs}px Arial`;
            ctx.fillStyle = PRO_COLOR;
            ctx.fillText('● PRO', pad + 8, pad + fs + 2);
            ctx.fillStyle = '#4fc3f7';
            ctx.fillText('● YOU', pad + 8, pad + fs * 2.4);
            ctx.restore();

            onProgress(t / userVideo.duration);
            requestAnimationFrame(draw);
          };

          Promise.all([refVideo.play(), userVideo.play()])
            .then(() => requestAnimationFrame(draw))
            .catch(reject);
        };

        refVideo.onloadedmetadata = () => { refReady = true; startRecording(); };
        userVideo.onloadedmetadata = () => { userReady = true; startRecording(); };
        refVideo.onerror = reject;
        userVideo.onerror = reject;
      });
    },
    []
  );

  return { extractPosesFromVideo, analyzeMuscles, createComparisonVideo };
}
