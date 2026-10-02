import React, { useState, useEffect, useRef } from 'react';
import { getLiveSos, resolveSos } from '../api/adminService';
import SosMap from '../components/sos/SosMap';
import { ShieldAlert, MapPin, Phone, Clock, CheckCircle } from 'lucide-react';

const LiveSosPage = () => {
  const [sosList, setSosList] = useState([]);
  const [selectedSosId, setSelectedSosId] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [activeModalId, setActiveModalId] = useState(null);
  const isFetchingRef = useRef(false);

  const fetchSos = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await getLiveSos();
      setSosList(data);
    } catch (err) {
      console.error('Failed to fetch SOS:', err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchSos();
    const interval = setInterval(fetchSos, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (id) => {
    setIsResolving(true);
    try {
      await resolveSos(id, resolveNote || '');
      setActiveModalId(null);
      setResolveNote('');
      fetchSos(); // Refresh list immediately
    } catch (err) {
      console.error('Failed to resolve SOS:', err);
      alert(`Failed to resolve incident: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setIsResolving(false);
    }
  };

  // Helper to format elapsed time
  const getElapsedTimeString = (timestamp) => {
    const diff = Math.floor((new Date() - new Date(timestamp)) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Derived state
  const selectedSos = sosList.find(s => s.id === selectedSosId) || null;

  return (
    <div className="flex flex-col h-full md:flex-row gap-6">
      {/* Left Column: Incident Queue */}
      <div className="w-full md:w-1/2 lg:w-5/12 flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="text-rose-500" /> Live SOS Triage
            </h1>
            <p className="text-slate-400 mt-1">Real-time incident queue</p>
          </div>
          <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            {sosList.length} Active
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {sosList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-ops-900 border border-slate-800 rounded-xl">
              <CheckCircle size={48} className="text-emerald-500/50 mb-4" />
              <p className="text-lg font-medium">No active emergencies at this time.</p>
              <p className="text-sm">All operations normal</p>
            </div>
          ) : (
            sosList.map((sos) => (
              <div 
                key={sos.id} 
                className={`bg-ops-900 border ${selectedSosId === sos?.id ? 'border-rose-500' : 'border-slate-800'} rounded-xl p-5 shadow-sm transition-all hover:border-rose-500/50`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{sos?.user || 'Unknown User'}</h3>
                    <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                      <Phone size={14} /> {sos?.phone || 'No Phone Number'}
                    </div>
                    <div className="mt-2">
                      {sos?.is_acknowledged ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
                          <CheckCircle size={12} /> Acknowledged in {sos.response_time_formatted} by {sos.acknowledging_beneficiary_name || 'Beneficiary'}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Awaiting Beneficiary Response
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-rose-400 font-mono text-sm bg-rose-500/10 px-2 py-1 rounded">
                      <Clock size={14} /> 
                      {getElapsedTimeString(sos?.timestamp || new Date().toISOString())}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setSelectedSosId(sos?.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <MapPin size={16} /> Locate
                  </button>
                  <button
                    onClick={() => setActiveModalId(sos?.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 text-sm font-medium rounded-lg transition-colors"
                  >
                    <CheckCircle size={16} /> Resolve
                  </button>
                </div>

                {/* Resolution Modal/Inline Form */}
                {activeModalId === sos.id && (
                  <div className="mt-4 pt-4 border-t border-slate-800 animate-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">Resolution Notes</label>
                    <textarea
                      className="w-full bg-ops-950 border border-slate-700 rounded-lg p-3 text-white text-sm focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500"
                      rows="3"
                      placeholder="Enter details on how this incident was resolved..."
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                    ></textarea>
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => setActiveModalId(null)}
                        className="px-3 py-1.5 text-sm text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleResolve(sos?.id)}
                        disabled={isResolving || !sos?.id}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded shadow-sm disabled:opacity-50"
                      >
                        {isResolving ? 'Resolving...' : 'Confirm Resolution'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Tactical Map */}
      <SosMap 
        sosList={sosList} 
        selectedSos={selectedSos} 
        setSelectedSosId={setSelectedSosId} 
      />
    </div>
  );
};

export default LiveSosPage;
