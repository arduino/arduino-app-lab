import clsx from 'clsx';

import { Text } from '../Text/Text';
import styles from './table.module.scss';

interface TableProps {
  headers: string[];
  rows: string[][];
  caption?: string;
  className?: string;
}

export const Table: React.FC<TableProps> = ({
  headers,
  rows,
  caption,
  className,
}) => {
  return (
    <div className={clsx(styles['table'], className)}>
      <table className={styles['table-grid']}>
        {caption && (
          <caption className={styles['table-caption']}>{caption}</caption>
        )}
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index} scope="col" className={styles['table-th']}>
                <Text className={styles['table-header-text']}>{header}</Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={styles['table-td']}>
                  <Text className={styles['table-cell-text']}>{cell}</Text>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
