export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string;
          name: string;
          /** Array of auth.users UUIDs with org-level admin access */
          admins: string[];
          /** Array of email substrings/patterns; at least one must match for signup */
          email_patterns: string[];
          data: Record<string, Json>;
        };
        Insert: {
          id?: string;
          name?: string;
          admins?: string[];
          email_patterns?: string[];
          data?: Record<string, Json>;
        };
        Update: {
          id?: string;
          name?: string;
          admins?: string[];
          email_patterns?: string[];
          data?: Record<string, Json>;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          auth_user_id: string;
          name: string;
          is_teacher: boolean;
          /** Org-level admin: can edit their own organisation */
          is_admin: boolean;
          /** System-level super-admin: can edit everything */
          is_system_admin: boolean;
          organisation_id: string | null;
        };
        Insert: {
          auth_user_id: string;
          name?: string;
          is_teacher?: boolean;
          is_admin?: boolean;
          is_system_admin?: boolean;
          organisation_id?: string | null;
        };
        Update: {
          auth_user_id?: string;
          name?: string;
          is_teacher?: boolean;
          is_admin?: boolean;
          is_system_admin?: boolean;
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
