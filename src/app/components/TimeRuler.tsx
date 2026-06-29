"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TimeRulerProps {
  fromTime: string;
  toTime: string;
  onFromTimeChange: (time: string) => void;
  onToTimeChange: (time: string) => void;
  disabled: boolean;
}

export default function TimeRuler({ fromTime, toTime, onFromTimeChange, onToTimeChange, disabled }: TimeRulerProps) {
  const fromMinutes = parseInt(fromTime.split(':')[0]) * 60 + parseInt(fromTime.split(':')[1]);
  const toMinutes = parseInt(toTime.split(':')[0]) * 60 + parseInt(toTime.split(':')[1]);
  const validFromMinutes = isNaN(fromMinutes) ? 0 : fromMinutes;
  const validToMinutes = isNaN(toMinutes) ? 1439 : toMinutes;

  return (
    <div className={`px-4 pb-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <TimeRulerInner
        fromMinutes={validFromMinutes}
        toMinutes={validToMinutes}
        onFromTimeChange={onFromTimeChange}
        onToTimeChange={onToTimeChange}
      />
    </div>
  );
}

interface TimeRulerInnerProps {
  fromMinutes: number;
  toMinutes: number;
  onFromTimeChange: (time: string) => void;
  onToTimeChange: (time: string) => void;
}

function TimeRulerInner({ fromMinutes, toMinutes, onFromTimeChange, onToTimeChange }: TimeRulerInnerProps) {
  const [isDragging, setIsDragging] = useState<'from' | 'to' | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const fromTimeRef = useRef(fromMinutes);
  const toTimeRef = useRef(toMinutes);

  useEffect(() => { fromTimeRef.current = fromMinutes; }, [fromMinutes]);
  useEffect(() => { toTimeRef.current = toMinutes; }, [toMinutes]);

  const handleRulerMouseDown = useCallback((handle: 'from' | 'to') => {
    setIsDragging(handle);
  }, []);

  useEffect(() => {
    if (!isDragging || !rulerRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = rulerRef.current!.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const minutes = Math.round(ratio * 1440);
      
      if (isDragging === 'from') {
        const clamped = Math.min(minutes, toTimeRef.current - 1);
        const h = String(Math.floor(clamped / 60)).padStart(2, '0');
        const m = String(clamped % 60).padStart(2, '0');
        onFromTimeChange(`${h}:${m}`);
      } else {
        const clamped = Math.max(minutes, fromTimeRef.current + 1);
        const h = String(Math.floor(clamped / 60)).padStart(2, '0');
        const m = String(clamped % 60).padStart(2, '0');
        onToTimeChange(`${h}:${m}`);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onFromTimeChange, onToTimeChange]);

  const minutesToTime = (m: number) => {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    return `${h}:${min}`;
  };

  return (
    <div
      ref={rulerRef}
      className="relative h-7 rounded overflow-hidden cursor-default"
      style={{ background: "linear-gradient(to bottom, #DCE8D8, #C8DEC8)" }}
    >
      {/* Hour labels */}
      {Array.from({ length: 25 }, (_, i) => (
        <span
          key={i}
          className="absolute text-[8px] pointer-events-none text-[#204D4C]"
          style={{ left: `${(i / 24) * 100}%`, transform: 'translateX(-50%)', top: 2 }}
        >
          {String(i % 24).padStart(2, "0")}:00
        </span>
      ))}
      
      {/* Hour ticks */}
      {Array.from({ length: 25 }, (_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none h-1.5"
          style={{ left: `${(i / 24) * 100}%`, width: 1, top: 12, backgroundColor: 'rgba(32, 77, 76, 0.2)' }}
        />
      ))}
      
      {/* Dimmed left */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: 0,
          width: `${fromMinutes / 1440 * 100}%`,
          top: 0,
          height: '100%',
          background: 'rgba(32, 77, 76, 0.5)',
        }}
      />
      
      {/* Dimmed right */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: 0,
          width: `${(1440 - toMinutes) / 1440 * 100}%`,
          top: 0,
          height: '100%',
          background: 'rgba(32, 77, 76, 0.5)',
        }}
      />
      
      {/* Selected range fill */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${fromMinutes / 1440 * 100}%`,
          width: `${(toMinutes - fromMinutes) / 1440 * 100}%`,
          top: 0,
          height: '100%',
          background: 'rgba(81, 160, 144, 0.15)',
        }}
      />
      
      {/* Handle tracks */}
      <div
        className="absolute h-4 pointer-events-none"
        style={{ left: `${fromMinutes / 1440 * 100}%`, width: 16, top: 10, transform: 'translateX(-50%)' }}
      />
      <div
        className="absolute h-4 pointer-events-none"
        style={{ left: `${toMinutes / 1440 * 100}%`, width: 16, top: 10, transform: 'translateX(-50%)' }}
      />
      
      {/* Handles */}
      <div
        className="absolute w-3 h-5 cursor-ew-resize rounded-sm"
        style={{
          left: `${fromMinutes / 1440 * 100}%`,
          top: 10,
          transform: 'translateX(-50%)',
          background: '#51A090',
        }}
        onMouseDown={() => handleRulerMouseDown('from')}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 60 : 5;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const newMinutes = Math.max(0, fromMinutes - step);
            onFromTimeChange(minutesToTime(newMinutes));
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const newMinutes = Math.min(1439, fromMinutes + step);
            onFromTimeChange(minutesToTime(newMinutes));
          }
        }}
        tabIndex={0}
        role="slider"
        aria-label="From time"
        aria-valuemin={0}
        aria-valuemax={1439}
        aria-valuenow={fromMinutes}
      >
        <div
          className="absolute w-1 h-4 bg-blue-400 rounded-full"
          style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
        />
      </div>
      <div
        className="absolute w-3 h-5 cursor-ew-resize rounded-sm"
        style={{
          left: `${toMinutes / 1440 * 100}%`,
          top: 10,
          transform: 'translateX(-50%)',
          background: '#51A090',
        }}
        onMouseDown={() => handleRulerMouseDown('to')}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 60 : 5;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const newMinutes = Math.max(0, toMinutes - step);
            onToTimeChange(minutesToTime(newMinutes));
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const newMinutes = Math.min(1439, toMinutes + step);
            onToTimeChange(minutesToTime(newMinutes));
          }
        }}
        tabIndex={0}
        role="slider"
        aria-label="To time"
        aria-valuemin={0}
        aria-valuemax={1439}
        aria-valuenow={toMinutes}
      >
        <div
          className="absolute w-1 h-4 bg-blue-400 rounded-full"
          style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
        />
      </div>
      
      {/* Subtle inner shadow */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)" }} />
    </div>
  );
}
