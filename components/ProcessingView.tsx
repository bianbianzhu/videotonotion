import React from 'react';
import { Loader2, Film, BrainCircuit, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { ProcessingStatus } from '../types';

interface ProcessingViewProps {
  status: ProcessingStatus;
  progress?: number; // Optional 0-100
}

const ProcessingView: React.FC<ProcessingViewProps> = ({ status }) => {
  const steps = [
    { id: ProcessingStatus.UPLOADING, label: 'Uploading Video', icon: Film },
    { id: ProcessingStatus.ANALYZING, label: 'Gemini Analysis', icon: BrainCircuit },
    { id: ProcessingStatus.EXTRACTING_FRAMES, label: 'Extracting Key Frames', icon: ImageIcon },
    { id: ProcessingStatus.COMPLETED, label: 'Done', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === status);
  
  if (status === ProcessingStatus.IDLE || status === ProcessingStatus.ERROR) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="space-y-6">
        {steps.slice(0, 3).map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex || status === ProcessingStatus.COMPLETED;
            
            return (
                <div key={step.id} className="flex items-center space-x-4">
                    <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300
                        ${isCompleted ? 'bg-green-100 text-green-600' : isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}
                    `}>
                        {isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <step.icon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                        <p className={`font-medium ${isActive || isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                            {step.label}
                        </p>
                        {isActive && (
                            <div className="h-1 w-full bg-gray-100 rounded-full mt-2 overflow-hidden">
                                <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '60%' }}></div>
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default ProcessingView;
