import React, { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { NoteSegment } from '../types';
import { Copy, Download, Share2 } from 'lucide-react';

interface NotesPreviewProps {
  notes: NoteSegment[];
  videoTitle?: string;
}

const NotesPreview: React.FC<NotesPreviewProps> = ({ notes, videoTitle = "Innovation Session" }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = () => {
    if (!contentRef.current) return;
    
    // Create a range to select the content
    const range = document.createRange();
    range.selectNode(contentRef.current);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    
    try {
        document.execCommand('copy');
        alert('Notes copied to clipboard! Paste into Notion.');
    } catch (err) {
        console.error('Failed to copy', err);
    }
    
    window.getSelection()?.removeAllRanges();
  };

  const downloadHtml = () => {
     if (!contentRef.current) return;
     const htmlContent = `
        <html>
            <head>
                <meta charset="utf-8">
                <title>${videoTitle}</title>
            </head>
            <body>
                ${contentRef.current.innerHTML}
            </body>
        </html>
     `;
     const blob = new Blob([htmlContent], { type: 'text/html' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `${videoTitle.replace(/\s+/g, '_').toLowerCase()}_notes.html`;
     a.click();
     URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8">
        <div className="flex justify-between items-center mb-4 px-4">
            <h2 className="text-xl font-bold text-gray-800">Generated Notes</h2>
            <div className="flex space-x-2">
                <button onClick={copyToClipboard} className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                    <Copy className="w-4 h-4" />
                    <span>Copy for Notion</span>
                </button>
                <button onClick={downloadHtml} className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors">
                    <Download className="w-4 h-4" />
                    <span>Download HTML</span>
                </button>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Simulation of Notion Window */}
            <div className="h-8 bg-gray-50 border-b border-gray-200 flex items-center px-4 space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>

            <div ref={contentRef} className="p-12 min-h-[600px] outline-none">
                <h1 className="notion-h1 mb-8">{videoTitle}</h1>
                
                {notes.map((segment, idx) => (
                    <div key={idx} className="mb-8">
                        <h2 className="notion-h2 text-gray-800 flex items-center group">
                            {segment.title}
                            <span className="ml-3 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                {new Date(segment.timestamp * 1000).toISOString().substr(14, 5)}
                            </span>
                        </h2>
                        
                        {(segment.image || segment.imageUrl) && (
                            <div className="notion-img-container my-4">
                                <img
                                    src={segment.image || segment.imageUrl}
                                    alt={`Slide for ${segment.title}`}
                                    className="notion-img rounded-lg border border-gray-100 shadow-sm"
                                />
                            </div>
                        )}
                        
                        <div className="notion-prose text-gray-600 leading-relaxed">
                            <ReactMarkdown>{segment.markdown}</ReactMarkdown>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default NotesPreview;
