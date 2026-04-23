import { useState } from 'react';
import { usePoseDetection } from './hooks/usePoseDetection';
import { VideoUploader } from './components/VideoUploader';
import { MuscleView } from './components/MuscleView';
import type { FramePose, AnalysisResult } from './types';
import styles from './App.module.css';

type Step = 'select' | 'extracting' | 'generating' | 'result';

export default function App() {
  const [step, setStep] = useState<Step>('select');
  const [refFile, setRefFile] = useState<File | null>(null);
  const [userFile, setUserFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const { extractPosesFromVideo, analyzeMuscles, createComparisonVideo } = usePoseDetection();

  const startAnalysis = async () => {
    if (!refFile || !userFile) return;

    let refPoses: FramePose[] = [];
    let userPoses: FramePose[] = [];

    try {
      setStep('extracting');
      setStatusText('参照動画を解析中...');
      refPoses = await extractPosesFromVideo(refFile, p => {
        setProgress(p * 0.5);
        setStatusText(`参照動画を解析中... ${Math.round(p * 100)}%`);
      });

      setStatusText('自分の動画を解析中...');
      userPoses = await extractPosesFromVideo(userFile, p => {
        setProgress(0.5 + p * 0.5);
        setStatusText(`自分の動画を解析中... ${Math.round(p * 100)}%`);
      });

      const analysis = analyzeMuscles(refPoses, userPoses);

      setStep('generating');
      setProgress(0);
      setStatusText('比較動画を生成中...');

      let videoUrl: string | null = null;
      try {
        videoUrl = await createComparisonVideo(refFile, userFile, refPoses, userPoses, p => {
          setProgress(p);
          setStatusText(`比較動画を生成中... ${Math.round(p * 100)}%`);
        });
      } catch (e) {
        console.warn('比較動画の生成に失敗しました:', e);
      }

      setResult({ ...analysis, comparisonVideoUrl: videoUrl });
      setStep('result');
    } catch (e) {
      console.error(e);
      setStatusText('エラーが発生しました。もう一度お試しください。');
      setStep('select');
    }
  };

  const reset = () => {
    setStep('select');
    setRefFile(null);
    setUserFile(null);
    setProgress(0);
    setResult(null);
  };

  const isAnalyzing = step === 'extracting' || step === 'generating';

  return (
    <div className={styles.app}>
      {step === 'select' && (
        <>
          <header className={styles.header}>
            <h1 className={styles.title}>Form<br />Trainer</h1>
            <p className={styles.subtitle}>プロのフォームと自分を比較して改善</p>
          </header>

          <div className={styles.uploaders}>
            <VideoUploader
              label="参照動画（プロのフォーム）"
              description="YouTuberの動画を画面録画してアップロード"
              color="#00c853"
              file={refFile}
              onSelect={setRefFile}
            />
            <VideoUploader
              label="自分の動画"
              description="筋トレ動画をアップロード"
              color="#2979ff"
              file={userFile}
              onSelect={setUserFile}
            />
          </div>

          {refFile && userFile && (
            <button className={styles.analyzeBtn} onClick={startAnalysis}>
              フォームを比較する
            </button>
          )}
        </>
      )}

      {isAnalyzing && (
        <div className={styles.analyzing}>
          <div className={styles.spinner} />
          <p className={styles.statusText}>{statusText}</p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className={styles.progressPct}>{Math.round(progress * 100)}%</p>
        </div>
      )}

      {step === 'result' && result && (
        <>
          <header className={styles.header}>
            <h1 className={styles.title}>解析結果</h1>
          </header>
          <MuscleView result={result} onReset={reset} />
        </>
      )}
    </div>
  );
}
