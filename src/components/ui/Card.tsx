import type { CSSProperties, ReactNode } from 'react';
import s from './ui.module.css';

export function Card({ children, className, style, id }: { children: ReactNode; className?: string; style?: CSSProperties; id?: string }) {
  return (
    <section id={id} className={[s.card, className ?? ''].join(' ')} style={style}>
      {children}
    </section>
  );
}
export function CardHeader({ title, sub, icon, action }: { title: ReactNode; sub?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <header className={s.cardHeader}>
      <div>
        <h3 className={s.cardTitle}>
          {icon}
          {title}
        </h3>
        {sub && <p className={s.cardSub}>{sub}</p>}
      </div>
      {action}
    </header>
  );
}
export function CardBody({ children, flush, style }: { children: ReactNode; flush?: boolean; style?: CSSProperties }) {
  return (
    <div className={[s.cardBody, flush ? s.flush : ''].join(' ')} style={style}>
      {children}
    </div>
  );
}
export function CardFooter({ children }: { children: ReactNode }) {
  return <footer className={s.cardFooter}>{children}</footer>;
}
