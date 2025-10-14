import { DayBookRecord, StockOrder } from "./daybook"

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          id: string
          name: string
          type: "factory" | "transporter"
          user_id: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          type?: "factory" | "transporter"
          user_id: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: "factory" | "transporter"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_entries: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          type: "credit" | "debit"
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          date: string
          description: string
          id?: string
          type: "credit" | "debit"
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          type?: "credit" | "debit"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      day_book_records: {
        Row: {
          created_at: string
          date: string
          record: Json | DayBookRecord
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          record: Json | DayBookRecord
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          record?: Json | DayBookRecord
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_book_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_records: {
        Row: {
          date: string
          user_id: string
          bank_reconciliation: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          date: string
          user_id: string
          bank_reconciliation?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          date?: string
          user_id?: string
          bank_reconciliation?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_received: {
        Row: {
          id: string
          date: string
          user_id: string
          account_id: string
          amount: number
          description: string | null
          receipt_number: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          user_id: string
          account_id: string
          amount: number
          description?: string | null
          receipt_number?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          user_id?: string
          account_id?: string
          amount?: number
          description?: string | null
          receipt_number?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_received_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_received_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_orders: {
        Row: StockOrder
        Insert: Omit<StockOrder, 'id' | 'created_at'>
        Update: Partial<Omit<StockOrder, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: "stock_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_all_user_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_records_for_date: {
        Args: {
          record_date: string
        }
        Returns: undefined
      }
      delete_transaction: {
        Args: {
          p_transaction_id: string
        }
        Returns: undefined
      }
      get_monthly_fuel_sales: {
        Args: Record<PropertyKey, never>
        Returns: {
          month_start: string
          total_petrol_litres: number
          total_diesel_litres: number
        }[]
      }
      get_account_sales_fluctuation: {
        Args: {
          current_month_start: string
          percentage_threshold: number
        }
        Returns: {
          account_id: string
          account_name: string
          account_type: string
          previous_month_litres: number
          current_month_litres: number
          percentage_change: number
        }[]
      }
      get_aged_outstanding_credit: {
        Args: Record<PropertyKey, never>
        Returns: {
          month_start: string
          total_outstanding: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
