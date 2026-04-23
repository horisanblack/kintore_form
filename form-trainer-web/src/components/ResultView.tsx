import type { AnalysisResult } from '../types';
import styles from './ResultView.module.css';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

export function ResultView({ result, onReset }: Props) {
  return (
    <div className={styles.container}>
      <h2 className={styles.sectionTitle}>フィードバック</h2>
      <div className={styles.feedbacks}>
        {result.feedbackMessages.map((msg: string, i: number) => (
          <div key={i} className={styles.feedbackItem}>
            <span className={styles.feedbackIcon}>💡</span>
            <span>{msg}</span>
          </div>
        ))}
      </div>

      <button className={styles.resetBtn} onClick={onReset}>
        もう一度比較する
      </button>
    </div>
  );
}
