import type { Credential } from './types';
import { daysAgo, hoursAgo, minutesAgo } from '../lib/format';

const c = (
  id: string,
  name: string,
  type: string,
  typeLabel: string,
  ownerId: string,
  companyId: string | null,
  usedBy: string[],
  lastUsedAt: string,
  createdAt: string,
  status: Credential['status'] = 'valid',
  expiresAt?: string,
): Credential => ({ id, name, type, typeLabel, ownerId, companyId, usedBy, lastUsedAt, createdAt, status, expiresAt });

export const CREDENTIALS: Credential[] = [
  c('cred-hubspot-vw', 'HubSpot · Volkswagen', 'hubspot', 'HubSpot OAuth2', 'u-sara', 'volkswagen', ['vw-dealer-lead-routing', 'vw-lead-scoring', 'vw-crm-sync'], minutesAgo(2), daysAgo(220), 'expired', hoursAgo(8.3)),
  c('cred-hubspot-vir', 'HubSpot · Viralistic', 'hubspot', 'HubSpot OAuth2', 'u-marrallisa', 'viralistic', ['vir-lead-intake', 'vir-lead-enrich'], minutesAgo(4), daysAgo(600)),
  c('cred-openai', 'OpenAI · agency key', 'openai', 'OpenAI API', 'u-daan', null, ['vir-lead-enrich', 'vir-content-pipeline', 'vw-lead-scoring', 'tr-quote-requests', 'tr-abandoned-cart', 'ho-support-triage'], minutesAgo(1), daysAgo(410)),
  c('cred-gmail-sales', 'Gmail · sales@viralistic.nl', 'gmail', 'Gmail OAuth2', 'u-marrallisa', 'viralistic', ['vir-lead-intake', 'vir-invoicing', 'vir-report-render'], minutesAgo(9), daysAgo(590)),
  c('cred-gmail-vw', 'Gmail · leads@vw-dealers.nl', 'gmail', 'Gmail OAuth2', 'u-sara', 'volkswagen', ['vw-dealer-lead-routing', 'vw-test-drive-booking', 'vw-service-reminders'], minutesAgo(2), daysAgo(218)),
  c('cred-gmail-tr', 'Gmail · info@transmissies.nl', 'gmail', 'Gmail OAuth2', 'u-milan', 'transmissies', ['tr-order-processing', 'tr-quote-requests', 'tr-shipping-notifications'], minutesAgo(6), daysAgo(115)),
  c('cred-gmail-ho', 'Gmail · support@hoasted.com', 'gmail', 'Gmail OAuth2', 'u-tom', 'hoasted', ['ho-ssl-expiry', 'ho-support-triage', 'ho-invoice-dunning'], minutesAgo(12), daysAgo(60)),
  c('cred-slack-vir', 'Slack · Viralistic workspace', 'slack', 'Slack API', 'u-marrallisa', 'viralistic', ['vir-lead-intake', 'vir-content-pipeline', 'vir-client-reporting', 'vir-slack-alerts', 'tr-order-processing'], minutesAgo(4), daysAgo(600)),
  c('cred-slack-vw', 'Slack · VW dealer ops', 'slack', 'Slack API', 'u-sara', 'volkswagen', ['vw-lead-scoring', 'vw-crm-sync', 'vw-parts-inventory-alerts'], minutesAgo(3), daysAgo(210)),
  c('cred-slack-ho', 'Slack · Hoasted', 'slack', 'Slack API', 'u-tom', 'hoasted', ['ho-uptime-incidents', 'ho-support-triage'], minutesAgo(40), daysAgo(59)),
  c('cred-postgres-vir', 'Postgres · agency analytics', 'postgres', 'Postgres', 'u-daan', 'viralistic', ['vir-invoicing'], daysAgo(12), daysAgo(500)),
  c('cred-postgres-vw', 'Postgres · VW after-sales', 'postgres', 'Postgres', 'u-sara', 'volkswagen', ['vw-service-reminders', 'vw-nps-survey'], hoursAgo(6.5), daysAgo(200)),
  c('cred-postgres-ho', 'Postgres · hosting inventory', 'postgres', 'Postgres', 'u-tom', 'hoasted', ['ho-ssl-expiry'], hoursAgo(11.5), daysAgo(58)),
  c('cred-mysql-vw', 'MySQL · dealer DMS replica', 'mysql', 'MySQL', 'u-finn', 'volkswagen', ['vw-crm-sync'], minutesAgo(3), daysAgo(190)),
  c('cred-exact', 'Exact Online · Transmissies.nl', 'exact', 'Exact Online OAuth2', 'u-milan', 'transmissies', ['tr-order-processing', 'tr-stock-sync', 'tr-review-requests'], minutesAgo(1), daysAgo(114), 'expiring', daysAgo(-6)),
  c('cred-woo', 'WooCommerce · transmissies.nl', 'woocommerce', 'WooCommerce API', 'u-milan', 'transmissies', ['tr-order-processing', 'tr-stock-sync', 'tr-shipping-notifications', 'tr-abandoned-cart'], minutesAgo(1), daysAgo(114)),
  c('cred-twilio-vw', 'Twilio · VW notifications', 'twilio', 'Twilio', 'u-sara', 'volkswagen', ['vw-dealer-lead-routing', 'vw-service-reminders'], minutesAgo(2), daysAgo(210)),
  c('cred-sendgrid-tr', 'SendGrid · Transmissies.nl', 'sendgrid', 'SendGrid API', 'u-milan', 'transmissies', ['tr-review-requests', 'tr-abandoned-cart', 'vw-nps-survey'], hoursAgo(1), daysAgo(100)),
  c('cred-moneybird', 'Moneybird · Viralistic', 'moneybird', 'Moneybird OAuth2', 'u-eva', 'viralistic', ['vir-invoicing'], daysAgo(12), daysAgo(560)),
  c('cred-moneybird-ho', 'Moneybird · Hoasted', 'moneybird', 'Moneybird OAuth2', 'u-tom', 'hoasted', ['ho-invoice-dunning'], daysAgo(2), daysAgo(40)),
  c('cred-airtable', 'Airtable · personal access token', 'airtable', 'Airtable PAT', 'u-marrallisa', null, ['vir-social-scheduler', 'tr-quote-requests'], minutesAgo(6), daysAgo(300)),
  c('cred-notion', 'Notion · Viralistic integration', 'notion', 'Notion API', 'u-daan', null, ['vir-content-pipeline', 'ho-support-triage'], minutesAgo(12), daysAgo(280)),
  c('cred-gcal-vw', 'Google Calendar · dealer calendars', 'googleCalendar', 'Google Calendar OAuth2', 'u-sara', 'volkswagen', ['vw-test-drive-booking'], minutesAgo(7), daysAgo(205)),
  c('cred-gdrive', 'Google Drive · reports', 'googleDrive', 'Google Drive OAuth2', 'u-marrallisa', 'viralistic', ['vir-report-render'], hoursAgo(31), daysAgo(400)),
  c('cred-sheets', 'Google Sheets · agency', 'sheets', 'Google Sheets OAuth2', 'u-marrallisa', null, ['vir-invoicing', 'vir-client-reporting', 'vw-parts-inventory-alerts', 'vw-nps-survey', 'tr-stock-sync'], minutesAgo(1), daysAgo(580)),
  c('cred-postnl', 'PostNL · tracking API', 'postnl', 'API key', 'u-milan', 'transmissies', ['tr-shipping-notifications'], minutesAgo(5), daysAgo(90)),
  c('cred-whatsapp', 'WhatsApp Business · Transmissies', 'whatsapp', 'WhatsApp Business Cloud', 'u-milan', 'transmissies', ['tr-shipping-notifications'], minutesAgo(5), daysAgo(88), 'expiring', daysAgo(-19)),
  c('cred-telegram', 'Telegram · alerts bot', 'telegram', 'Telegram Bot', 'u-daan', null, ['vir-social-scheduler', 'tr-quote-requests', 'ho-uptime-incidents'], minutesAgo(6), daysAgo(350)),
  c('cred-statuspage', 'Statuspage · Hoasted', 'statuspage', 'API key', 'u-tom', 'hoasted', ['ho-uptime-incidents'], hoursAgo(3), daysAgo(55)),
];

export const credentialById = (id: string): Credential | undefined => CREDENTIALS.find((c) => c.id === id);
