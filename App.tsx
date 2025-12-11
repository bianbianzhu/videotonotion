import React, { useState, useEffect } from 'react';
import { Play, Sparkles } from 'lucide-react';
import VideoInput from './components/VideoInput';
import ProcessingView from './components/ProcessingView';
import NotesPreview from './components/NotesPreview';
import Sidebar from './components/Sidebar';
import ProviderSelector from './components/ProviderSelector';
import { NoteSegment, ProcessingStatus, VideoSession, ChunkContext } from './types';
import { createAIProvider, AIConfig, isConfigValid, getDefaultConfig } from './services/aiProviderService';
import { fileToBase64, extractFrameFromVideo } from './utils/videoUtils';
import {
  isYouTubeUrl,
  startYouTubeDownload,
  fetchChunk,
  getFullVideoUrl,
  cleanupSession as cleanupYouTubeSession,
  extractFrameFromServer,
} from './services/youtubeApiService';
import {
  uploadVideoForChunking,
  fetchUploadedChunk,
  getUploadedVideoUrl,
  cleanupUploadSession,
  extractFrameFromUpload,
} from './services/uploadApiService';
import {
  getSessions as fetchSessionsFromApi,
  getSession as fetchSessionFromApi,
  createSession as createSessionInDb,
  updateSession as updateSessionInDb,
  deleteSession as deleteSessionFromDb,
  saveNotes as saveNotesToDb,
  toVideoSession,
} from './services/sessionApiService';
import { migrateFromLocalStorage, hasLocalStorageData } from './services/migrationService';
import { CHUNK_SIZE_THRESHOLD_MB } from './constants';

const simpleId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [aiConfig, setAiConfig] = useState<AIConfig>(getDefaultConfig());
  const [sessions, setSessions] = useState<VideoSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load sessions from database on mount (with migration from localStorage)
  useEffect(() => {
    const loadSessions = async () => {
      try {
        // Check if there's localStorage data to migrate
        if (hasLocalStorageData()) {
          console.log('Found localStorage data, migrating to database...');
          await migrateFromLocalStorage();
        }

        // Fetch sessions from database
        const response = await fetchSessionsFromApi(1, 100);
        const loadedSessions: VideoSession[] = [];

        for (const item of response.sessions) {
          try {
            const detail = await fetchSessionFromApi(item.id);
            loadedSessions.push(toVideoSession(detail) as VideoSession);
          } catch (e) {
            console.warn(`Failed to load session ${item.id}:`, e);
          }
        }

        setSessions(loadedSessions);
      } catch (e) {
        console.error('Failed to load sessions from database:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSessions();
  }, []);

  // Derived state
  const selectedSession = sessions.find((s) => s.id === selectedId);
  const isConfigReady = isConfigValid(aiConfig);

  // --- Actions ---

  const handleAddNew = () => {
    setSelectedId(null);
  };

  const handleDeleteSession = async (id: string) => {
    const session = sessions.find((s) => s.id === id);

    // Cleanup backend YouTube session if exists
    if (session?.youtubeSessionId) {
      cleanupYouTubeSession(session.youtubeSessionId).catch(console.error);
    }

    // Cleanup backend upload session if exists
    if (session?.uploadSessionId) {
      cleanupUploadSession(session.uploadSessionId).catch(console.error);
    }

    // Delete from database
    try {
      await deleteSessionFromDb(id);
    } catch (e) {
      console.error('Failed to delete session from database:', e);
    }

    // Remove from state
    setSessions((prev) => prev.filter((s) => s.id !== id));

    // Deselect if this was the selected session
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const handleImportUrl = async (url: string) => {
    const newSession: VideoSession = {
      id: simpleId(),
      title: url,
      url: url,
      date: new Date(),
      status: ProcessingStatus.DOWNLOADING,
      progress: 0,
    };

    setSessions((prev) => [newSession, ...prev]);
    setSelectedId(newSession.id);

    try {
      if (isYouTubeUrl(url)) {
        // Use backend for YouTube
        const result = await startYouTubeDownload(url);

        updateSession(newSession.id, {
          title: result.title,
          youtubeSessionId: result.sessionId,
          chunks: result.chunks,
          status: ProcessingStatus.READY,
          progress: 100,
        });
      } else {
        // Direct fetch for non-YouTube URLs
        const response = await fetch(url).catch(() => {
          throw new Error('Network error: Possible CORS restriction on this URL.');
        });

        if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);

        const blob = await response.blob();

        updateSession(newSession.id, {
          file: blob,
          title: url.split('/').pop() || 'Downloaded Video',
          status: ProcessingStatus.READY,
          progress: 100,
        });
      }
    } catch (err: any) {
      console.error(err);
      updateSession(newSession.id, {
        status: ProcessingStatus.ERROR,
        error: err.message || 'Could not download video.',
      });
    }
  };

  const handleUploadFile = async (file: File) => {
    const chunkThresholdBytes = CHUNK_SIZE_THRESHOLD_MB * 1024 * 1024;

    // For small files, use direct processing (no backend upload)
    if (file.size <= chunkThresholdBytes) {
      const newSession: VideoSession = {
        id: simpleId(),
        title: file.name,
        file: file,
        date: new Date(),
        status: ProcessingStatus.READY,
      };
      setSessions((prev) => [newSession, ...prev]);
      setSelectedId(newSession.id);
      return;
    }

    // For large files, upload to backend for chunking
    const newSession: VideoSession = {
      id: simpleId(),
      title: file.name,
      date: new Date(),
      status: ProcessingStatus.UPLOADING,
      progress: 0,
    };

    setSessions((prev) => [newSession, ...prev]);
    setSelectedId(newSession.id);

    try {
      const result = await uploadVideoForChunking(file, (progress) => {
        updateSession(newSession.id, { progress });
      });

      updateSession(newSession.id, {
        title: result.title || file.name,
        uploadSessionId: result.sessionId,
        chunks: result.chunks,
        totalDuration: result.duration,
        status: ProcessingStatus.READY,
        progress: 100,
      });
    } catch (err: any) {
      console.error('Upload error:', err);
      updateSession(newSession.id, {
        status: ProcessingStatus.ERROR,
        error: err.message || 'Could not upload video for processing.',
      });
    }
  };

  const handleProcessSession = async () => {
    if (!selectedSession || !isConfigReady) return;

    const provider = createAIProvider(aiConfig);

    updateSession(selectedSession.id, { status: ProcessingStatus.UPLOADING });

    try {
      let allSegments: NoteSegment[] = [];
      let videoUrlForFrames: string;

      if (selectedSession.chunks && selectedSession.youtubeSessionId) {
        // YouTube video with chunks - process each chunk
        const chunks = selectedSession.chunks;
        let previousTopics: string[] = [];

        // Calculate total duration from last chunk's end time
        const totalDuration = selectedSession.totalDuration || (chunks.length > 0 ? chunks[chunks.length - 1].endTime : 0);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          updateSession(selectedSession.id, {
            status: ProcessingStatus.ANALYZING,
            currentChunk: i + 1,
            progress: Math.round(((i + 1) / chunks.length) * 100),
          });

          // Fetch chunk from backend
          const chunkBlob = await fetchChunk(selectedSession.youtubeSessionId, chunk.id);
          const base64Data = await fileToBase64(chunkBlob as File);

          // Build chunk context for AI
          const chunkContext: ChunkContext = {
            chunkNumber: i + 1,
            totalChunks: chunks.length,
            chunkStartTime: chunk.startTime,
            chunkEndTime: chunk.endTime,
            totalDuration,
            previousTopics: i > 0 ? previousTopics : undefined,
          };

          // Process with AI provider (with chunk context)
          const segments = await provider.generateNotesFromVideo(base64Data, 'video/mp4', chunkContext);

          // Extract topics for next chunk's context
          previousTopics = segments.map((s) => s.title);

          // Adjust timestamps based on chunk start time
          const adjustedSegments = segments.map((s) => ({
            ...s,
            timestamp: s.timestamp + chunk.startTime,
          }));

          allSegments.push(...adjustedSegments);
        }

        // Use full video URL for frame extraction
        videoUrlForFrames = getFullVideoUrl(selectedSession.youtubeSessionId);
      } else if (selectedSession.chunks && selectedSession.uploadSessionId) {
        // Uploaded local video with chunks - process each chunk
        const chunks = selectedSession.chunks;
        let previousTopics: string[] = [];

        const totalDuration = selectedSession.totalDuration || (chunks.length > 0 ? chunks[chunks.length - 1].endTime : 0);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          updateSession(selectedSession.id, {
            status: ProcessingStatus.ANALYZING,
            currentChunk: i + 1,
            progress: Math.round(((i + 1) / chunks.length) * 100),
          });

          // Fetch chunk from backend
          const chunkBlob = await fetchUploadedChunk(selectedSession.uploadSessionId, chunk.id);
          const base64Data = await fileToBase64(chunkBlob as File);

          // Build chunk context for AI
          const chunkContext: ChunkContext = {
            chunkNumber: i + 1,
            totalChunks: chunks.length,
            chunkStartTime: chunk.startTime,
            chunkEndTime: chunk.endTime,
            totalDuration,
            previousTopics: i > 0 ? previousTopics : undefined,
          };

          // Process with AI provider (with chunk context)
          const segments = await provider.generateNotesFromVideo(base64Data, 'video/mp4', chunkContext);

          // Extract topics for next chunk's context
          previousTopics = segments.map((s) => s.title);

          // Adjust timestamps based on chunk start time
          const adjustedSegments = segments.map((s) => ({
            ...s,
            timestamp: s.timestamp + chunk.startTime,
          }));

          allSegments.push(...adjustedSegments);
        }

        // Use full video URL for frame extraction
        videoUrlForFrames = getUploadedVideoUrl(selectedSession.uploadSessionId);
      } else if (selectedSession.file) {
        // Direct upload - single file processing
        const file = selectedSession.file as File;
        const base64Data = await fileToBase64(file);

        updateSession(selectedSession.id, { status: ProcessingStatus.ANALYZING });
        allSegments = await provider.generateNotesFromVideo(base64Data, file.type || 'video/mp4');

        videoUrlForFrames = URL.createObjectURL(file);
      } else {
        throw new Error('No video file available for processing');
      }

      // Extract frames
      updateSession(selectedSession.id, { status: ProcessingStatus.EXTRACTING_FRAMES });

      const enrichedSegments: NoteSegment[] = [];
      for (const segment of allSegments) {
        try {
          let frameData: string;
          if (selectedSession.youtubeSessionId) {
            // Use server-side ffmpeg for YouTube videos (more reliable)
            frameData = await extractFrameFromServer(selectedSession.youtubeSessionId, segment.timestamp);
          } else if (selectedSession.uploadSessionId) {
            // Use server-side ffmpeg for uploaded chunked videos
            frameData = await extractFrameFromUpload(selectedSession.uploadSessionId, segment.timestamp);
          } else {
            // Use browser-side extraction for small direct uploads
            frameData = await extractFrameFromVideo(videoUrlForFrames, segment.timestamp);
          }
          enrichedSegments.push({ ...segment, image: frameData });
        } catch (err) {
          console.warn(`Frame skip at ${segment.timestamp}`, err);
          enrichedSegments.push(segment);
        }
      }

      // Cleanup blob URL for direct uploads
      if (!selectedSession.youtubeSessionId && !selectedSession.uploadSessionId && videoUrlForFrames.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrlForFrames);
      }

      // Update local state
      updateSession(selectedSession.id, {
        status: ProcessingStatus.COMPLETED,
        notes: enrichedSegments,
        currentChunk: undefined,
      });

      // Save to database (creates or updates session with notes and images)
      try {
        await createSessionInDb({
          id: selectedSession.id,
          title: selectedSession.title,
          url: selectedSession.url,
          thumbnail: selectedSession.thumbnail,
          date: selectedSession.date.toISOString(),
          status: ProcessingStatus.COMPLETED,
          youtubeSessionId: selectedSession.youtubeSessionId,
          uploadSessionId: selectedSession.uploadSessionId,
          totalDuration: selectedSession.totalDuration,
          chunks: selectedSession.chunks,
          notes: enrichedSegments,
        });
        console.log('Session saved to database with images');
      } catch (dbError) {
        console.error('Failed to save session to database:', dbError);
        // Still show success to user since processing completed
      }

      // TODO: Re-enable cleanup after fixing frame extraction
      // Cleanup YouTube session after successful processing
      // if (selectedSession.youtubeSessionId) {
      //   cleanupYouTubeSession(selectedSession.youtubeSessionId).catch(console.error);
      // }
    } catch (err: any) {
      updateSession(selectedSession.id, {
        status: ProcessingStatus.ERROR,
        error: err.message || 'Processing failed',
        currentChunk: undefined,
      });
    }
  };

  const updateSession = (id: string, updates: Partial<VideoSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans text-slate-800">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAddNew={handleAddNew}
        onDelete={handleDeleteSession}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {selectedSession ? (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 truncate max-w-md">
                  {selectedSession.title}
                </h2>
              </div>
            ) : (
              <h2 className="text-lg font-semibold text-gray-500">New Import</h2>
            )}
          </div>

          <ProviderSelector config={aiConfig} onChange={setAiConfig} />
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto bg-white relative">
          {/* Case 1: No Session Selected (New) */}
          {!selectedSession && (
            <VideoInput onImport={handleImportUrl} onUpload={handleUploadFile} isLoading={isLoading} />
          )}

          {/* Case 2: Session Selected */}
          {selectedSession && (
            <div className="max-w-4xl mx-auto py-10 px-8">
              {/* Status: Downloading/Uploading or Error */}
              {(selectedSession.status === ProcessingStatus.DOWNLOADING ||
                (selectedSession.status === ProcessingStatus.UPLOADING && !selectedSession.chunks) ||
                selectedSession.status === ProcessingStatus.ERROR) && (
                <div className="text-center py-20">
                  {(selectedSession.status === ProcessingStatus.DOWNLOADING ||
                    (selectedSession.status === ProcessingStatus.UPLOADING && !selectedSession.chunks)) && (
                    <div className="flex flex-col items-center">
                      <ProcessingView status={ProcessingStatus.UPLOADING} />
                      <p className="mt-4 text-gray-500">
                        {selectedSession.status === ProcessingStatus.DOWNLOADING
                          ? isYouTubeUrl(selectedSession.url || '')
                            ? 'Downloading YouTube video...'
                            : 'Downloading video...'
                          : 'Uploading video for processing...'}
                      </p>
                      {selectedSession.progress !== undefined && selectedSession.progress > 0 && (
                        <div className="w-64 bg-gray-200 rounded-full h-2 mt-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${selectedSession.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedSession.status === ProcessingStatus.ERROR && (
                    <div className="bg-red-50 p-6 rounded-xl border border-red-100 inline-block text-left">
                      <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                      <p className="text-red-600 mb-4">{selectedSession.error}</p>
                      <button
                        onClick={() => setSelectedId(null)}
                        className="text-sm underline text-red-700"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status: Ready to Process */}
              {selectedSession.status === ProcessingStatus.READY && (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Play className="w-10 h-10 ml-1" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Video Ready</h2>
                  <p className="text-gray-500 mb-2 max-w-md mx-auto">
                    {selectedSession.chunks
                      ? `Video will be processed in ${selectedSession.chunks.length} chunk(s).`
                      : 'The video is loaded and ready to process.'}
                  </p>
                  <p className="text-gray-400 text-sm mb-8">
                    Using {aiConfig.provider === 'gemini' ? 'Gemini API' : 'Vertex AI'} for analysis
                  </p>
                  <button
                    onClick={handleProcessSession}
                    disabled={!isConfigReady}
                    className="bg-black text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Notes</span>
                  </button>
                  {!isConfigReady && (
                    <p className="text-xs text-red-500 mt-3">
                      {aiConfig.provider === 'gemini'
                        ? 'API Key required'
                        : 'Project ID required'}
                    </p>
                  )}
                </div>
              )}

              {/* Status: Processing */}
              {(selectedSession.status === ProcessingStatus.ANALYZING ||
                selectedSession.status === ProcessingStatus.EXTRACTING_FRAMES ||
                selectedSession.status === ProcessingStatus.UPLOADING) && (
                <div className="py-10">
                  <ProcessingView status={selectedSession.status} />
                  {selectedSession.chunks && selectedSession.currentChunk && (
                    <div className="text-center mt-4">
                      <p className="text-gray-500">
                        Processing chunk {selectedSession.currentChunk} of{' '}
                        {selectedSession.chunks.length}
                      </p>
                      <div className="w-64 bg-gray-200 rounded-full h-2 mt-2 mx-auto">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${(selectedSession.currentChunk / selectedSession.chunks.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status: Completed */}
              {selectedSession.status === ProcessingStatus.COMPLETED && selectedSession.notes && (
                <NotesPreview notes={selectedSession.notes} videoTitle={selectedSession.title} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
