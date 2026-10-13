import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import s from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'brand' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

interface Base {
  variant?: Variant;
  size?: Size;
  icon?: boolean;
  children?: ReactNode;
  className?: string;
}
type ButtonProps = Base & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = Base & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'secondary', size = 'md', icon, className, children, ...rest } = props as Base & Record<string, unknown>;
  const cls = [s.btn, s[variant], size !== 'md' ? s[size] : '', icon ? s.icon : '', className ?? ''].join(' ');
  if ('href' in rest && typeof rest.href === 'string') {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
