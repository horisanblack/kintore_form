import { useState } from 'react';
import { usePoseDetection } from './hooks/usePoseDetection';
import { VideoUploader } from './components/VideoUploader';
import { ResultView } from './components/ResultView';
import type { FramePose, ComparisonResult } from './types';
import styles from './App.module.css';

type Step = 'select' | 'analyzing' | 'result';

export default function App() {
  const [step, setStep] = useState<Step>('select');
  const [refFile, setRefFile] = useState<File | null>(null);
  const [userFile, setUserFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);

  const { extractPosesFromVideo, comparePoses } = usePoseDetection();

  const startAnalysis = async () => {
    if (!refFile || !userFile) return;
    setStep('analyzing');

    setStatusText('参照動画を解析中...');
    let refPoses: FramePose[] = [];
    let userPoses: FramePose[] = [];

    try {
      refPoses = await extractPosesFromVideo(refFile, (p) => {
        setProgress(p * 0.5);
        setStatusText(`参照動画を解析中... ${Math.round(p * 100)}%`);
      });

      setStatusText('自分の動画を解析中...');
      userPoses = await extractPosesFromVideo(userFile, (p) => {
        setProgress(0.5 + p * 0.5);
        setStatusText(`自分の動画を解析中... ${Math.round(p * 100)}%`);
      });

      const comparison = comparePoses(refPoses, userPoses);
      setResult(comparison);
      setStep('result');
    } catch (e) {
      console.error(e);
      setStatusText('エラーが発生しました。もう一度お試しください。');
    }
  };

  const reset = () => {
    setStep('select');
    setRefFile(null);
    setUserFile(null);
    setProgress(0);
    setResult(null);
  };

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

      {step === 'analyzing' && (
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
          <ResultView result={result} onReset={reset} />
        </>
      )}
    </div>
  );
}
