import { nodeType } from '../../data/nodeTypes';
import { iconByName } from './icons';
import s from './ui.module.css';

/** n8n-style node glyph: white rounded square with the service's brand-colored icon. */
export function NodeIcon({ type, size = 28, filled, style, title }: { type: string; size?: number; filled?: boolean; style?: React.CSSProperties; title?: string }) {
  const def = nodeType(type);
  const Icon = iconByName(def.icon);
  return (
    <span
      className={[s.nodeIcon, filled ? s.nodeIconFilled : ''].join(' ')}
      style={{ width: size, height: size, color: def.color, background: filled ? def.color : undefined, borderRadius: Math.max(6, size * 0.28), ...style }}
      title={title ?? def.label}
    >
      <Icon strokeWidth={size > 40 ? 1.75 : 2} />
    </span>
  );
}
