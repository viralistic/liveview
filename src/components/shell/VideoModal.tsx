import { ExternalLink } from 'lucide-react';
import { $video, closeVideo, useStore } from '../../stores/session';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

function embedUrl(url: string): string {
  const m = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu\.be\/([^?]+)/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0` : url;
}

/** Opens when someone clicks an avatar that has a video attached. */
export function VideoModal() {
  const v = useStore($video);
  if (!v) return null;
  return (
    <Modal open onClose={closeVideo} title={v.title} width={760}>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <iframe
          src={embedUrl(v.url)}
          title={v.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
        <span>If the video does not play here, open it on YouTube.</span>
        <Button size="sm" variant="secondary" href={v.url} target="_blank" rel="noreferrer">
          <ExternalLink /> Open on YouTube
        </Button>
      </div>
    </Modal>
  );
}
