export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FramePose {
  frameIndex: number;
  landmarks: Landmark[];
  timestamp: number;
}

export interface MuscleInfo {
  name: string;
  romDeg: number;
  contractionPct: number;
  loadIndex: number;
  minAngle: number;
  maxAngle: number;
}

export interface AnalysisResult {
  userMuscles: MuscleInfo[];
  refMuscles: MuscleInfo[];
  feedbackMessages: string[];
  comparisonVideoUrl: string | null;
}
