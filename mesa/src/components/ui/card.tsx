import type { ComponentProps } from 'react'

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return <div className={`mesa-cartao ${className}`} {...props} />
}

export function CardContent({ className = '', ...props }: ComponentProps<'div'>) {
  return <div className={`mesa-cartao-corpo ${className}`} {...props} />
}
