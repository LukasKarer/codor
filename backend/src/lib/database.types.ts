export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          admins: string[];   // array of auth.users UUIDs
          data: Record<string, Json>;
        };
        Insert: {
          id?: string;
          admins?: string[];
          data?: Record<string, Json>;
        };
        Update: {
          id?: string;
          admins?: string[];
          data?: Record<string, Json>;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          auth_user_id: string;
          is_teacher: boolean;
          is_admin: boolean;
          organisation_id: string | null;
        };
        Insert: {
          auth_user_id: string;
          is_teacher?: boolean;
          is_admin?: boolean;
          organisation_id?: string | null;
        };
        Update: {
          auth_user_id?: string;
          is_teacher?: boolean;
          is_admin?: boolean;
          organisation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_organisation_id_fkey';
            columns: ['organisation_id'];
            referencedRelation: 'organisations';
            referencedColumns: ['id'];
          }
        ];
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
