import { useRef, useState, useLayoutEffect } from 'react';

interface AutoFitTextProps {
  text: string;
  maxFontSize?: number;
  minFontSize?: number;
  className?: string;
}

export function AutoFitText({ text, maxFontSize = 60, minFontSize = 16, className = "" }: AutoFitTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl || !text) return;

    const adjustSize = () => {
      // Reset to max to start measurement
      textEl.style.fontSize = `${maxFontSize}px`;
      
      let min = minFontSize;
      let max = maxFontSize;
      let fit = minFontSize;

      // Binary search for perfect font size that fits container
      while (min <= max) {
        const mid = Math.floor((min + max) / 2);
        textEl.style.fontSize = `${mid}px`;
        
        // We consider it a fit if text height is less than container height.
        // We also check width just in case.
        if (textEl.scrollHeight <= container.clientHeight && textEl.scrollWidth <= container.clientWidth) {
          fit = mid;
          min = mid + 1; // See if we can grow larger
        } else {
          max = mid - 1; // Too big, must shrink
        }
      }

      setFontSize(fit);
      textEl.style.fontSize = `${fit}px`;
    };

    // Run adjustment immediately
    adjustSize();

    // Set up resize observer to dynamically adjust when window resizes
    let animationFrameId: number;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(adjustSize);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [text, maxFontSize, minFontSize]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-start overflow-hidden py-2 px-1">
      <p 
        ref={textRef} 
        className={`text-center break-words w-full ${className}`} 
        style={{ fontSize: `${fontSize}px`, transition: 'font-size 0.05s ease-out' }}
      >
        {text}
      </p>
    </div>
  );
}
