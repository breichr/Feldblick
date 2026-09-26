type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Minimal element factory: h('button', { class: 'x', onclick: fn }, 'Text'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const c of children) {
    if (c !== null && c !== undefined && c !== false) el.append(c);
  }
  return el;
}

export function swatch(color: string): HTMLSpanElement {
  const el = h('span', { class: 'swatch', 'aria-hidden': 'true' });
  el.style.background = color;
  return el;
}
