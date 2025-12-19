import styles from './dots-loader.module.scss';

export const DotsLoader: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.loader} />
    </div>
  );
};
