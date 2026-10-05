'use client';

import React, { useState, useEffect } from 'react';
import { StudioVersionSnapshot, CanonicalRenderSpec } from '@/lib/editor/types';
import { History, Save, RotateCcw, Copy, Edit2, X, Check, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface TimelineVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentSpec: CanonicalRenderSpec;
  onRestoreVersion: (spec: CanonicalRenderSpec) => void;
}

export const TimelineVersionModal: React.FC<TimelineVersionModalProps> = ({
  isOpen,
  onClose,
  projectId,
  currentSpec,
  onRestoreVersion,
}) => {
  const [versions, setVersions] = useState<StudioVersionSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [versionDesc, setVersionDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchVersions = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/editor/versions?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      if (res.ok && data.versions) {
        setVersions(data.versions);
      } else {
        setErrorMsg(data.error || 'Failed to load timeline versions');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error fetching versions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, projectId]);

  const handleSaveVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim()) return;

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/editor/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          projectId,
          name: versionName.trim(),
          description: versionDesc.trim(),
          renderSpec: currentSpec,
        }),
      });

      const data = await res.json();
      if (res.ok && data.version) {
        setSuccessMsg(`Saved Version ${data.version.versionNumber}: ${versionName}`);
        setVersionName('');
        setVersionDesc('');
        fetchVersions();
      } else {
        setErrorMsg(data.error || 'Failed to save version checkpoint');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while saving version');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/editor/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          projectId,
          versionNumber,
        }),
      });
      const data = await res.json();
      if (res.ok && data.renderSpec) {
        onRestoreVersion(data.renderSpec);
        setSuccessMsg(`Restored Version ${versionNumber} into Studio timeline.`);
        onClose();
      } else {
        setErrorMsg(data.error || 'Could not restore selected version');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error during restore');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Timeline Version History</h3>
              <p className="text-[11px] text-slate-500">Non-destructive checkpoints &amp; rollback</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Create New Version Checkpoint Form */}
          <form onSubmit={handleSaveVersion} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5 text-red-600" />
              <span>Save Current Timeline Checkpoint</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="e.g. Version 2 - Fillers Removed"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                required
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-hidden"
              />
              <input
                type="text"
                placeholder="Optional notes or changelog"
                value={versionDesc}
                onChange={(e) => setVersionDesc(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-hidden"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving || !versionName.trim()}
              className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving Version...' : 'Save Checkpoint'}</span>
            </button>
          </form>

          {/* Versions List */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Saved Checkpoints ({versions.length})
            </h4>

            {isLoading && versions.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                <span className="text-xs">Loading version history...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                No saved checkpoints yet. Save your first checkpoint above!
              </div>
            ) : (
              <div className="space-y-2">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-red-300 transition-all flex items-center justify-between shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          v{ver.versionNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{ver.description}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{ver.createdAt ? new Date(ver.createdAt).toISOString().replace('T', ' ').slice(0, 16) : 'N/A'}</span>
                        <span>•</span>
                        <span>{ver.renderSpec?.tracks?.length || 0} tracks</span>
                        <span>•</span>
                        <span>{ver.renderSpec?.cuts?.length || 0} cuts</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(ver.versionNumber)}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 text-red-600" />
                      <span>Restore</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
