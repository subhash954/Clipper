-- MISSION 3: MULTIMODAL CONTENT INTELLIGENCE ENGINE MIGRATION
-- Adds persistent tables for intelligence reports, candidate clips, scenes, and speaker profiles

-- 1. Intelligence Reports
CREATE TABLE IF NOT EXISTS intelligence_reports (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  classification JSONB DEFAULT '{}'::jsonb,
  audio_metrics JSONB DEFAULT '{}'::jsonb,
  story_arc JSONB DEFAULT '{}'::jsonb,
  platform_fit JSONB DEFAULT '{}'::jsonb,
  usage_records JSONB DEFAULT '[]'::jsonb,
  failures JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, analysis_hash)
);

-- 2. Candidate Clips (Audited AI Editorial Moments)
CREATE TABLE IF NOT EXISTS candidate_clips (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  cluster_id TEXT,
  is_primary BOOLEAN DEFAULT true,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  start_time NUMERIC(10, 3) NOT NULL,
  end_time NUMERIC(10, 3) NOT NULL,
  duration NUMERIC(10, 3) NOT NULL,
  overall_score INT NOT NULL,
  dimension_scores JSONB DEFAULT '{}'::jsonb,
  quality_status TEXT NOT NULL DEFAULT 'verified',
  quality_gate_audit JSONB DEFAULT '{}'::jsonb,
  hook JSONB DEFAULT '{}'::jsonb,
  payoff JSONB DEFAULT '{}'::jsonb,
  standalone_eval JSONB DEFAULT '{}'::jsonb,
  words JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Visual Scenes
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_time NUMERIC(10, 3) NOT NULL,
  end_time NUMERIC(10, 3) NOT NULL,
  scene_type TEXT NOT NULL,
  visual_summary TEXT,
  dominant_objects JSONB DEFAULT '[]'::jsonb,
  dominant_faces_count INT DEFAULT 1,
  motion_level TEXT DEFAULT 'medium',
  cut_intensity_score NUMERIC(5, 3) DEFAULT 0.35,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Speaker Profiles
CREATE TABLE IF NOT EXISTS speaker_profiles (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  display_label TEXT NOT NULL,
  total_speaking_time NUMERIC(10, 2) NOT NULL,
  segments_count INT NOT NULL,
  dominant_wpm INT NOT NULL,
  confidence NUMERIC(5, 3) NOT NULL,
  interruptions_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, speaker_id)
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_intel_reports_project ON intelligence_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_intel_reports_hash ON intelligence_reports(analysis_hash);
CREATE INDEX IF NOT EXISTS idx_candidate_clips_project ON candidate_clips(project_id);
CREATE INDEX IF NOT EXISTS idx_candidate_clips_score ON candidate_clips(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_project ON speaker_profiles(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_profiles ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies (Linked to parent projects ownership)
CREATE POLICY intelligence_reports_user_isolation ON intelligence_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = intelligence_reports.project_id AND projects.user_id = auth.uid()::text
    )
  );

CREATE POLICY candidate_clips_user_isolation ON candidate_clips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = candidate_clips.project_id AND projects.user_id = auth.uid()::text
    )
  );

CREATE POLICY scenes_user_isolation ON scenes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = scenes.project_id AND projects.user_id = auth.uid()::text
    )
  );

CREATE POLICY speaker_profiles_user_isolation ON speaker_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects WHERE projects.id = speaker_profiles.project_id AND projects.user_id = auth.uid()::text
    )
  );
