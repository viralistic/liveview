import { useState } from 'react';
import { ChevronDown, ChevronUp, GitCompare, GitMerge, History } from 'lucide-react';
import type { Commit } from '../../data/types';
import { userById } from '../../data/users';
import { relTime } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../ui/Card';
import s from './products.module.css';

const SHOW = 6;

/** Commit history of a product: sha, message, author, time and version tags. */
export function VersionHistory({ commits, version }: { commits: Commit[]; version: number }) {
  const [all, setAll] = useState(false);
  const list = all ? commits : commits.slice(0, SHOW);
  const prevTagged = commits.find((c) => c.version !== undefined && c.version < version);
  const sinceCount = prevTagged ? commits.filter((c) => c.at > prevTagged.at).length : commits.length;

  return (
    <Card>
      <CardHeader title="Versions" sub={`v${version} · ${commits.length} ${commits.length === 1 ? 'commit' : 'commits'} on main`} icon={<History />} />
      <CardBody flush>
        <ol className={s.commits}>
          {list.map((c) => {
            const author = userById(c.authorId);
            const current = c.version === version;
            return (
              <li key={c.sha} className={s.commit} data-current={current} data-merge={!!c.forkId}>
                <code className={s.sha} title="Short sha">
                  {c.sha}
                </code>
                <div className={s.commitMain}>
                  <div className={s.commitMsg}>
                    {c.forkId && <GitMerge className={s.commitMergeIcon} />}
                    {c.message}
                  </div>
                  <div className={s.commitMeta}>
                    <Avatar user={author} size={16} />
                    {author.name.split(' ')[0]}
                    <span className={s.metaDot}>·</span>
                    {relTime(c.at)}
                  </div>
                </div>
                {c.version !== undefined && (
                  <span className={s.vtag} data-current={current} title={current ? 'Current version' : `Version ${c.version}`}>
                    v{c.version}
                    {current && <small>current</small>}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </CardBody>
      <CardFooter>
        <span className={s.compareHint} title="Compare two versions (demo)">
          <GitCompare />
          {prevTagged ? (
            <>
              Compare v{prevTagged.version}…v{version}: {sinceCount} {sinceCount === 1 ? 'commit' : 'commits'}
            </>
          ) : (
            <>Compare: pick two versions</>
          )}
        </span>
        {commits.length > SHOW && (
          <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? (
              <>
                <ChevronUp /> Show less
              </>
            ) : (
              <>
                <ChevronDown /> Show all {commits.length}
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
