-- ==============================================================================
-- CLIPPER PHASE 4: REAL TRANSCRIPTION + TIMELINE DATA MIGRATION
-- Enhances transcripts with relational segments and words child tables.
-- Full multi-tenant isolation, RLS policies, cascading deletes, and timing indexes.
-- ==============================================================================

-- 1. Upgrade existing public.transcripts table with media_asset_id and metadata
DO $$
BEGIN
  -- Add media_asset_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'media_asset_id'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN media_asset_id UUID REFERENCES public.media_assets(id) ON DELETE SET NULL;
  END IF;

  -- Add provider
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'provider'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN provider TEXT DEFAULT 'deepgram';
  END IF;

  -- Add model
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'model'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN model TEXT DEFAULT 'nova-2';
  END IF;

  -- Add duration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'duration'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN duration NUMERIC(10, 2);
  END IF;

  -- Add status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed'));
  END IF;

  -- Add error_message
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN error_message TEXT;
  END IF;

  -- Add metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  -- Add updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'transcripts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.transcripts 
      ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- 2. Create normalized transcript_segments table
CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_time NUMERIC(10, 2) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(10, 2) NOT NULL CHECK (end_time >= start_time),
  text TEXT NOT NULL,
  confidence NUMERIC(4, 2),
  speaker INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_transcript_segments_transcript_idx UNIQUE (transcript_id, segment_index)
);

-- 3. Create normalized transcript_words table
CREATE TABLE IF NOT EXISTS public.transcript_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.transcript_segments(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  start_time NUMERIC(10, 2) NOT NULL CHECK (start_time >= 0),
  end_time NUMERIC(10, 2) NOT NULL CHECK (end_time >= start_time),
  confidence NUMERIC(4, 2),
  speaker INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_transcript_words_transcript_idx UNIQUE (transcript_id, word_index)
);

-- 4. High-Performance Indexes for Scrubbing, Search & Diarization
CREATE INDEX IF NOT EXISTS idx_transcripts_project_id ON public.transcripts(project_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_media_asset_id ON public.transcripts(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_transcript_id ON public.transcript_segments(transcript_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_transcript_words_transcript_id ON public.transcript_words(transcript_id, word_index);
CREATE INDEX IF NOT EXISTS idx_transcript_words_timing ON public.transcript_words(transcript_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_transcript_words_segment_id ON public.transcript_words(segment_id);

-- 5. Row Level Security (RLS) Enablement
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_words ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for transcript_segments
DROP POLICY IF EXISTS "Users can view transcript segments of their projects" ON public.transcript_segments;
CREATE POLICY "Users can view transcript segments of their projects"
  ON public.transcript_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert transcript segments for their projects" ON public.transcript_segments;
CREATE POLICY "Users can insert transcript segments for their projects"
  ON public.transcript_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can update transcript segments for their projects" ON public.transcript_segments;
CREATE POLICY "Users can update transcript segments for their projects"
  ON public.transcript_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete transcript segments for their projects" ON public.transcript_segments;
CREATE POLICY "Users can delete transcript segments for their projects"
  ON public.transcript_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_segments.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

-- 7. RLS Policies for transcript_words
DROP POLICY IF EXISTS "Users can view transcript words of their projects" ON public.transcript_words;
CREATE POLICY "Users can view transcript words of their projects"
  ON public.transcript_words FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert transcript words for their projects" ON public.transcript_words;
CREATE POLICY "Users can insert transcript words for their projects"
  ON public.transcript_words FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can update transcript words for their projects" ON public.transcript_words;
CREATE POLICY "Users can update transcript words for their projects"
  ON public.transcript_words FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can delete transcript words for their projects" ON public.transcript_words;
CREATE POLICY "Users can delete transcript words for their projects"
  ON public.transcript_words FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.transcripts
      JOIN public.projects ON projects.id = transcripts.project_id
      WHERE transcripts.id = transcript_words.transcript_id
      AND (projects.user_id = auth.uid() OR public.is_admin())
      AND projects.deleted_at IS NULL
    )
  );
