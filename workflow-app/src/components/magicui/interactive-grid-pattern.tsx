import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface InteractiveGridPatternProps {
  gridSize?: number;
  maxOpacity?: number;
  className?: string;
}

const InteractiveGridPattern: React.FC<InteractiveGridPatternProps> = ({
  gridSize = 30,
  maxOpacity = 0.5,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    container.style.setProperty('--mouse-x', `${x}px`);
    container.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn(
        'absolute inset-0 z-0 h-full w-full',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={
          {
            '--grid-size': `${gridSize}px`,
            '--dot-color': 'hsl(222.2 84% 4.9%) / 1',
            '--dot-size': '1px',
            backgroundImage: `radial-gradient(var(--dot-color) var(--dot-size), transparent 0)`,
            backgroundSize: 'var(--grid-size) var(--grid-size)',
            maskImage: `radial-gradient(circle at center, white, transparent 80%)`,
            WebkitMaskImage: `radial-gradient(circle at center, white, transparent 80%)`,
          } as React.CSSProperties
        }
      />
      <div
        className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500"
        style={
          {
            '--grid-size': `${gridSize}px`,
            '--dot-color': 'hsl(222.2 84% 4.9%)',
            '--dot-size': '1px',
            '--max-opacity': maxOpacity,
            backgroundImage: `radial-gradient(var(--dot-color) var(--dot-size), transparent 0)`,
            backgroundSize: 'var(--grid-size) var(--grid-size)',
            maskImage: `radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), white, transparent)`,
            WebkitMaskImage: `radial-gradient(300px circle at var(--mouse-x) var(--mouse-y), white, transparent)`,
            opacity: 'var(--max-opacity)',
          } as React.CSSProperties
        }
      />
    </div>
  );
};

export default InteractiveGridPattern;
