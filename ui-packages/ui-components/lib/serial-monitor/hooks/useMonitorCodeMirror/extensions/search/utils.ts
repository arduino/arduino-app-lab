/**
 * Holds a span with a counter number and allows for setting its value
 */
export class Counter {
  el: HTMLElement;
  #value = 0;
  constructor() {
    const el = document.createElement('span');
    el.classList.add('counter');
    el.textContent = this.#value.toString();
    this.el = el;
    this.setPlaceholder = this.setPlaceholder.bind(this);
  }
  set value(newValue: number) {
    this.#value = newValue;
    this.el.textContent = newValue.toString();
  }
  get value(): number {
    return this.#value;
  }
  setPlaceholder(placeholder: string): void {
    this.#value = NaN;
    this.el.textContent = placeholder;
  }
}

export function includes(string: string, value: string): boolean {
  return value !== '' && string.includes(value);
}
