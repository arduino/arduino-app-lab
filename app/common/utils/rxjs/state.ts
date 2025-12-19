import { State } from './state.type';

export function createState<T extends State<T>>(
  currentState: T,
  newStateProps: Partial<T>,
): T {
  return {
    ...currentState,
    ...newStateProps,
  };
}
