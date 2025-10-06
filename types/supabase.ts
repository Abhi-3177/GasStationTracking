import { DayBookRecord, DailyRecordData } from "./daybook"

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
      daily_records: {
        Row: {
          created_at: string
          date: string
          record: Json | DailyRecordData
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          record: Json | DailyRecordData
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          record?: Json | DailyRecordData
          updated_at?: string
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
