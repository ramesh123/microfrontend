import React, { useEffect, useRef } from 'react';
import '@svar-ui/react-grid/dist/grid.css';

export const GridTest: React.FC<{ data: any[]; columns: any[] }> = ({ data, columns }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadGrid = async () => {
      try {
        const module = await import('@svar-ui/react-grid') as any;
        console.log('Module exports:', Object.keys(module));
        console.log('Default export:', module.default);
        
        // Log all available exports to identify correct initialization
        Object.entries(module).forEach(([key, value]) => {
          console.log(`${key}:`, typeof value);
        });
      } catch (err) {
        console.error('Module load error:', err);
      }
    };

    loadGrid();
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '500px' }} />;
};
