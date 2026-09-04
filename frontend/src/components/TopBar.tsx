'use client';

import React from 'react';
import { Search, Filter, RotateCw } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-gray-100 bg-white shrink-0">
      {/* Search Input Bar (Figma pill style) */}
      <div className="flex items-center space-x-3 w-full max-w-xl">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full pl-10 pr-4 py-2 bg-[#F1F3F4] hover:bg-gray-200/80 focus:bg-white text-xs text-gray-800 placeholder-gray-500 rounded-full border border-transparent focus:border-gray-300 focus:outline-none transition-all"
          />
        </div>

        {/* Filter Funnel Icon */}
        <button
          type="button"
          title="Filter emails"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Filter className="w-4 h-4" />
        </button>

        {/* Refresh Circular Arrow Icon */}
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh email list"
          className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors ${
            isRefreshing ? 'animate-spin text-emerald-600' : ''
          }`}
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
