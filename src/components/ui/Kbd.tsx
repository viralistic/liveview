import s from './ui.module.css';
export function Kbd({ children }: { children: string }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}
