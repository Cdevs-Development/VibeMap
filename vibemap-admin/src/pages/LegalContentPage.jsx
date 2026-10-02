import React, { useState, useEffect } from 'react';
import { getLegalDoc, updateLegalDoc } from '../api/adminService';
import { 
  FileText, Shield, Save, RefreshCw, CheckCircle2, 
  AlertCircle, Eye, Edit3, Clock, User, Sparkles, X 
} from 'lucide-react';

const LegalContentPage = () => {
  const [activeDocType, setActiveDocType] = useState('terms_of_service'); // 'terms_of_service' | 'privacy_policy'
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'edit' | 'preview' | 'split'

  const fetchDocument = async (type) => {
    try {
      setLoading(true);
      const data = await getLegalDoc(type);
      setDoc(data);
      setTitle(data.title || '');
      setContent(data.content || '');
      setVersion(data.version || '1.0');
    } catch (err) {
      console.error('Failed to load legal document:', err);
      setFeedback({ type: 'error', text: err.message || 'Failed to load document' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument(activeDocType);
  }, [activeDocType]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSaving(true);
      const res = await updateLegalDoc(activeDocType, {
        title: title.trim(),
        content: content.trim(),
        version: version.trim() || undefined
      });

      setDoc(res.document);
      setVersion(res.document.version);
      setFeedback({ type: 'success', text: res.message || 'Policy published successfully!' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to publish changes' });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  // Simple Markdown renderer helper for preview pane
  const renderMarkdownPreview = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      // H1
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-bold text-white mt-4 mb-2 pb-1 border-b border-slate-700">{line.slice(2)}</h1>;
      }
      // H2
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-semibold text-rose-400 mt-4 mb-2">{line.slice(3)}</h2>;
      }
      // H3
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-lg font-medium text-slate-200 mt-3 mb-1">{line.slice(4)}</h3>;
      }
      // Bullet list
      if (line.trim().startsWith('- ')) {
        return (
          <li key={idx} className="ml-5 list-disc text-slate-300 text-sm my-1">
            {line.trim().slice(2)}
          </li>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-3" />;
      }
      // Paragraph
      return (
        <p key={idx} className="text-slate-300 text-sm leading-relaxed my-1">
          {line}
        </p>
      );
    });
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="text-rose-500" size={26} />
            Legal & Policy Content CMS
          </h1>
          <p className="text-slate-400 mt-1">Publish and modify live Terms of Service and Privacy Policy without deploying code.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode buttons */}
          <div className="bg-ops-900 border border-slate-800 rounded-lg p-1 flex items-center">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'edit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 size={13} /> Edit
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`hidden md:flex px-3 py-1.5 rounded-md text-xs font-medium transition-colors items-center gap-1.5 ${
                viewMode === 'split' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={13} /> Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'preview' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={13} /> Preview
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-rose-600/20 disabled:opacity-50"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            Publish Changes
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-3 rounded-lg text-sm font-medium border flex items-center justify-between transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Document Selection Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveDocType('terms_of_service')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeDocType === 'terms_of_service'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText size={16} /> Terms of Service
        </button>
        <button
          onClick={() => setActiveDocType('privacy_policy')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeDocType === 'privacy_policy'
              ? 'border-rose-500 text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield size={16} /> Privacy Policy
        </button>
      </div>

      {/* Metadata Bar */}
      {doc && (
        <div className="bg-ops-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Document Display Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Document Title"
              className="w-full px-3 py-1.5 bg-ops-950 border border-slate-700 rounded-lg text-sm font-semibold text-white focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          <div className="w-full sm:w-32">
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Version Tag
            </label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 1.1"
              className="w-full px-3 py-1.5 bg-ops-950 border border-slate-700 rounded-lg text-sm text-white font-mono text-center focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          <div className="text-xs text-slate-400 space-y-1 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
            <p className="flex items-center gap-1 sm:justify-end">
              <User size={12} className="text-slate-500" />
              Modified By: <span className="text-slate-200 font-medium">{doc.updated_by || 'System'}</span>
            </p>
            <p className="flex items-center gap-1 sm:justify-end">
              <Clock size={12} className="text-slate-500" />
              Updated: <span className="text-slate-200">{doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : '-'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Editor & Preview Area */}
      <div className="flex-1 bg-ops-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden min-h-[450px]">
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 h-full divide-y md:divide-y-0 md:divide-x divide-slate-800">
            {/* Editor Pane */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className={`flex flex-col h-full ${viewMode === 'edit' ? 'md:col-span-2' : ''}`}>
                <div className="px-4 py-2 bg-ops-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 flex justify-between items-center">
                  <span>Markdown Source</span>
                  <span className="text-[11px] font-mono text-slate-500">{content.length} chars • {content.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write your markdown terms or policy here..."
                  className="w-full flex-1 p-4 bg-ops-950 font-mono text-sm text-slate-200 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                  style={{ minHeight: '400px' }}
                />
              </div>
            )}

            {/* Preview Pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={`flex flex-col h-full bg-ops-900 overflow-y-auto ${viewMode === 'preview' ? 'md:col-span-2' : ''}`}>
                <div className="px-4 py-2 bg-ops-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
                  <span>Live Rendered Preview</span>
                  <span className="text-[11px] text-emerald-400 font-medium">Auto-syncing</span>
                </div>
                <div className="p-6 prose prose-invert max-w-none">
                  {renderMarkdownPreview(content)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalContentPage;
