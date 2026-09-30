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
      activity_log: {
        Row: {
          action_type: string
          actor: string
          created_at: string
          id: string
          summary: string
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: string
          actor: string
          created_at?: string
          id?: string
          summary: string
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: string
          actor?: string
          created_at?: string
          id?: string
          summary?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_records: {
        Row: {
          created_at: string
          dataset_id: string
          id: string
          learner_id: string | null
          source_data: Json
          source_record_id: string | null
          validation_notes: string | null
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          created_at?: string
          dataset_id: string
          id?: string
          learner_id?: string | null
          source_data: Json
          source_record_id?: string | null
          validation_notes?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          created_at?: string
          dataset_id?: string
          id?: string
          learner_id?: string | null
          source_data?: Json
          source_record_id?: string | null
          validation_notes?: string | null
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dataset_records_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_records_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          environment_id: string
          id: string
          name: string
          original_file_name: string
          record_count: number
          storage_reference: string
          uploaded_by: string
          validation_status: Database["public"]["Enums"]["validation_status"]
          validation_summary: Json
        }
        Insert: {
          created_at?: string
          environment_id: string
          id?: string
          name: string
          original_file_name: string
          record_count?: number
          storage_reference: string
          uploaded_by: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          validation_summary?: Json
        }
        Update: {
          created_at?: string
          environment_id?: string
          id?: string
          name?: string
          original_file_name?: string
          record_count?: number
          storage_reference?: string
          uploaded_by?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          validation_summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "datasets_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "learning_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "datasets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_evidence: {
        Row: {
          created_at: string
          dataset_record_id: string | null
          evidence_text: string
          id: string
          learner_insight_id: string
          learner_signal_id: string | null
        }
        Insert: {
          created_at?: string
          dataset_record_id?: string | null
          evidence_text: string
          id?: string
          learner_insight_id: string
          learner_signal_id?: string | null
        }
        Update: {
          created_at?: string
          dataset_record_id?: string | null
          evidence_text?: string
          id?: string
          learner_insight_id?: string
          learner_signal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insight_evidence_dataset_record_id_fkey"
            columns: ["dataset_record_id"]
            isOneToOne: false
            referencedRelation: "dataset_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_evidence_learner_insight_id_fkey"
            columns: ["learner_insight_id"]
            isOneToOne: false
            referencedRelation: "learner_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_evidence_learner_signal_id_fkey"
            columns: ["learner_signal_id"]
            isOneToOne: false
            referencedRelation: "learner_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_environments: {
        Row: {
          environment_id: string
          id: string
          joined_at: string
          learner_id: string
          participation_status: Database["public"]["Enums"]["participation_status"]
        }
        Insert: {
          environment_id: string
          id?: string
          joined_at?: string
          learner_id: string
          participation_status?: Database["public"]["Enums"]["participation_status"]
        }
        Update: {
          environment_id?: string
          id?: string
          joined_at?: string
          learner_id?: string
          participation_status?: Database["public"]["Enums"]["participation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "learner_environments_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "learning_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_environments_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_insights: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_output: Json | null
          concerns: string[]
          created_at: string
          development_needs: string[]
          environment_id: string
          id: string
          insight_type: string
          interpretation_boundary: string | null
          learner_id: string
          learning_preferences: string[]
          observed_strengths: string[]
          processing_run_id: string | null
          status: Database["public"]["Enums"]["insight_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_output?: Json | null
          concerns?: string[]
          created_at?: string
          development_needs?: string[]
          environment_id: string
          id?: string
          insight_type?: string
          interpretation_boundary?: string | null
          learner_id: string
          learning_preferences?: string[]
          observed_strengths?: string[]
          processing_run_id?: string | null
          status?: Database["public"]["Enums"]["insight_status"]
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_output?: Json | null
          concerns?: string[]
          created_at?: string
          development_needs?: string[]
          environment_id?: string
          id?: string
          insight_type?: string
          interpretation_boundary?: string | null
          learner_id?: string
          learning_preferences?: string[]
          observed_strengths?: string[]
          processing_run_id?: string | null
          status?: Database["public"]["Enums"]["insight_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_insights_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_insights_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "learning_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_insights_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_insights_processing_run_id_fkey"
            columns: ["processing_run_id"]
            isOneToOne: false
            referencedRelation: "processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_patterns: {
        Row: {
          assignment_status: Database["public"]["Enums"]["pattern_assignment_status"]
          contradictory_evidence: string | null
          created_at: string
          description: string | null
          id: string
          learner_id: string | null
          pattern_type: string
          processing_run_id: string
          reason_for_assignment: string | null
          reason_for_uncertainty: string | null
          supporting_signal_ids: string[]
          title: string
        }
        Insert: {
          assignment_status?: Database["public"]["Enums"]["pattern_assignment_status"]
          contradictory_evidence?: string | null
          created_at?: string
          description?: string | null
          id?: string
          learner_id?: string | null
          pattern_type: string
          processing_run_id: string
          reason_for_assignment?: string | null
          reason_for_uncertainty?: string | null
          supporting_signal_ids?: string[]
          title: string
        }
        Update: {
          assignment_status?: Database["public"]["Enums"]["pattern_assignment_status"]
          contradictory_evidence?: string | null
          created_at?: string
          description?: string | null
          id?: string
          learner_id?: string | null
          pattern_type?: string
          processing_run_id?: string
          reason_for_assignment?: string | null
          reason_for_uncertainty?: string | null
          supporting_signal_ids?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_patterns_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_patterns_processing_run_id_fkey"
            columns: ["processing_run_id"]
            isOneToOne: false
            referencedRelation: "processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_profiles: {
        Row: {
          id: string
          learner_id: string
          profile_status: Database["public"]["Enums"]["profile_status"]
          summary: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          learner_id: string
          profile_status?: Database["public"]["Enums"]["profile_status"]
          summary?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          learner_id?: string
          profile_status?: Database["public"]["Enums"]["profile_status"]
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_profiles_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: true
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_signals: {
        Row: {
          created_at: string
          evidence_text: string
          id: string
          interpretation_note: string | null
          label: string
          learner_id: string
          normalized_label: string
          processing_result_id: string
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_field: string | null
        }
        Insert: {
          created_at?: string
          evidence_text: string
          id?: string
          interpretation_note?: string | null
          label: string
          learner_id: string
          normalized_label: string
          processing_result_id: string
          signal_type: Database["public"]["Enums"]["signal_type"]
          source_field?: string | null
        }
        Update: {
          created_at?: string
          evidence_text?: string
          id?: string
          interpretation_note?: string | null
          label?: string
          learner_id?: string
          normalized_label?: string
          processing_result_id?: string
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source_field?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_signals_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_signals_processing_result_id_fkey"
            columns: ["processing_result_id"]
            isOneToOne: false
            referencedRelation: "processing_results"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          external_reference: string | null
          id: string
          status: Database["public"]["Enums"]["learner_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          external_reference?: string | null
          id?: string
          status?: Database["public"]["Enums"]["learner_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          external_reference?: string | null
          id?: string
          status?: Database["public"]["Enums"]["learner_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      learning_environments: {
        Row: {
          course_or_workshop: string
          created_at: string
          created_by: string
          description: string | null
          environment_type: string
          id: string
          learning_objectives: string | null
          name: string
          organisation_name: string
          status: Database["public"]["Enums"]["learning_environment_status"]
          updated_at: string
        }
        Insert: {
          course_or_workshop: string
          created_at?: string
          created_by: string
          description?: string | null
          environment_type: string
          id?: string
          learning_objectives?: string | null
          name: string
          organisation_name: string
          status?: Database["public"]["Enums"]["learning_environment_status"]
          updated_at?: string
        }
        Update: {
          course_or_workshop?: string
          created_at?: string
          created_by?: string
          description?: string | null
          environment_type?: string
          id?: string
          learning_objectives?: string | null
          name?: string
          organisation_name?: string
          status?: Database["public"]["Enums"]["learning_environment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_environments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_artifacts: {
        Row: {
          artifact_type: Database["public"]["Enums"]["artifact_type"]
          created_at: string
          created_by: string
          description: string | null
          environment_id: string | null
          evidence_note: string | null
          external_url: string | null
          file_reference: string | null
          id: string
          learner_id: string
          title: string
          visibility: Database["public"]["Enums"]["artifact_visibility"]
        }
        Insert: {
          artifact_type: Database["public"]["Enums"]["artifact_type"]
          created_at?: string
          created_by: string
          description?: string | null
          environment_id?: string | null
          evidence_note?: string | null
          external_url?: string | null
          file_reference?: string | null
          id?: string
          learner_id: string
          title: string
          visibility?: Database["public"]["Enums"]["artifact_visibility"]
        }
        Update: {
          artifact_type?: Database["public"]["Enums"]["artifact_type"]
          created_at?: string
          created_by?: string
          description?: string | null
          environment_id?: string | null
          evidence_note?: string | null
          external_url?: string | null
          file_reference?: string | null
          id?: string
          learner_id?: string
          title?: string
          visibility?: Database["public"]["Enums"]["artifact_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_artifacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_artifacts_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "learning_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_artifacts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_results: {
        Row: {
          created_at: string
          dataset_record_id: string
          error: string | null
          id: string
          learner_id: string | null
          model_or_tool: string | null
          processing_run_id: string
          raw_ai_output: Json | null
          source_type: Database["public"]["Enums"]["ai_source"]
          status: Database["public"]["Enums"]["result_status"]
          structured_output: Json | null
          warning: string | null
        }
        Insert: {
          created_at?: string
          dataset_record_id: string
          error?: string | null
          id?: string
          learner_id?: string | null
          model_or_tool?: string | null
          processing_run_id: string
          raw_ai_output?: Json | null
          source_type: Database["public"]["Enums"]["ai_source"]
          status?: Database["public"]["Enums"]["result_status"]
          structured_output?: Json | null
          warning?: string | null
        }
        Update: {
          created_at?: string
          dataset_record_id?: string
          error?: string | null
          id?: string
          learner_id?: string | null
          model_or_tool?: string | null
          processing_run_id?: string
          raw_ai_output?: Json | null
          source_type?: Database["public"]["Enums"]["ai_source"]
          status?: Database["public"]["Enums"]["result_status"]
          structured_output?: Json | null
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processing_results_dataset_record_id_fkey"
            columns: ["dataset_record_id"]
            isOneToOne: false
            referencedRelation: "dataset_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_results_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_results_processing_run_id_fkey"
            columns: ["processing_run_id"]
            isOneToOne: false
            referencedRelation: "processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_runs: {
        Row: {
          ai_source: Database["public"]["Enums"]["ai_source"]
          completed_at: string | null
          created_at: string
          created_by: string
          dataset_id: string | null
          environment_id: string
          id: string
          learner_id: string | null
          model_or_tool: string | null
          processing_configuration: Json
          processing_context: Json
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
        }
        Insert: {
          ai_source?: Database["public"]["Enums"]["ai_source"]
          completed_at?: string | null
          created_at?: string
          created_by: string
          dataset_id?: string | null
          environment_id: string
          id?: string
          learner_id?: string | null
          model_or_tool?: string | null
          processing_configuration?: Json
          processing_context?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
        }
        Update: {
          ai_source?: Database["public"]["Enums"]["ai_source"]
          completed_at?: string | null
          created_at?: string
          created_by?: string
          dataset_id?: string | null
          environment_id?: string
          id?: string
          learner_id?: string | null
          model_or_tool?: string | null
          processing_configuration?: Json
          processing_context?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "processing_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_runs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_runs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "learning_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_runs_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          corrected_output: Json | null
          decision: Database["public"]["Enums"]["review_decision"]
          error_categories: Database["public"]["Enums"]["error_category"][]
          id: string
          learner_id: string | null
          processing_result_id: string
          review_notes: string | null
          reviewed_at: string
          reviewer_id: string
        }
        Insert: {
          corrected_output?: Json | null
          decision: Database["public"]["Enums"]["review_decision"]
          error_categories?: Database["public"]["Enums"]["error_category"][]
          id?: string
          learner_id?: string | null
          processing_result_id: string
          review_notes?: string | null
          reviewed_at?: string
          reviewer_id: string
        }
        Update: {
          corrected_output?: Json | null
          decision?: Database["public"]["Enums"]["review_decision"]
          error_categories?: Database["public"]["Enums"]["error_category"][]
          id?: string
          learner_id?: string | null
          processing_result_id?: string
          review_notes?: string | null
          reviewed_at?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_processing_result_id_fkey"
            columns: ["processing_result_id"]
            isOneToOne: false
            referencedRelation: "processing_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
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
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      ai_source: "smartdiscovery" | "external_ai" | "manual" | "mock"
      app_role: "admin" | "analyst" | "educator" | "learner"
      artifact_type:
        | "project"
        | "assignment"
        | "workshop_output"
        | "reflection"
        | "prototype"
        | "presentation"
        | "achievement"
        | "other_evidence"
      artifact_visibility: "internal" | "learner_visible"
      error_category:
        | "false_positive"
        | "false_negative"
        | "over_interpretation"
        | "missing_signal"
        | "normalization_error"
        | "taxonomy_mismatch"
        | "pattern_mismatch"
        | "insufficient_evidence"
      insight_status:
        | "candidate"
        | "under_review"
        | "revised"
        | "approved"
        | "rejected"
      learner_status: "active" | "archived"
      learning_environment_status: "active" | "archived"
      participation_status: "active" | "completed" | "withdrawn"
      pattern_assignment_status:
        | "candidate"
        | "confirmed"
        | "unassigned"
        | "needs_more_evidence"
      profile_status: "active" | "inactive"
      result_status: "success" | "warning" | "failed" | "skipped"
      review_decision:
        | "agree"
        | "revise"
        | "reject"
        | "unsure"
        | "needs_more_evidence"
        | "request_rerun"
      run_status:
        | "draft"
        | "queued"
        | "running"
        | "completed"
        | "completed_with_warning"
        | "failed"
        | "cancelled"
      signal_type:
        | "strength"
        | "need"
        | "concern"
        | "preference"
        | "activity_behaviour"
      validation_status: "pending" | "valid" | "valid_with_warnings" | "invalid"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ai_source: ["smartdiscovery", "external_ai", "manual", "mock"],
      app_role: ["admin", "analyst", "educator", "learner"],
      artifact_type: [
        "project",
        "assignment",
        "workshop_output",
        "reflection",
        "prototype",
        "presentation",
        "achievement",
        "other_evidence",
      ],
      artifact_visibility: ["internal", "learner_visible"],
      error_category: [
        "false_positive",
        "false_negative",
        "over_interpretation",
        "missing_signal",
        "normalization_error",
        "taxonomy_mismatch",
        "pattern_mismatch",
        "insufficient_evidence",
      ],
      insight_status: [
        "candidate",
        "under_review",
        "revised",
        "approved",
        "rejected",
      ],
      learner_status: ["active", "archived"],
      learning_environment_status: ["active", "archived"],
      participation_status: ["active", "completed", "withdrawn"],
      pattern_assignment_status: [
        "candidate",
        "confirmed",
        "unassigned",
        "needs_more_evidence",
      ],
      profile_status: ["active", "inactive"],
      result_status: ["success", "warning", "failed", "skipped"],
      review_decision: [
        "agree",
        "revise",
        "reject",
        "unsure",
        "needs_more_evidence",
        "request_rerun",
      ],
      run_status: [
        "draft",
        "queued",
        "running",
        "completed",
        "completed_with_warning",
        "failed",
        "cancelled",
      ],
      signal_type: [
        "strength",
        "need",
        "concern",
        "preference",
        "activity_behaviour",
      ],
      validation_status: ["pending", "valid", "valid_with_warnings", "invalid"],
    },
  },
} as const
