export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _code_adjectives: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
      _code_nouns: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
      badge_definitions: {
        Row: {
          category: string | null
          code: string
          criteria: Json | null
          description: string | null
          icon: string | null
          id: number
          name: string
          points: number | null
          tier: string | null
        }
        Insert: {
          category?: string | null
          code: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: number
          name: string
          points?: number | null
          tier?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          criteria?: Json | null
          description?: string | null
          icon?: string | null
          id?: number
          name?: string
          points?: number | null
          tier?: string | null
        }
        Relationships: []
      }
      beta_invites: {
        Row: {
          code: string
          created_at: string | null
          id: number
          max_uses: number | null
          note: string | null
          used_at: string | null
          used_by: string | null
          uses: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: number
          max_uses?: number | null
          note?: string | null
          used_at?: string | null
          used_by?: string | null
          uses?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: number
          max_uses?: number | null
          note?: string | null
          used_at?: string | null
          used_by?: string | null
          uses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          aircraft_icao: string | null
          airline_iata: string | null
          arrival_time: string | null
          created_at: string | null
          date: string
          departure_time: string | null
          destination: string
          distance_km: number | null
          duration_minutes: number | null
          flight_number: string | null
          id: number
          origin: string
          source: string | null
          user_id: string
        }
        Insert: {
          aircraft_icao?: string | null
          airline_iata?: string | null
          arrival_time?: string | null
          created_at?: string | null
          date: string
          departure_time?: string | null
          destination: string
          distance_km?: number | null
          duration_minutes?: number | null
          flight_number?: string | null
          id?: number
          origin: string
          source?: string | null
          user_id: string
        }
        Update: {
          aircraft_icao?: string | null
          airline_iata?: string | null
          arrival_time?: string | null
          created_at?: string | null
          date?: string
          departure_time?: string | null
          destination?: string
          distance_km?: number | null
          duration_minutes?: number | null
          flight_number?: string | null
          id?: number
          origin?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_cache: {
        Row: {
          category: string
          id: number
          metadata: Json | null
          rank: number
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          category: string
          id?: number
          metadata?: Json | null
          rank: number
          updated_at?: string | null
          user_id: string
          value: number
        }
        Update: {
          category?: string
          id?: number
          metadata?: Json | null
          rank?: number
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          gemini_api_key: string | null
          home_airport: string | null
          id: string
          is_public: boolean | null
          locale: string | null
          show_on_leaderboards: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          gemini_api_key?: string | null
          home_airport?: string | null
          id: string
          is_public?: boolean | null
          locale?: string | null
          show_on_leaderboards?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          gemini_api_key?: string | null
          home_airport?: string | null
          id?: string
          is_public?: boolean | null
          locale?: string | null
          show_on_leaderboards?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: number
          earned_at: string | null
          id: number
          user_id: string
        }
        Insert: {
          badge_id: number
          earned_at?: string | null
          id?: number
          user_id: string
        }
        Update: {
          badge_id?: number
          earned_at?: string | null
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          airport_iata: string | null
          city: string | null
          country_code: string
          first_visit: string
          id: number
          last_visit: string
          user_id: string
          visit_count: number | null
        }
        Insert: {
          airport_iata?: string | null
          city?: string | null
          country_code: string
          first_visit: string
          id?: number
          last_visit: string
          user_id: string
          visit_count?: number | null
        }
        Update: {
          airport_iata?: string | null
          city?: string | null
          country_code?: string
          first_visit?: string
          id?: number
          last_visit?: string
          user_id?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_invite_code: { Args: { p_code: string }; Returns: boolean }
      generate_invite_code: { Args: { p_note?: string }; Returns: string }
      use_invite_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: boolean
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
