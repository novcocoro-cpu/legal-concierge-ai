export interface Company {
  id:         string;
  name:       string;
  created_at: string;
}

export interface Member {
  id:         string;
  company_id: string;
  name:       string;
  created_at: string;
}

export type Priority = 'high' | 'medium' | 'low';

export interface ActionItem {
  task:      string;
  assignee:  string;
  deadline:  string; // YYYY-MM-DD
  priority:  Priority;
}

export interface NextMeeting {
  suggested_timing: string;
  agenda:           string[];
  notes:            string;
}

export interface Meeting {
  id:               string;
  user_id:          string;
  user_name:        string;
  company_name:     string;
  company_id?:      string;
  member_id?:       string;
  title:            string;
  transcript:       string;
  summary:          string;
  problems:         string[];
  improvements:     string[];
  action_plan:      ActionItem[];
  next_meeting:     NextMeeting;
  duration_seconds: number;
  created_at:       string;
}

export interface LitigationRisk {
  level:       string;  // 高・中・低
  description: string;
  factors:     string[];
}

export interface NegotiationStrategy {
  approach:             string;
  psychological_notes:  string;
  key_points:           string[];
}

export interface GeminiResult {
  title:                  string;
  transcript:             string;
  summary:                string;
  problems:               string[];
  improvements:           string[];
  action_plan:            ActionItem[];
  next_meeting:           NextMeeting;
  litigation_risk?:       LitigationRisk;
  negotiation_strategy?:  NegotiationStrategy;
}

export interface ErrorLog {
  id:            string;
  occurred_at:   string;
  error_message: string;
  process_type:  string;
  device_info:   string | null;
  browser_info:  string | null;
  user_agent:    string | null;
  created_at:    string;
}
