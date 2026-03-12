/**
 * Detect CSS frameworks from class names and CSS custom properties.
 * If detected, we can shortcut much of the extraction.
 */

interface FrameworkDetection {
  name: string
  confidence: number
  version?: string
}

const FRAMEWORK_SIGNATURES: Record<string, { classes: RegExp[]; vars: RegExp[] }> = {
  tailwind: {
    classes: [/^(sm|md|lg|xl|2xl):/, /^(flex|grid|block|inline)$/, /^(mt|mb|ml|mr|px|py)-\d/, /^bg-(red|blue|green|gray)-\d{2,3}$/, /^text-(xs|sm|base|lg|xl)/],
    vars: [/^--tw-/],
  },
  bootstrap: {
    classes: [/^btn-/, /^col-(sm|md|lg|xl)-\d/, /^navbar/, /^container(-fluid)?$/, /^row$/],
    vars: [/^--bs-/],
  },
  'material-ui': {
    classes: [/^Mui/, /^css-[a-z0-9]+$/, /^MuiButton/, /^MuiTypography/],
    vars: [/^--mui-/],
  },
  chakra: {
    classes: [/^chakra-/, /^css-[a-z0-9]+$/],
    vars: [/^--chakra-/],
  },
  'ant-design': {
    classes: [/^ant-/, /^ant-btn/, /^ant-layout/],
    vars: [/^--ant-/],
  },
  bulma: {
    classes: [/^is-(primary|link|info|success|warning|danger)$/, /^column$/, /^columns$/, /^hero$/],
    vars: [/^--bulma-/],
  },
  shadcn: {
    classes: [/^(inline-flex|rounded-md)$/, /^(destructive|outline|secondary|ghost|link)$/],
    vars: [/^--radius$/, /^--primary$/, /^--card$/, /^--popover$/],
  },
}

export function detectFramework(
  classNames: string[],
  cssVars: Record<string, string>
): FrameworkDetection | null {
  const varNames = Object.keys(cssVars)
  let bestMatch: FrameworkDetection | null = null
  let bestScore = 0

  for (const [name, sigs] of Object.entries(FRAMEWORK_SIGNATURES)) {
    let classHits = 0
    let varHits = 0

    for (const cls of classNames) {
      if (sigs.classes.some(re => re.test(cls))) classHits++
    }

    for (const v of varNames) {
      if (sigs.vars.some(re => re.test(v))) varHits++
    }

    // Normalize to 0-1
    const classScore = classNames.length > 0
      ? Math.min(classHits / Math.min(classNames.length, 20), 1)
      : 0
    const varScore = varNames.length > 0
      ? Math.min(varHits / Math.min(varNames.length, 10), 1)
      : 0

    const score = classScore * 0.6 + varScore * 0.4

    if (score > bestScore && score > 0.15) {
      bestScore = score
      bestMatch = {
        name,
        confidence: Math.round(score * 100) / 100,
      }
    }
  }

  return bestMatch
}
