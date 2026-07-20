import type { ButtonHTMLAttributes } from 'react'

/**
 * Tombol terstandar ui-ux-pro-max. Varian & ukuran memetakan ke kelas komponen
 * `.btn-*` di index.css (target sentuh ≥44px, transisi + umpan-balik tekan dari
 * baseline global, warna dari token tema).
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'quiet'
  | 'danger'
  | 'danger-outline'
export type ButtonSize = 'md' | 'sm' | 'icon'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
  'danger-outline': 'btn-danger-outline',
}

const SIZE: Record<ButtonSize, string> = {
  md: '',
  sm: 'btn-sm',
  icon: 'btn-icon',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  ...rest
}: Props) {
  const cls = [VARIANT[variant], SIZE[size], className].filter(Boolean).join(' ')
  return <button type={type} className={cls} {...rest} />
}
