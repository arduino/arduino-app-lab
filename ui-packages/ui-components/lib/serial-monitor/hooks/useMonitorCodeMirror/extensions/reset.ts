import { StateEffect, TransactionSpec } from '@codemirror/state';

export const reset = StateEffect.define();

export function addResetEffect(tr: TransactionSpec): void {
  if (!tr.effects) {
    tr.effects = [];
  }
  (tr.effects as StateEffect<any>[]).push(reset.of(null));
}
