import BoringAvatar from 'boring-avatars';
import type { User } from '../../data/types';
import s from './ui.module.css';

export function Avatar({ user, size = 28, ring, online, title }: { user: User; size?: number; ring?: boolean; online?: boolean; title?: string }) {
  return (
    <span
      className={[s.avatar, ring ? s.avatarRing : '', online ? s.avatarOnline : ''].join(' ')}
      style={{ width: size, height: size, ['--ring-color' as string]: user.color }}
      title={title ?? user.name}
    >
      <BoringAvatar name={user.name} variant="beam" size={size} colors={user.avatarColors} />
    </span>
  );
}

export function AvatarGroup({ users, size = 24, max = 4 }: { users: User[]; size?: number; max?: number }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <span className={s.avatarGroup}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {rest > 0 && (
        <span className={s.avatarMore} style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </span>
  );
}
