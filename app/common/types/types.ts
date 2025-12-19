import { RequireAtLeastOne } from 'type-fest';

export type NonEmptyStringArray = RequireAtLeastOne<string[], 0>;

export type ArrayElement<ArrayType extends readonly unknown[]> =
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export interface FileLineScope {
  start: number;
  end: number;
}
