/**
 * Node type registry: label, lucide icon name and brand color.
 * Colors follow n8n's node icon palette where one exists.
 */
export type NodeKind = 'trigger' | 'action' | 'logic' | 'ai' | 'flow';

export interface NodeTypeDef {
  id: string;
  label: string;
  icon: string; // lucide-react export name
  color: string;
  kind: NodeKind;
}

const T = (id: string, label: string, icon: string, color: string, kind: NodeKind): NodeTypeDef => ({ id, label, icon, color, kind });

export const NODE_TYPES: Record<string, NodeTypeDef> = Object.fromEntries(
  [
    // triggers
    T('webhook', 'Webhook', 'Webhook', '#ff6d5a', 'trigger'),
    T('schedule', 'Schedule Trigger', 'Clock', '#31c4ab', 'trigger'),
    T('manual', 'Manual Trigger', 'MousePointerClick', '#7d7d87', 'trigger'),
    T('formTrigger', 'Form Trigger', 'ClipboardList', '#ff6d5a', 'trigger'),
    T('gmailTrigger', 'Gmail Trigger', 'MailOpen', '#ea4335', 'trigger'),
    T('executeWorkflowTrigger', 'When Executed by Another Workflow', 'Workflow', '#ff6d5a', 'trigger'),
    T('errorTrigger', 'Error Trigger', 'TriangleAlert', '#e44d26', 'trigger'),
    T('woocommerceTrigger', 'WooCommerce Trigger', 'ShoppingCart', '#96588a', 'trigger'),
    T('chatTrigger', 'Chat Trigger', 'MessageSquare', '#7b61ff', 'trigger'),
    T('mcpTrigger', 'MCP Server Trigger', 'Plug', '#7b61ff', 'trigger'),
    // apps
    T('gmail', 'Gmail', 'Mail', '#ea4335', 'action'),
    T('slack', 'Slack', 'Hash', '#4a154b', 'action'),
    T('hubspot', 'HubSpot', 'Orbit', '#ff7a59', 'action'),
    T('sheets', 'Google Sheets', 'Table2', '#0f9d58', 'action'),
    T('postgres', 'Postgres', 'Database', '#336791', 'action'),
    T('mysql', 'MySQL', 'Database', '#00758f', 'action'),
    T('http', 'HTTP Request', 'Globe', '#3a42e9', 'action'),
    T('openai', 'OpenAI', 'Sparkles', '#111111', 'ai'),
    T('agent', 'AI Agent', 'Bot', '#7b61ff', 'ai'),
    T('shopify', 'Shopify', 'ShoppingBag', '#96bf48', 'action'),
    T('woocommerce', 'WooCommerce', 'ShoppingCart', '#96588a', 'action'),
    T('notion', 'Notion', 'FileText', '#111111', 'action'),
    T('airtable', 'Airtable', 'Grid3x3', '#18bfff', 'action'),
    T('telegram', 'Telegram', 'Send', '#2ca5e0', 'action'),
    T('twilio', 'Twilio', 'Phone', '#f22f46', 'action'),
    T('whatsapp', 'WhatsApp Business', 'MessageCircle', '#25d366', 'action'),
    T('sendgrid', 'SendGrid', 'MailCheck', '#1a82e2', 'action'),
    T('stripe', 'Stripe', 'CreditCard', '#635bff', 'action'),
    T('googleCalendar', 'Google Calendar', 'CalendarDays', '#4285f4', 'action'),
    T('googleDrive', 'Google Drive', 'HardDrive', '#fbbc04', 'action'),
    T('moneybird', 'Moneybird', 'Receipt', '#1e73be', 'action'),
    T('exact', 'Exact Online', 'Receipt', '#e2001a', 'action'),
    T('linkedin', 'LinkedIn', 'Briefcase', '#0a66c2', 'action'),
    T('wordpress', 'WordPress', 'Newspaper', '#21759b', 'action'),
    T('postnl', 'PostNL', 'Truck', '#f56900', 'action'),
    T('sap', 'SAP', 'Boxes', '#0faaff', 'action'),
    T('statuspage', 'Statuspage', 'Radio', '#1a1a1a', 'action'),
    T('pdf', 'Convert to PDF', 'FileText', '#7d7d87', 'action'),
    // logic / flow
    T('set', 'Edit Fields', 'PenLine', '#3a42e9', 'logic'),
    T('code', 'Code', 'Braces', '#7d7d87', 'logic'),
    T('if', 'If', 'Split', '#408000', 'logic'),
    T('switch', 'Switch', 'GitBranch', '#506000', 'logic'),
    T('merge', 'Merge', 'GitMerge', '#00bbcc', 'logic'),
    T('filter', 'Filter', 'Filter', '#229eff', 'logic'),
    T('aggregate', 'Aggregate', 'Layers', '#229eff', 'logic'),
    T('loop', 'Loop Over Items', 'Repeat', '#007755', 'flow'),
    T('wait', 'Wait', 'Hourglass', '#804050', 'flow'),
    T('executeWorkflow', 'Execute Workflow', 'Workflow', '#ff6d5a', 'flow'),
    T('respondWebhook', 'Respond to Webhook', 'Reply', '#4b4b4b', 'flow'),
    T('dateTime', 'Date & Time', 'CalendarClock', '#408000', 'logic'),
    T('compare', 'Compare Datasets', 'Shuffle', '#229eff', 'logic'),
    T('stopAndError', 'Stop and Error', 'OctagonX', '#e44d26', 'flow'),
    T('noOp', 'No Operation', 'Circle', '#b0b0b0', 'flow'),
  ].map((d) => [d.id, d]),
);

export function nodeType(id: string): NodeTypeDef {
  return NODE_TYPES[id] ?? { id, label: id, icon: 'Box', color: '#7d7d87', kind: 'action' };
}
