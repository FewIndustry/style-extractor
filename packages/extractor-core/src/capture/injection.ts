/**
 * This script is injected into the target page via Browserless/Playwright.
 * It walks the DOM and extracts computed styles from all visible elements.
 * Must be self-contained — no imports.
 */
export function getInjectionScript(): string {
  return `
(function() {
  const colors = new Map();
  const fonts = new Map();
  const spacing = new Map();
  const shadows = new Set();
  const radii = new Set();
  const borderWidths = new Set();
  const classNames = new Set();

  // Collect CSS custom properties from :root
  const cssVars = {};
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
            for (const prop of rule.style) {
              if (prop.startsWith('--')) {
                cssVars[prop] = rule.style.getPropertyValue(prop).trim();
              }
            }
          }
        }
      } catch(e) { /* cross-origin stylesheet, skip */ }
    }
  } catch(e) {}

  const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor',
    'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor'];
  const spacingProps = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'rowGap', 'columnGap'];

  const elements = document.querySelectorAll('body *');

  elements.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const style = getComputedStyle(el);
    const tag = el.tagName.toLowerCase();

    // Collect class names
    el.classList.forEach(c => classNames.add(c));

    // Colors
    colorProps.forEach(prop => {
      const val = style[prop];
      if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        const key = val + '::' + prop;
        colors.set(key, (colors.get(key) || 0) + 1);
      }
    });

    // Fonts
    const fontKey = style.fontFamily + '::' + style.fontSize + '::' + style.fontWeight;
    const text = el.textContent || '';
    if (!fonts.has(fontKey)) {
      fonts.set(fontKey, {
        family: style.fontFamily,
        size: style.fontSize,
        weight: parseInt(style.fontWeight) || 400,
        lineHeight: style.lineHeight,
        element: tag,
        charCount: text.length
      });
    } else {
      fonts.get(fontKey).charCount += text.length;
    }

    // Spacing
    spacingProps.forEach(prop => {
      const val = parseFloat(style[prop]);
      if (val > 0 && val < 500) {
        const key = Math.round(val);
        spacing.set(key, (spacing.get(key) || 0) + 1);
      }
    });

    // Shadows
    if (style.boxShadow && style.boxShadow !== 'none') {
      shadows.add(style.boxShadow);
    }

    // Border radius
    if (style.borderRadius && style.borderRadius !== '0px') {
      radii.add(style.borderRadius);
    }

    // Border widths
    const bw = style.borderWidth;
    if (bw && bw !== '0px') {
      borderWidths.add(bw);
    }
  });

  // Format output
  const colorEntries = [];
  colors.forEach((count, key) => {
    const [value, property] = key.split('::');
    colorEntries.push({ value, property, selector: '', count });
  });

  const fontEntries = Array.from(fonts.values());

  const spacingEntries = [];
  spacing.forEach((count, value) => {
    spacingEntries.push({ value, property: 'mixed', count });
  });

  return {
    colors: colorEntries.sort((a, b) => b.count - a.count),
    fonts: fontEntries.sort((a, b) => b.charCount - a.charCount),
    spacing: spacingEntries.sort((a, b) => b.count - a.count),
    cssVars,
    shadows: Array.from(shadows),
    borderRadii: Array.from(radii),
    borderWidths: Array.from(borderWidths),
    classNames: Array.from(classNames),
    url: window.location.href
  };
})()
  `.trim()
}
