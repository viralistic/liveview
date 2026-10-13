import type { Comment } from './types';
import { hoursAgo, minutesAgo, daysAgo } from '../lib/format';

export const COMMENTS: Comment[] = [
  {
    id: 'cm1',
    workflowId: 'vw-dealer-lead-routing',
    nodeId: 'hsN',
    authorId: 'u-lotte',
    body: 'Since this morning our dealers are not receiving any leads. Is that related to the red area here?',
    createdAt: minutesAgo(48),
    resolved: false,
    replies: [
      {
        authorId: 'u-marrallisa',
        body: 'Yes. The HubSpot token expired at 06:12. Re-authenticating now and I will replay the failed executions.',
        createdAt: minutesAgo(31),
      },
    ],
  },
  {
    id: 'cm2',
    workflowId: 'tr-stock-sync',
    nodeId: 'loop',
    authorId: 'u-milan',
    body: 'This takes 40+ minutes per run now that we have 2,400 SKUs. Can we batch the updates?',
    createdAt: hoursAgo(9),
    resolved: false,
    replies: [
      {
        authorId: 'u-finn',
        body: 'Yes, Woo has a batch endpoint (100 per call). I can switch this to an HTTP Request tomorrow.',
        createdAt: hoursAgo(8),
      },
    ],
  },
  {
    id: 'cm3',
    workflowId: 'vir-content-pipeline',
    nodeId: 'set2',
    authorId: 'u-daan',
    body: 'Rename these Set nodes before we hand this over to the content team.',
    createdAt: daysAgo(1),
    resolved: false,
    replies: [],
  },
  {
    id: 'cm4',
    workflowId: 'vw-test-drive-booking',
    nodeId: 'cal',
    authorId: 'u-sara',
    body: 'Marketing reports a 6s spinner on the booking widget. Parallel calendar lookups?',
    createdAt: daysAgo(3),
    resolved: true,
    replies: [{ authorId: 'u-finn', body: 'On my list for the sprint.', createdAt: daysAgo(2) }],
  },
];
