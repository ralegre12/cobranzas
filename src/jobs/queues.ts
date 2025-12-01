export const Q_CAMPAIGN_KICK = 'campaign-kick';
export const Q_CAMPAIGN_DISPATCH = 'campaign-dispatch';
export const Q_MESSAGE_SEND = 'message-send';
export const Q_NLP_INBOUND = 'nlp-inbound';

export type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL';

/** Forma A (preferida por import): referenciar el Message ya creado */
export type MessageSendJobById = {
  messageId: string; // UUID de messages.id
  channel: Channel;
};

/** Forma B (fallback): payload completo */
export type MessageSendJobFull = {
  tenantId: number;
  caseId: string; // UUID
  channel: Channel;
  templateCode: string;
  variables: Record<string, string>;
  to: string; // e164 o email
};

export type MessageSendJob = MessageSendJobById | MessageSendJobFull;

export type NlpInboundJob = {
  tenantId: number | string;
  channel: Channel;
  from: string;
  text: string;
  caseId?: string;
  contactId?: string;
  providerId?: string;
  timestamp?: number;
  raw?: any;
};

export type CampaignKickJob = { campaignId: string };
export type CampaignDispatchJob = {
  campaignId: string;
  caseId: string;
  channels: Channel[];
  templateCode: string;
};
