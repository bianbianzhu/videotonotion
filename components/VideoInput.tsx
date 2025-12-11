import React, { useState } from 'react';
import { Upload, Link as LinkIcon, ArrowRight, FileVideo } from 'lucide-react';
import { MAX_VIDEO_SIZE_MB, CHUNK_SIZE_THRESHOLD_MB } from '../constants';

interface VideoInputProps {
  onImport: (url: string) => void;
  onUpload: (file: File) => void;
  isLoading: boolean;
}

const VideoInput: React.FC<VideoInputProps> = ({ onImport, onUpload, isLoading }) => {
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onImport(url);
      setUrl('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto mt-20">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Add a video to get started</h1>
        <p className="text-gray-500">Paste a URL to download and analyze content.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'url' ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Video URL
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload' ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Upload File
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'url' ? (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="url"
                  className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="https://youtu.be/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!url || isLoading}
                className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <span>Download & Import</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-gray-400 text-center">
                Note: Client-side YouTube downloading may be restricted by browser CORS. 
                Direct MP4 links work best.
              </p>
            </form>
          ) : (
            <div 
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept="video/*"
                onChange={handleFileChange}
                disabled={isLoading}
              />
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-gray-900 font-medium">Click to upload video</p>
              <p className="text-gray-500 text-sm mt-1">MP4, WebM up to {MAX_VIDEO_SIZE_MB}MB</p>
              <p className="text-gray-400 text-xs mt-1">Files over {CHUNK_SIZE_THRESHOLD_MB}MB will be split into chunks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoInput;