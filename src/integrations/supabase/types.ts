export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string
          created_at: string
          details: string | null
          id: string
          server_ids: string | null
          user_name: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: string | null
          id?: string
          server_ids?: string | null
          user_name: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: string | null
          id?: string
          server_ids?: string | null
          user_name?: string
        }
        Relationships: []
      }
      delistings: {
        Row: {
          blacklist_type: string
          created_by: string | null
          id: string
          notes: string | null
          result: string
          server_id: string
          submitted_date: string
          updated_at: string
        }
        Insert: {
          blacklist_type: string
          created_by?: string | null
          id?: string
          notes?: string | null
          result?: string
          server_id: string
          submitted_date?: string
          updated_at?: string
        }
        Update: {
          blacklist_type?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          result?: string
          server_id?: string
          submitted_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delistings_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_urls: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          provider_name: string
          updated_at: string
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          provider_name: string
          updated_at?: string
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          provider_name?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      server_flags: {
        Row: {
          created_at: string
          flag_type: string
          flagged_by: string
          id: string
          server_id: string
        }
        Insert: {
          created_at?: string
          flag_type: string
          flagged_by: string
          id?: string
          server_id: string
        }
        Update: {
          created_at?: string
          flag_type?: string
          flagged_by?: string
          id?: string
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_flags_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_smtp_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          server_id: string
          smtp_manager_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          server_id: string
          smtp_manager_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          server_id?: string
          smtp_manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_smtp_assignments_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_smtp_assignments_smtp_manager_id_fkey"
            columns: ["smtp_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          created_at: string
          d_pro: string | null
          domain: string | null
          email: string | null
          id: string
          ids: string
          ip_main: string | null
          n_due: string | null
          notes: string | null
          passwd: string | null
          password: string | null
          price: string | null
          provider: string | null
          rdns: string | null
          score: string | null
          section: string
        }
        Insert: {
          created_at?: string
          d_pro?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          ids: string
          ip_main?: string | null
          n_due?: string | null
          notes?: string | null
          passwd?: string | null
          password?: string | null
          price?: string | null
          provider?: string | null
          rdns?: string | null
          score?: string | null
          section?: string
        }
        Update: {
          created_at?: string
          d_pro?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          ids?: string
          ip_main?: string | null
          n_due?: string | null
          notes?: string | null
          passwd?: string | null
          password?: string | null
          price?: string | null
          provider?: string | null
          rdns?: string | null
          score?: string | null
          section?: string
        }
        Relationships: []
      }
      smtp_status: {
        Row: {
          date: string
          id: string
          note: string | null
          server_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          date: string
          id?: string
          note?: string | null
          server_id: string
          status: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          date?: string
          id?: string
          note?: string | null
          server_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smtp_status_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          password: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          password: string
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          password?: string
          role?: string
        }
        Relationships: []
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
