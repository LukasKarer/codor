export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
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
      users: {
        Row: {
          id: number;
          sub: string;
          exercise_id: number;
          creation_time: number;
          academic_id: number;
          note: number | null;
          content: string | null;
        };
        Insert: {
          id?: number;
          sub: string;
          exercise_id: number;
          creation_time: number;
          academic_id: number;
          note?: number | null;
          content?: string | null;
        };
        Update: {
          id?: number;
          sub?: string;
          exercise_id?: number;
          creation_time?: number;
          academic_id?: number;
          note?: number | null;
          content?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'users_exercise_id_fkey';
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
