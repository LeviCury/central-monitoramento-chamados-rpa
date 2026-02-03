export interface Metric {
  id: string;
  name: string;
  value: number;
  previous_value: number;
  change_percentage: number;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface SalesData {
  id: string;
  date: string;
  category: string;
  revenue: number;
  quantity: number;
  region: string;
  product: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  active: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  title: string;
  entity: string;
  assigned_technician: string;
  status: string;
  opened_date: string;
  updated_date: string;
  resolved_date: string | null;
  requester: string;
  priority: string;
  tags: string;
  technical_group: string;
  resolution_time_hours: number | null;
  created_at: string;
}

export interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  statuses: string[];
  priorities: string[];
  technicians: string[];
}
