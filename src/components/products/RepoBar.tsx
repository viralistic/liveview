import { FolderGit2, GitBranch, GitCommitHorizontal, GitFork, Lock, Star, Tag } from 'lucide-react';
import type { Product } from '../../data/types';
import { fmtInt } from '../../lib/format';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import s from './products.module.css';

/**
 * GitHub-style repository bar under the product header: path, branch,
 * version and commit count, stars, forks and the Fork button.
 */
export function RepoBar({ product, version, commitCount, forkCount, starred, starCount, onStar, canFork, onFork }: { product: Product; version: number; commitCount: number; forkCount: number; starred: boolean; starCount: number; onStar: () => void; canFork: boolean; onFork: () => void }) {
  const { repo } = product;
  const forkBtn = (
    <Button variant="secondary" size="sm" onClick={onFork} disabled={!canFork} aria-disabled={!canFork} style={!canFork ? { pointerEvents: 'none' } : undefined}>
      <GitFork /> Fork
    </Button>
  );
  return (
    <div className={s.repo} aria-label="Repository">
      <div className={s.repoLeft}>
        <span className={s.repoPath} title="Every product is a path in one repository">
          <FolderGit2 />
          <span className={s.repoOwner}>
            {repo.owner}/{repo.name}
          </span>
          <span className={s.repoSep}>/</span>
          <span className={s.repoDir}>{repo.path}</span>
        </span>
        <span className={s.branch} title="Default branch">
          <GitBranch />
          {repo.branch}
        </span>
        <span className={s.repoMeta}>
          <span className={s.repoStat} title="Current version tag">
            <Tag />v{version}
          </span>
          <span className={s.repoDot}>·</span>
          <span className={s.repoStat} title="Commits on main">
            <GitCommitHorizontal />
            {commitCount} {commitCount === 1 ? 'commit' : 'commits'}
          </span>
        </span>
      </div>
      <div className={s.repoRight}>
        <span className={s.repoNote}>
          <Lock /> Versioned like code. Demo: not connected to GitHub.
        </span>
        <button type="button" className={s.starBtn} data-on={starred} onClick={onStar} aria-pressed={starred} title={starred ? 'Unstar' : 'Star this product'}>
          <Star />
          {starred ? 'Starred' : 'Star'}
          <b>{fmtInt(starCount)}</b>
        </button>
        <a href="#forks" className={s.forksBtn} title="Jump to forks and variants">
          <GitFork />
          {forkCount} {forkCount === 1 ? 'fork' : 'forks'}
        </a>
        {canFork ? (
          forkBtn
        ) : (
          <Tooltip label="Your role cannot fork products" side="bottom">
            {forkBtn}
          </Tooltip>
        )}
      </div>
    </div>
  );
}
