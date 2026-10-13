/** Floating bottom toolbar, Figma-like. */
import { useStore } from '@nanostores/react';
import { Flame, Hand, Maximize2, MessageCirclePlus, Minus, MousePointer2, Plus, Waypoints, Globe } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { $viewport } from './viewport';
import type { Tool } from './types';
import s from './canvas.module.css';

export interface ToolbarProps {
  tool: Tool;
  onTool: (t: Tool) => void;
  heat: boolean;
  onHeat: () => void;
  connections: boolean;
  onConnections: () => void;
  sources: boolean;
  onSources: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFit: () => void;
}

export function Toolbar({ tool, onTool, heat, onHeat, connections, onConnections, sources, onSources, onZoomIn, onZoomOut, onZoomReset, onFit }: ToolbarProps) {
  const vp = useStore($viewport);
  return (
    <div className={s.toolbar} data-ui role="toolbar" aria-label="Canvas tools">
      <Tooltip label="Move" kbd="V">
        <button type="button" className={s.tbBtn} data-active={tool === 'move'} onClick={() => onTool('move')} aria-label="Move tool">
          <MousePointer2 />
        </button>
      </Tooltip>
      <Tooltip label="Hand" kbd="H">
        <button type="button" className={s.tbBtn} data-active={tool === 'hand'} onClick={() => onTool('hand')} aria-label="Hand tool">
          <Hand />
        </button>
      </Tooltip>
      <Tooltip label="Comment" kbd="C">
        <button type="button" className={s.tbBtn} data-active={tool === 'comment'} onClick={() => onTool('comment')} aria-label="Comment tool">
          <MessageCirclePlus />
        </button>
      </Tooltip>
      <span className={s.sep} />
      <Tooltip label={heat ? 'Hide health heatmap' : 'Show health heatmap'}>
        <button type="button" className={s.tbBtn} data-on={heat} onClick={onHeat} aria-pressed={heat} aria-label="Health heatmap">
          <Flame />
        </button>
      </Tooltip>
      <Tooltip label={connections ? 'Hide workflow connections' : 'Show workflow connections'}>
        <button type="button" className={s.tbBtn} data-on={connections} onClick={onConnections} aria-pressed={connections} aria-label="Connections">
          <Waypoints />
        </button>
      </Tooltip>
      <Tooltip label={sources ? 'Hide sources' : 'Show sources'}>
        <button type="button" className={s.tbBtn} data-on={sources} onClick={onSources} aria-pressed={sources} aria-label="Sources">
          <Globe />
        </button>
      </Tooltip>
      <span className={s.sep} />
      <Tooltip label="Zoom out" kbd="-">
        <button type="button" className={s.tbBtn} onClick={onZoomOut} aria-label="Zoom out">
          <Minus />
        </button>
      </Tooltip>
      <Tooltip label="Zoom to 100%" kbd="0">
        <button type="button" className={s.zoomPct} onClick={onZoomReset}>
          {Math.round(vp.z * 100)}%
        </button>
      </Tooltip>
      <Tooltip label="Zoom in" kbd="+">
        <button type="button" className={s.tbBtn} onClick={onZoomIn} aria-label="Zoom in">
          <Plus />
        </button>
      </Tooltip>
      <Tooltip label="Fit everything" kbd="⇧1">
        <button type="button" className={s.fitBtn} onClick={onFit}>
          <Maximize2 /> Fit
        </button>
      </Tooltip>
    </div>
  );
}
