// Hand-written to match supabase/migrations. Replace with `npm run db:types` output once the
// project is linked; keep the shape (Tables / Views / Functions / Enums / CompositeTypes).
// Rows are type aliases (not interfaces) so they satisfy postgrest-js's Record constraints.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ProfileRow = {
  id: string;
  username: string;
  created_at: string;
  updated_at: string;
};

export type MatchRow = {
  id: string;
  player_id: string;
  opponent_type: 'bot' | 'human';
  bot_difficulty: 'easy' | 'medium' | 'hard' | null;
  opponent_id: string | null;
  result: 'win' | 'loss' | 'draw';
  end_reason: 'ko' | 'timeout' | 'forfeit';
  input_mode: 'webcam' | 'keyboard';
  duration_seconds: number;
  player_hp_left: number;
  opponent_hp_left: number;
  damage_dealt: number;
  damage_taken: number;
  jutsus_used: Json;
  balance_version: string;
  created_at: string;
};

export type MatchInsert = {
  player_id: string;
  opponent_type: 'bot' | 'human';
  bot_difficulty?: 'easy' | 'medium' | 'hard' | null;
  opponent_id?: string | null;
  result: 'win' | 'loss' | 'draw';
  end_reason: 'ko' | 'timeout' | 'forfeit';
  input_mode: 'webcam' | 'keyboard';
  duration_seconds: number;
  player_hp_left: number;
  opponent_hp_left: number;
  damage_dealt?: number;
  damage_taken?: number;
  jutsus_used?: Json;
  balance_version?: string;
};

export type UserSettingsRow = {
  user_id: string;
  settings: Json;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: { id: string; username: string; created_at?: string; updated_at?: string };
        Update: { id?: string; username?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: MatchInsert;
        Update: Partial<MatchRow>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: { user_id: string; settings?: Json; updated_at?: string };
        Update: { user_id?: string; settings?: Json; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_username_available: {
        Args: { candidate: string };
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
