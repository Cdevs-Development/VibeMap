import React from 'react';

const colorMap = {
  rose: 'border-rose-500 bg-rose-500/10 text-rose-500',
  emerald: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
  blue: 'border-blue-500 bg-blue-500/10 text-blue-500',
  purple: 'border-purple-500 bg-purple-500/10 text-purple-500',
  slate: 'border-slate-500 bg-slate-500/10 text-slate-400',
};

const StatCard = ({ title, value, subtext, icon: Icon, color = 'blue' }) => {
  const colorStyles = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-ops-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        </div>
        <div className={`w-12 h-12 rounded-lg border flex items-center justify-center ${colorStyles}`}>
          <Icon size={24} />
        </div>
      </div>
      {subtext && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-sm text-slate-500">{subtext}</p>
        </div>
      )}
    </div>
  );
};

export default StatCard;
