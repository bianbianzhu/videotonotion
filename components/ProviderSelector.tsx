import React from 'react';
import { Key, Cloud, Zap, Database, HardDrive } from 'lucide-react';
import { AIConfig, GeminiConfig, VertexConfig } from '../services/aiProviderService';
import { VERTEX_LOCATIONS, VERTEX_DEFAULT_LOCATION } from '../constants';

interface ProviderSelectorProps {
  config: AIConfig;
  onChange: (config: AIConfig) => void;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({ config, onChange }) => {
  const isGemini = config.provider === 'gemini';
  const isInline = config.strategy === 'inline';
  const isGcs = config.strategy === 'gcs';

  const handleProviderChange = (provider: 'gemini' | 'vertex') => {
    if (provider === 'gemini') {
      // When switching to Gemini, convert 'gcs' to 'inline' (gcs is not valid for Gemini)
      const strategy = config.strategy === 'gcs' ? 'inline' : (config.strategy || 'inline');
      onChange({
        provider: 'gemini',
        apiKey: '',
        strategy: strategy as 'inline' | 'filesApi',
      } as GeminiConfig);
    } else {
      // When switching to Vertex AI, convert 'filesApi' to 'inline' (filesApi is not valid for Vertex)
      const strategy = config.strategy === 'filesApi' ? 'inline' : (config.strategy || 'inline');
      onChange({
        provider: 'vertex',
        projectId: '',
        location: VERTEX_DEFAULT_LOCATION,
        strategy: strategy as 'inline' | 'gcs',
      } as VertexConfig);
    }
  };

  const handleGeminiStrategyChange = (strategy: 'inline' | 'filesApi') => {
    onChange({ ...config, strategy } as GeminiConfig);
  };

  const handleVertexStrategyChange = (strategy: 'inline' | 'gcs') => {
    onChange({ ...config, strategy } as VertexConfig);
  };

  return (
    <div className="flex items-center space-x-3 flex-wrap gap-y-2">
      {/* Provider Toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => handleProviderChange('gemini')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            isGemini
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Key className="w-4 h-4 inline mr-1" />
          Gemini API
        </button>
        <button
          onClick={() => handleProviderChange('vertex')}
          className={`px-3 py-1 text-sm rounded-md transition-colors ${
            !isGemini
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Cloud className="w-4 h-4 inline mr-1" />
          Vertex AI
        </button>
      </div>

      {/* Strategy Toggle - Provider-specific */}
      {isGemini ? (
        /* Gemini: Inline or Files API */
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleGeminiStrategyChange('inline')}
            title="Inline Data: Chunks large videos, processes sequentially"
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              isInline
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-1" />
            Inline
          </button>
          <button
            onClick={() => handleGeminiStrategyChange('filesApi')}
            title="Files API: Uploads entire video (up to 2GB), no chunking"
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              !isInline
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Database className="w-4 h-4 inline mr-1" />
            Files API
          </button>
        </div>
      ) : (
        /* Vertex AI: Inline or GCS Bucket */
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleVertexStrategyChange('inline')}
            title="Inline Data: Chunks large videos, processes sequentially"
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              isInline
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-1" />
            Inline
          </button>
          <button
            onClick={() => handleVertexStrategyChange('gcs')}
            title="GCS Bucket: Uploads entire video to Google Cloud Storage"
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              isGcs
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <HardDrive className="w-4 h-4 inline mr-1" />
            GCS Bucket
          </button>
        </div>
      )}
      {!isInline && (
        <span className="text-xs text-gray-500" title="No size limit, no chunking">
          {isGemini ? '(up to 2GB)' : '(requires bucket)'}
        </span>
      )}

      {/* Gemini Config */}
      {isGemini && (
        <div
          className={`flex items-center px-3 py-1.5 rounded-lg border ${
            !(config as GeminiConfig).apiKey
              ? 'border-red-300 bg-red-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <Key className="w-4 h-4 text-gray-400 mr-2" />
          <input
            type="password"
            placeholder="Gemini API Key"
            value={(config as GeminiConfig).apiKey || ''}
            onChange={(e) =>
              onChange({
                ...config,
                apiKey: e.target.value,
              } as GeminiConfig)
            }
            className="text-sm bg-transparent border-none focus:ring-0 w-40 placeholder-gray-400"
          />
        </div>
      )}

      {/* Vertex Config */}
      {!isGemini && (
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <input
            type="text"
            placeholder="Project ID (optional)"
            value={(config as VertexConfig).projectId || ''}
            onChange={(e) =>
              onChange({
                ...config,
                projectId: e.target.value,
              } as VertexConfig)
            }
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 w-40 placeholder-gray-400"
          />
          <select
            value={(config as VertexConfig).location || VERTEX_DEFAULT_LOCATION}
            onChange={(e) =>
              onChange({
                ...config,
                location: e.target.value,
              } as VertexConfig)
            }
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50"
          >
            {VERTEX_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
          {/* GCS Bucket Name - optional, server uses GCS_BUCKET_NAME env var as fallback */}
          {isGcs && (
            <div className="flex items-center px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50">
              <HardDrive className="w-4 h-4 text-gray-400 mr-2" />
              <input
                type="text"
                placeholder="GCS Bucket (optional)"
                value={(config as VertexConfig).gcsBucket || ''}
                onChange={(e) =>
                  onChange({
                    ...config,
                    gcsBucket: e.target.value,
                  } as VertexConfig)
                }
                className="text-sm bg-transparent border-none focus:ring-0 w-40 placeholder-gray-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderSelector;
