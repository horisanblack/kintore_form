import styles from './MuscleView.module.css';
import type { AnalysisResult } from '../types';

interface Props {
  result: AnalysisResult;
  onReset: () => void;
}

export function MuscleView({ result, onReset }: Props) {
  return (
    <div className={styles.container}>
      {result.comparisonVideoUrl && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>比較動画（プロの骨格オーバーレイ）</h2>
          <video src={result.comparisonVideoUrl} controls playsInline className={styles.video} />
          <a
            href={result.comparisonVideoUrl}
            download="bicep_comparison.webm"
            className={styles.downloadBtn}
          >
            動画をダウンロード
          </a>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>上腕二頭筋 分析</h2>
        <div className={styles.legend}>
          <span className={styles.legendUser}>● あなた</span>
          <span className={styles.legendRef}>● プロ</span>
        </div>

        {result.userMuscles.map((um, i) => {
          const rm = result.refMuscles[i];
          return (
            <div key={um.name} className={styles.muscleCard}>
              <h3 className={styles.muscleName}>{um.name}</h3>

              <div className={styles.statsRow}>
                <Stat label="可動域" userVal={`${um.romDeg}°`} refVal={rm ? `${rm.romDeg}°` : undefined} />
                <Stat label="最小角度" userVal={`${um.minAngle}°`} refVal={rm ? `${rm.minAngle}°` : undefined} />
                <Stat label="最大角度" userVal={`${um.maxAngle}°`} refVal={rm ? `${rm.maxAngle}°` : undefined} />
              </div>

              <Metric label="収縮率" unit="%" userVal={um.contractionPct} refVal={rm?.contractionPct} max={100} />
              <Metric label="骨格可動域" unit="°" userVal={um.romDeg} refVal={rm?.romDeg} max={150} />
              <Metric label="負荷指数" unit="" userVal={um.loadIndex} refVal={rm?.loadIndex} max={100} />
            </div>
          );
        })}
      </section>

      <section className={styles.feedbackSection}>
        {result.feedbackMessages.map((msg, i) => (
          <p key={i} className={styles.feedback}>{msg}</p>
        ))}
      </section>

      <button onClick={onReset} className={styles.resetBtn}>もう一度</button>
    </div>
  );
}

function Stat({ label, userVal, refVal }: { label: string; userVal: string; refVal?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statUser}>{userVal}</span>
      {refVal && <span className={styles.statRef}>{refVal}</span>}
    </div>
  );
}

function Metric({
  label, unit, userVal, refVal, max,
}: {
  label: string; unit: string; userVal: number; refVal?: number; max: number;
}) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <div className={styles.bars}>
        <div className={styles.barRow}>
          <span className={styles.tag} style={{ color: '#4fc3f7' }}>あなた</span>
          <div className={styles.track}>
            <div className={styles.fillUser} style={{ width: `${Math.min(100, (userVal / max) * 100)}%` }} />
          </div>
          <span className={styles.val}>{userVal}{unit}</span>
        </div>
        {refVal !== undefined && (
          <div className={styles.barRow}>
            <span className={styles.tag} style={{ color: '#00e676' }}>プロ</span>
            <div className={styles.track}>
              <div className={styles.fillRef} style={{ width: `${Math.min(100, (refVal / max) * 100)}%` }} />
            </div>
            <span className={styles.val}>{refVal}{unit}</span>
          </div>
        )}
      </div>
    </div>
  );
}
