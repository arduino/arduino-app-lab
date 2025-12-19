import { ReferenceCategory } from '@cloud-editor-mono/infrastructure';

export function cleanReferenceCategoriesTemplate(dom: Document): void {
  dom.querySelectorAll('h2').forEach((h2) => h2.remove());
  dom.querySelectorAll('a').forEach((anchor) => {
    if (!anchor.innerHTML.trim()) {
      anchor.remove();
    }
  });
}

export function cleanReferenceItemTemplate(dom: Document): void {
  dom.querySelector('.subcategories')?.remove();

  dom.querySelector('.auto-see-also')?.remove();
  const seeAlsoContent = dom.querySelectorAll('#see_also ul');
  if (seeAlsoContent.length === 0) {
    dom.querySelector('#see_also')?.remove();
  }
}

export function isReferenceCategory(value: string): value is ReferenceCategory {
  return (Object.values(ReferenceCategory) as string[]).includes(value);
}
