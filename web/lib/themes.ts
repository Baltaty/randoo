export type ThemeName =
  | 'default'
  | 'light'
  | 'classic'
  | 'pink'
  | 'brat'
  | 'dawn'
  | 'heart'
  | 'halloween'

export interface ThemeDef {
  name: ThemeName
  label: string
  accent: string // used for selector dot + active bg
  dark: boolean  // true = dark background
}

export const THEMES: ThemeDef[] = [
  { name: 'default',   label: 'Default',   accent: '#ffd53a', dark: true  },
  { name: 'light',     label: 'Light',     accent: '#444444', dark: false },
  { name: 'classic',   label: 'Classic',   accent: '#ffd53a', dark: true  },
  { name: 'pink',      label: 'Pink',      accent: '#ff66b3', dark: true  },
  { name: 'brat',      label: 'Brat',      accent: '#3aff43', dark: true  },
  { name: 'dawn',      label: 'Dawn',      accent: '#f97316', dark: false },
  { name: 'heart',     label: 'Heart',     accent: '#f02031', dark: true  },
  { name: 'halloween', label: 'Halloween', accent: '#ff6b00', dark: true  },
]

/** Returns true if hex color is light (needs dark text on top) */
export function isLightAccent(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150
}
