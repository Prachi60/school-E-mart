import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = ({ 
  title = "No data found", 
  message = "We couldn't find what you're looking for.", 
  icon: Icon = PackageOpen,
  action 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
      <div className="p-4 bg-gray-50 rounded-full mb-6">
        <Icon size={48} className="text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-text-secondary max-w-sm mb-8">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
