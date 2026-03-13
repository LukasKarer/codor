export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          auth_user_id: string;
          is_teacher: boolean;
          is_admin: boolean;
        };
        Insert: {
          auth_user_id: string;
          is_teacher?: boolean;
          is_admin?: boolean;
        };
        Update: {
          auth_user_id?: string;
          is_teacher?: boolean;
          is_admin?: boolean;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: number;
          sub: string;
          creation_time: number;
          content: string | null;
        };
        Insert: {
          id?: number;
          sub: string;
          creation_time: number;
          content?: string | null;
        };
        Update: {
          id?: number;
          sub?: string;
          creation_time?: number;
          content?: string | null;
        };
        Relationships: [];
      };
      entries: {
        Row: {
          id: string;
          sub: string;
          exercise_id: number;
          creation_time: number;
          note: number | null;
          content: string | null;
          auth_user_id: string | null;
          is_test: boolean;
        };
        Insert: {
          id?: string;
          sub: string;
          exercise_id: number;
          creation_time: number;
          note?: number | null;
          content?: string | null;
          auth_user_id?: string | null;
          is_test?: boolean;
        };
        Update: {
          id?: string;
          sub?: string;
          exercise_id?: number;
          creation_time?: number;
          note?: number | null;
          content?: string | null;
          auth_user_id?: string | null;
          is_test?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'entries_exercise_id_fkey';
            columns: ['exercise_id'];
            referencedRelation: 'exercises';
            referencedColumns: ['id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
