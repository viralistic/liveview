import BoringAvatar from 'boring-avatars';
import { Play } from 'lucide-react';
import type { User } from '../../data/types';
import { openVideo } from '../../stores/session';
import s from './ui.module.css';

export function Avatar({ user, size = 28, ring, online, title }: { user: User; size?: number; ring?: boolean; online?: boolean; title?: string }) {
  const face = (
    <span
      className={[s.avatar, ring ? s.avatarRing : '', online ? s.avatarOnline : ''].join(' ')}
      style={{ width: size, height: size, ['--ring-color' as string]: user.color }}
      title={title ?? user.name}
    >
      {user.photo ? <img src={user.photo} alt="" width={size} height={size} loading="lazy" /> : <BoringAvatar name={user.name} variant="beam" size={size} colors={user.avatarColors} />}
      {user.video && (
        <span className={s.avatarPlay} aria-hidden="true">
          <Play fill="currentColor" strokeWidth={0} />
        </span>
      )}
    </span>
  );
  if (!user.video) return face;
  return (
    <button
      type="button"
      className={s.avatarBtn}
      aria-label={`Play ${user.name}'s video`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openVideo(user.video!, user.name);
      }}
    >
      {face}
    </button>
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
