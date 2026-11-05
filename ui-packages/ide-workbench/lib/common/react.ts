/**
 * A ref object as `useRef<T>(null)` returns it — under React 18 *and* 19.
 *
 * The two versions disagree: React 18 types it `RefObject<T>`, React 19
 * `RefObject<T | null>`, and because the type parameter appears in a property
 * the two are not mutually assignable. A package whose peers span both cannot
 * name either one, so it names the shape instead. Both versions' return types
 * satisfy this structurally, and it is assignable to a DOM `ref` prop in both.
 *
 * Use it in signatures that *receive* a ref created by a caller. Creating one is
 * unaffected — `useRef<T>(null)` needs no annotation.
 */
export type NullableRef<T> = { readonly current: T | null };
