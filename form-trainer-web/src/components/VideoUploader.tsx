import { useRef } from 'react';
import styles from './VideoUploader.module.css';

interface Props {
  label: string;
  description: string;
  color: string;
  file: File | null;
  onSelect: (file: File) => void;
}

export function VideoUploader({ label, description, color, file, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={styles.card}
      style={{ borderColor: file ? color : `${color}44` }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
      {file ? (
        <>
          <div className={styles.checkIcon} style={{ color }}>✓</div>
          <p className={styles.fileName}>{file.name}</p>
          <p className={styles.sub}>タップして変更</p>
        </>
      ) : (
        <>
          <div className={styles.plusIcon} style={{ color }}>+</div>
          <p className={styles.title}>{label}</p>
          <p className={styles.desc}>{description}</p>
        </>
      )}
    </div>
  );
}
