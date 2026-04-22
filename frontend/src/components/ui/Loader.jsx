import React from 'react';

const Loader = ({ fullPage = false, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  const loaderContent = (
    <div className="flex flex-col items-center justify-center">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-primary/20 border-t-primary`}
      ></div>
      {fullPage && <p className="mt-4 text-sm font-medium text-text-secondary animate-pulse">Loading School E-Mart...</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
};

export default Loader;
