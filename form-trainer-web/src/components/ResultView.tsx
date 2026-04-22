import type { ComparisonResult } from '../types';
import styles from './ResultView.module.css';

interface Props {
  result: ComparisonResult;
  onReset: () => void;
}

function scoreColor(score: number) {
  if (score >= 0.8) return '#00c853';
  if (score >= 0.5) return '#ffd600';
  return '#ff1744';
}

export function ResultView({ result, onReset }: Props) {
  const pct = Math.round(result.overallScore * 100);
  const color = scoreColor(result.overallScore);

  return (
    <div className={styles.container}>
      <div className={styles.scoreCard} style={{ borderColor: `${color}66` }}>
        <span className={styles.scoreNum} style={{ color }}>{pct}</span>
        <span className={styles.scoreLabel}>総合スコア</span>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>

      <h2 className={styles.sectionTitle}>関節ごとのスコア</h2>
      <div className={styles.joints}>
        {result.jointScores.map((j) => {
          const c = scoreColor(j.score);
          return (
            <div key={j.name} className={styles.jointRow}>
              <span className={styles.jointName}>{j.name}</span>
              <div className={styles.bar} style={{ flex: 1 }}>
                <div className={styles.barFill} style={{ width: `${Math.round(j.score * 100)}%`, background: c }} />
              </div>
              <span className={styles.jointScore} style={{ color: c }}>{Math.round(j.score * 100)}</span>
            </div>
          );
        })}
      </div>

      <h2 className={styles.sectionTitle}>フィードバック</h2>
      <div className={styles.feedbacks}>
        {result.feedbackMessages.map((msg, i) => (
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
