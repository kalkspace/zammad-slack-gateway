declare namespace Zammad {
  export interface Webhook {
    ticket: ExpandedTicket;
    article: ExpandedArticle;
  }

  export interface Ticket {
    article_count: number;
    article_ids: number[];
    create_article_sender: string;
    create_article_sender_id: number;
    create_article_type: string;
    create_article_type_id: number;
    created_at: string;
    created_by_id: number;
    customer_id: number;
    first_response_at: string;
    group_id: number;
    id: number;
    last_contact_agent_at: string;
    last_contact_at: string;
    last_owner_update_at: string;
    number: string;
    organization_id: number;
    owner_id: number;
    preferences: Preferences;
    priority: Priority;
    priority_id: number;
    state: string;
    state_id: number;
    title: string;
    updated_at: string;
    updated_by_id: number;
  }

  export interface ExpandedTicket extends Ticket {
    created_by: User;
    customer: User;
    group: Group;
    owner: User;
    organization: Organization;
    updated_by: User;
  }

  export interface User {
    active: boolean;
    address: string;
    city: string;
    country: string;
    created_at: string;
    created_by: string;
    created_by_id: number;
    department: string;
    email: string;
    fax: string;
    firstname: string;
    id: number;
    image: string | null;
    image_source: string | null;
    lastname: string;
    login: string;
    mobile: string;
    note: string;
    organization: string;
    organization_id: number;
    out_of_office: boolean;
    phone: string;
    role_ids: number[];
    roles: string[];
    street: string;
    updated_at: string;
    updated_by: string;
    updated_by_id: number;
    verified: boolean;
    vip: boolean;
    web: string;
    zip: string;
  }

  export interface Group {
    active: boolean;
    created_at: string;
    created_by: string;
    created_by_id: number;
    email_address_id: number;
    follow_up_assignment: boolean;
    follow_up_possible: string;
    id: number;
    name: string;
    note: string;
    shared_drafts: boolean;
    signature: string;
    signature_id: number;
    updated_at: string;
    updated_by: string;
    updated_by_id: number;
    user_ids: number[];
    users: string[];
  }

  export interface Organization {
    active: boolean;
    created_at: string;
    created_by: string;
    created_by_id: number;
    domain: string;
    domain_assignment: boolean;
    id: number;
    member_ids: number[];
    members: string[];
    name: string;
    note: string;
    shared: boolean;
    updated_at: string;
    updated_by: string;
    updated_by_id: number;
  }

  export interface Preferences {
    channel_id: number;
  }

  export interface Priority {
    active: boolean;
    created_at: string;
    created_by: string;
    created_by_id: number;
    default_create: boolean;
    id: number;
    name: string;
    note: any;
    ui_color: any;
    ui_icon: any;
    updated_at: string;
    updated_by: string;
    updated_by_id: number;
  }

  export interface Article {
    attachments: any[];
    body: string;
    cc: any;
    content_type: string;
    created_at: string;
    created_by_id: number;
    from: string;
    id: number;
    internal: boolean;
    message_id: string;
    message_id_md5: string;
    preferences: Preferences;
    sender: string;
    sender_id: number;
    subject: string;
    ticket_id: number;
    to: string;
    type: string;
    type_id: number;
    updated_at: string;
    updated_by_id: number;
    accounted_time: number;
  }

  export interface ExpandedArticle extends Article {
    created_by: User;
    updated_by: User;
  }

  export interface Preferences {
    "send-auto-response"?: boolean;
    "is-auto-response"?: boolean;
    channel_id?: number;
    slack_ts?: string;
  }
}

// hotfix for html-to-text types
declare type HtmlToTextOptionsExtended = {
  encodeCharacters?: Record<string, string> | ((str: string) => string);
} & import("html-to-text").HtmlToTextOptions;
