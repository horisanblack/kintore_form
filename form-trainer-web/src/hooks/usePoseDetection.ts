import { useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FramePose, ComparisonResult, JointScore } from '../types';

const JOINT_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const JOINT_CHECKS = [
  { name: '左肘', joint: 13, upper: 11, lower: 15 },
  { name: '右肘', joint: 14, upper: 12, lower: 16 },
  { name: '左膝', joint: 25, upper: 23, lower: 27 },
  { name: '右膝', joint: 26, upper: 24, lower: 28 },
  { name: '左肩', joint: 11, upper: 23, lower: 13 },
  { name: '右肩', joint: 12, upper: 24, lower: 14 },
];

function calcAngle(
  lm: { x: number; y: number }[],
  joint: number,
  upper: number,
  lower: number
): number | null {
  const j = lm[joint], u = lm[upper], l = lm[lower];
  if (!j || !u || !l) return null;
  const v1 = { x: u.x - j.x, y: u.y - j.y };
  const v2 = { x: l.x - j.x, y: l.y - j.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.sqrt(v1.x ** 2 + v1.y ** 2) * Math.sqrt(v2.x ** 2 + v2.y ** 2);
  if (mag === 0) return null;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
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
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }, []);

  const extractPosesFromVideo = useCallback(
    async (
      videoFile: File,
      onProgress: (p: number) => void
    ): Promise<FramePose[]> => {
      await init();
      const detector = detectorRef.current!;

      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        video.muted = true;
        video.playsInline = true;

        const poses: FramePose[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          video.currentTime = 0;
        };

        video.onseeked = () => {
          ctx.drawImage(video, 0, 0);
          const result = detector.detectForVideo(video, video.currentTime * 1000);
          if (result.landmarks.length > 0) {
            poses.push({
              frameIndex: poses.length,
              landmarks: result.landmarks[0],
              timestamp: video.currentTime,
            });
          }

          const next = video.currentTime + 0.5;
          onProgress(Math.min(video.currentTime / video.duration, 1));

          if (next < video.duration) {
            video.currentTime = next;
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

  const comparePoses = useCallback(
    (ref: FramePose[], user: FramePose[]): ComparisonResult => {
      if (!ref.length || !user.length) {
        return { overallScore: 0, jointScores: [], feedbackMessages: ['ポーズを検出できませんでした'] };
      }

      const refPose = ref[Math.floor(ref.length / 2)].landmarks;
      const userPose = user[Math.floor(user.length / 2)].landmarks;

      const jointScores: JointScore[] = [];
      const feedbackMessages: string[] = [];

      for (const { name, joint, upper, lower } of JOINT_CHECKS) {
        const refAngle = calcAngle(refPose, joint, upper, lower);
        const userAngle = calcAngle(userPose, joint, upper, lower);
        if (refAngle == null || userAngle == null) continue;

        const diff = Math.abs(refAngle - userAngle);
        const score = Math.max(0, 1 - diff / 90);
        jointScores.push({ name, score, refAngle, userAngle });

        if (diff > 20) {
          feedbackMessages.push(
            `${name}の角度がプロより${diff.toFixed(0)}°ずれています（プロ: ${refAngle.toFixed(0)}° / あなた: ${userAngle.toFixed(0)}°）`
          );
        }
      }

      if (feedbackMessages.length === 0) {
        feedbackMessages.push('フォームは良好です！継続して練習しましょう 💪');
      }

      const overallScore = jointScores.length
        ? jointScores.reduce((s, j) => s + j.score, 0) / jointScores.length
        : 0;

      return { overallScore, jointScores, feedbackMessages };
    },
    []
  );

  const drawPose = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      landmarks: { x: number; y: number }[],
      color: string,
      width: number,
      height: number
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.fillStyle = color;

      for (const [a, b] of JOINT_CONNECTIONS) {
        const la = landmarks[a], lb = landmarks[b];
        if (!la || !lb) continue;
        ctx.beginPath();
        ctx.moveTo(la.x * width, la.y * height);
        ctx.lineTo(lb.x * width, lb.y * height);
        ctx.stroke();
      }

      for (const lm of landmarks) {
        ctx.beginPath();
        ctx.arc(lm.x * width, lm.y * height, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    []
  );

  return { extractPosesFromVideo, comparePoses, drawPose };
}
