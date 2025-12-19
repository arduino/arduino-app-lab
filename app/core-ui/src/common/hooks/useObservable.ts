import { useCallback, useSyncExternalStore } from 'react';
import { BehaviorSubject, Observable } from 'rxjs';

// to be used with `BehaviorSubject`, `ReplaySubject` or an observable piped to `shareReplay`.
export function useObservable<T>(observable: Observable<T>): T | undefined {
  const subscribe = useCallback(
    (callback: VoidFunction) => {
      const subscription = observable.subscribe(callback);
      return () => subscription.unsubscribe();
    },
    [observable],
  );

  const getSnapshot = useCallback(() => {
    if (observable instanceof BehaviorSubject) {
      return observable.getValue();
    } else {
      // from React README: https://github.com/facebook/react/blob/main/packages/use-subscription/README.md#replaysubject
      // to support `ReplaySubject` or observables piped to `shareReplay`
      let currentValue;

      observable
        .subscribe((value) => {
          currentValue = value;
        })
        .unsubscribe();
      return currentValue;
    }
  }, [observable]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
