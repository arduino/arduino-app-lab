export interface LearnItemProps {
  variant?: 'default' | 'skeleton';
  name?: string;
  description?: string;
  date?: Date;
  category?: unknown[];
  icon?: string;
}
