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
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_one_id: string
          participant_two_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one_id: string
          participant_two_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one_id?: string
          participant_two_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_one_id_fkey"
            columns: ["participant_one_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_two_id_fkey"
            columns: ["participant_two_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_photos: {
        Row: {
          created_at: string | null
          id: string
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          id: string
          idempotency_key: string | null
          read_at: string | null
          sender_id: string
          sent_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          id?: string
          idempotency_key?: string | null
          read_at?: string | null
          sender_id: string
          sent_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          id?: string
          idempotency_key?: string | null
          read_at?: string | null
          sender_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playing_history: {
        Row: {
          achievements: string[] | null
          club_name: string
          created_at: string | null
          display_order: number | null
          division_league: string
          id: string
          position_role: string
          updated_at: string | null
          user_id: string
          years: string
        }
        Insert: {
          achievements?: string[] | null
          club_name: string
          created_at?: string | null
          display_order?: number | null
          division_league: string
          id?: string
          position_role: string
          updated_at?: string | null
          user_id: string
          years: string
        }
        Update: {
          achievements?: string[] | null
          club_name?: string
          created_at?: string | null
          display_order?: number | null
          division_league?: string
          id?: string
          position_role?: string
          updated_at?: string | null
          user_id?: string
          years?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_location: string
          club_bio: string | null
          club_history: string | null
          contact_email: string | null
          created_at: string
          current_club: string | null
          date_of_birth: string | null
          email: string
          full_name: string
          gender: string | null
          highlight_video_url: string | null
          id: string
          league_division: string | null
          nationality: string
          passport_1: string | null
          passport_2: string | null
          position: string | null
          role: string
          updated_at: string
          username: string | null
          version: number
          website: string | null
          year_founded: number | null
        }
        Insert: {
          avatar_url?: string | null
          base_location: string
          club_bio?: string | null
          club_history?: string | null
          contact_email?: string | null
          created_at?: string
          current_club?: string | null
          date_of_birth?: string | null
          email: string
          full_name: string
          gender?: string | null
          highlight_video_url?: string | null
          id: string
          league_division?: string | null
          nationality: string
          passport_1?: string | null
          passport_2?: string | null
          position?: string | null
          role: string
          updated_at?: string
          username?: string | null
          version?: number
          website?: string | null
          year_founded?: number | null
        }
        Update: {
          avatar_url?: string | null
          base_location?: string
          club_bio?: string | null
          club_history?: string | null
          contact_email?: string | null
          created_at?: string
          current_club?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string
          gender?: string | null
          highlight_video_url?: string | null
          id?: string
          league_division?: string | null
          nationality?: string
          passport_1?: string | null
          passport_2?: string | null
          position?: string | null
          role?: string
          updated_at?: string
          username?: string | null
          version?: number
          website?: string | null
          year_founded?: number | null
        }
        Relationships: []
      }
      vacancies: {
        Row: {
          application_deadline: string | null
          benefits: string[] | null
          closed_at: string | null
          club_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          custom_benefits: string[] | null
          description: string | null
          duration_text: string | null
          gender: Database["public"]["Enums"]["vacancy_gender"]
          id: string
          location_city: string
          location_country: string
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          position: Database["public"]["Enums"]["vacancy_position"]
          priority: Database["public"]["Enums"]["vacancy_priority"] | null
          published_at: string | null
          requirements: string[] | null
          start_date: string | null
          status: Database["public"]["Enums"]["vacancy_status"] | null
          title: string
          updated_at: string | null
          version: number
        }
        Insert: {
          application_deadline?: string | null
          benefits?: string[] | null
          closed_at?: string | null
          club_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_benefits?: string[] | null
          description?: string | null
          duration_text?: string | null
          gender: Database["public"]["Enums"]["vacancy_gender"]
          id?: string
          location_city: string
          location_country: string
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          position: Database["public"]["Enums"]["vacancy_position"]
          priority?: Database["public"]["Enums"]["vacancy_priority"] | null
          published_at?: string | null
          requirements?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["vacancy_status"] | null
          title: string
          updated_at?: string | null
          version?: number
        }
        Update: {
          application_deadline?: string | null
          benefits?: string[] | null
          closed_at?: string | null
          club_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          custom_benefits?: string[] | null
          description?: string | null
          duration_text?: string | null
          gender?: Database["public"]["Enums"]["vacancy_gender"]
          id?: string
          location_city?: string
          location_country?: string
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          position?: Database["public"]["Enums"]["vacancy_position"]
          priority?: Database["public"]["Enums"]["vacancy_priority"] | null
          published_at?: string | null
          requirements?: string[] | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["vacancy_status"] | null
          title?: string
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "vacancies_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacancy_applications: {
        Row: {
          applied_at: string
          cover_letter: string | null
          id: string
          metadata: Json | null
          player_id: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          vacancy_id: string
        }
        Insert: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          metadata?: Json | null
          player_id: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          vacancy_id: string
        }
        Update: {
          applied_at?: string
          cover_letter?: string | null
          id?: string
          metadata?: Json | null
          player_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacancy_applications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacancy_applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_profile_lock: {
        Args: { profile_id: string }
        Returns: boolean
      }
      release_profile_lock: {
        Args: { profile_id: string }
        Returns: boolean
      }
    }
    Enums: {
      application_status:
        | "pending"
        | "reviewed"
        | "shortlisted"
        | "interview"
        | "accepted"
        | "rejected"
        | "withdrawn"
      opportunity_type: "player" | "coach"
      vacancy_gender: "Men" | "Women"
      vacancy_position: "goalkeeper" | "defender" | "midfielder" | "forward"
      vacancy_priority: "low" | "medium" | "high"
      vacancy_status: "draft" | "open" | "closed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      application_status: [
        "pending",
        "reviewed",
        "shortlisted",
        "interview",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      opportunity_type: ["player", "coach"],
      vacancy_gender: ["Men", "Women"],
      vacancy_position: ["goalkeeper", "defender", "midfielder", "forward"],
      vacancy_priority: ["low", "medium", "high"],
      vacancy_status: ["draft", "open", "closed"],
    },
  },
} as const

// Convenient type exports
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Vacancy = Database['public']['Tables']['vacancies']['Row']
export type VacancyInsert = Database['public']['Tables']['vacancies']['Insert']
export type VacancyUpdate = Database['public']['Tables']['vacancies']['Update']

export type VacancyApplication = Database['public']['Tables']['vacancy_applications']['Row']
export type VacancyApplicationInsert = Database['public']['Tables']['vacancy_applications']['Insert']
export type VacancyApplicationUpdate = Database['public']['Tables']['vacancy_applications']['Update']

export type GalleryPhoto = Database['public']['Tables']['gallery_photos']['Row']
export type GalleryPhotoInsert = Database['public']['Tables']['gallery_photos']['Insert']
export type GalleryPhotoUpdate = Database['public']['Tables']['gallery_photos']['Update']

export type PlayingHistory = Database['public']['Tables']['playing_history']['Row']
export type PlayingHistoryInsert = Database['public']['Tables']['playing_history']['Insert']
export type PlayingHistoryUpdate = Database['public']['Tables']['playing_history']['Update']

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']
export type MessageUpdate = Database['public']['Tables']['messages']['Update']

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
export type ConversationUpdate = Database['public']['Tables']['conversations']['Update']

// Complex joined types
export type VacancyApplicationWithPlayer = VacancyApplication & {
  player: Profile
}
