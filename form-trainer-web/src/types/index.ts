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

export interface JointScore {
  name: string;
  score: number;
  refAngle: number;
  userAngle: number;
}

export interface ComparisonResult {
  overallScore: number;
  jointScores: JointScore[];
  feedbackMessages: string[];
}
