import React from 'react';
import { Play, FileVideo, Clock, Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { VideoSession, ProcessingStatus } from '../types';

interface SidebarProps {
  sessions: VideoSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sessions, selectedId, onSelect, onAddNew }) => {
  return (
    <div className="w-80 bg-[#F7F7F5] border-r border-gray-200 h-screen flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2 font-semibold text-gray-700">
          <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <span>Library</span>
        </div>
        <button 
          onClick={onAddNew}
          className="p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-600"
          title="New Session"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 && (
          <div className="text-center py-10 px-4 text-gray-400 text-sm">
            <p>No videos yet.</p>
            <p className="mt-2">Click + to add a YouTube URL or upload a file.</p>
          </div>
        )}

        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`
              group flex flex-col p-3 rounded-lg cursor-pointer transition-all
              ${selectedId === session.id ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-gray-200/50'}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3 overflow-hidden">
                <div className={`
                  w-8 h-8 rounded flex-shrink-0 flex items-center justify-center
                  ${session.status === ProcessingStatus.COMPLETED ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}
                `}>
                  {session.status === ProcessingStatus.COMPLETED ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : session.status === ProcessingStatus.ERROR ? (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <FileVideo className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate" title={session.title}>
                    {session.title || "Untitled Video"}
                  </h3>
                  <div className="flex items-center text-xs text-gray-500 mt-0.5 space-x-2">
                    <span className="truncate">{new Date(session.date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Bar */}
            {session.status !== ProcessingStatus.IDLE && session.status !== ProcessingStatus.COMPLETED && session.status !== ProcessingStatus.READY && session.status !== ProcessingStatus.ERROR && (
               <div className="mt-3 flex items-center space-x-2">
                 <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3"></div>
                 </div>
                 <span className="text-[10px] uppercase font-bold text-blue-600">
                    {session.status === ProcessingStatus.DOWNLOADING ? 'DL' : 'AI'}
                 </span>
               </div>
            )}
            
            {session.status === ProcessingStatus.ERROR && (
                <p className="text-xs text-red-500 mt-2 truncate">{session.error}</p>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>History saved locally</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;