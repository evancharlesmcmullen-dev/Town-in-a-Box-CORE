// src/core/help/help.types.ts

/**
 * A help topic (FAQ, explainer) that can be attached to screens/actions.
 */
export interface HelpTopic {
  id: string;
  tenantId: string;

  code: string;              // e.g. "APRA_REQUEST_FORM"
  title: string;
  body: string;

  audience: 'citizen' | 'staff' | 'board' | 'other';
}

/**
 * An anchor linking a help topic to a route/view.
 */
export interface HelpAnchor {
  id: string;
  tenantId: string;

  route: string;             // e.g. "/apra/request/new"
  topicCode: string;
}