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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      auto_trades: {
        Row: {
          action: string
          adr_used_today: number | null
          ai_confidence: number | null
          algorithmic_strategy: string | null
          calculated_micro_lots: number | null
          calculated_pip_risk: number | null
          calculated_risk_amount: number | null
          closed_at: string | null
          confluence_score: number | null
          created_at: string
          deterministic_used: boolean | null
          distance_to_vwap_bps: number | null
          enhanced_features: Json | null
          entry_filled: boolean | null
          entry_filled_at: string | null
          entry_price: number
          id: string
          lot_size: number | null
          next_check_at: string | null
          order_type: string | null
          pips_result: number | null
          rejection_reason: string | null
          reward_pips: number | null
          risk_pips: number | null
          risk_reward_ratio: number | null
          session_context: Json | null
          session_name: string
          status: string
          stop_loss: number
          symbol: string
          take_profit: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          adr_used_today?: number | null
          ai_confidence?: number | null
          algorithmic_strategy?: string | null
          calculated_micro_lots?: number | null
          calculated_pip_risk?: number | null
          calculated_risk_amount?: number | null
          closed_at?: string | null
          confluence_score?: number | null
          created_at?: string
          deterministic_used?: boolean | null
          distance_to_vwap_bps?: number | null
          enhanced_features?: Json | null
          entry_filled?: boolean | null
          entry_filled_at?: string | null
          entry_price: number
          id?: string
          lot_size?: number | null
          next_check_at?: string | null
          order_type?: string | null
          pips_result?: number | null
          rejection_reason?: string | null
          reward_pips?: number | null
          risk_pips?: number | null
          risk_reward_ratio?: number | null
          session_context?: Json | null
          session_name: string
          status?: string
          stop_loss: number
          symbol: string
          take_profit: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          adr_used_today?: number | null
          ai_confidence?: number | null
          algorithmic_strategy?: string | null
          calculated_micro_lots?: number | null
          calculated_pip_risk?: number | null
          calculated_risk_amount?: number | null
          closed_at?: string | null
          confluence_score?: number | null
          created_at?: string
          deterministic_used?: boolean | null
          distance_to_vwap_bps?: number | null
          enhanced_features?: Json | null
          entry_filled?: boolean | null
          entry_filled_at?: string | null
          entry_price?: number
          id?: string
          lot_size?: number | null
          next_check_at?: string | null
          order_type?: string | null
          pips_result?: number | null
          rejection_reason?: string | null
          reward_pips?: number | null
          risk_pips?: number | null
          risk_reward_ratio?: number | null
          session_context?: Json | null
          session_name?: string
          status?: string
          stop_loss?: number
          symbol?: string
          take_profit?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      telegram_notifications: {
        Row: {
          chat_id: number
          error_message: string | null
          id: string
          message_text: string
          notification_type: string
          sent_at: string
          success: boolean
          telegram_message_id: number | null
          trade_id: string | null
        }
        Insert: {
          chat_id: number
          error_message?: string | null
          id?: string
          message_text: string
          notification_type: string
          sent_at?: string
          success?: boolean
          telegram_message_id?: number | null
          trade_id?: string | null
        }
        Update: {
          chat_id?: number
          error_message?: string | null
          id?: string
          message_text?: string
          notification_type?: string
          sent_at?: string
          success?: boolean
          telegram_message_id?: number | null
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notifications_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "auto_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_subscribers: {
        Row: {
          chat_id: number
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          subscribed_pairs: string[] | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          subscribed_pairs?: string[] | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          subscribed_pairs?: string[] | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      trade_analyses: {
        Row: {
          ai_analysis: Json
          api_response: Json
          created_at: string
          id: string
          strategy_type: string
          symbol: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_analysis: Json
          api_response: Json
          created_at?: string
          id?: string
          strategy_type?: string
          symbol: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_analysis?: Json
          api_response?: Json
          created_at?: string
          id?: string
          strategy_type?: string
          symbol?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_auto_trades_stats: {
        Row: {
          action: string | null
          ai_confidence: number | null
          calculated_micro_lots: number | null
          calculated_pip_risk: number | null
          calculated_risk_amount: number | null
          closed_at: string | null
          created_at: string | null
          entry_price: number | null
          lot_size: number | null
          pips_result: number | null
          risk_reward_ratio: number | null
          session_name: string | null
          status: string | null
          stop_loss: number | null
          symbol: string | null
          take_profit: number | null
        }
        Insert: {
          action?: string | null
          ai_confidence?: number | null
          calculated_micro_lots?: number | null
          calculated_pip_risk?: number | null
          calculated_risk_amount?: number | null
          closed_at?: string | null
          created_at?: string | null
          entry_price?: number | null
          lot_size?: number | null
          pips_result?: number | null
          risk_reward_ratio?: number | null
          session_name?: string | null
          status?: string | null
          stop_loss?: number | null
          symbol?: string | null
          take_profit?: number | null
        }
        Update: {
          action?: string | null
          ai_confidence?: number | null
          calculated_micro_lots?: number | null
          calculated_pip_risk?: number | null
          calculated_risk_amount?: number | null
          closed_at?: string | null
          created_at?: string | null
          entry_price?: number | null
          lot_size?: number | null
          pips_result?: number | null
          risk_reward_ratio?: number | null
          session_name?: string | null
          status?: string | null
          stop_loss?: number | null
          symbol?: string | null
          take_profit?: number | null
        }
        Relationships: []
      }
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
