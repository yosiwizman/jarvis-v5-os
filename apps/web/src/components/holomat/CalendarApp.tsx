'use client';

import React, { useState } from 'react';

interface CalendarAppProps {
  onClose: () => void;
}

export function CalendarApp({ onClose }: CalendarAppProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    
    // Add empty slots for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();

  return (
    <div className="relative w-[500px] bg-black/80 backdrop-blur-xl border-2 border-purple-400/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(168,85,247,0.4)]">
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-6 cursor-grab active:cursor-grabbing" 
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">📅</div>
          <h2 className="text-xl font-bold text-purple-400 tracking-wider">CALENDAR</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
        >
          ✕
        </button>
      </div>

      {/* Month/Year Navigation */}
      <div className="mb-6 flex items-center justify-between p-4 bg-purple-950/30 border-2 border-purple-400/30 rounded-xl">
        <button
          onClick={previousMonth}
          className="p-2 hover:bg-purple-500/20 rounded-lg transition-all hover:scale-110 text-purple-300 border border-purple-400/30"
        >
          ◀
        </button>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-100 tracking-wider">
            {monthNames[currentDate.getMonth()]}
          </div>
          <div className="text-lg text-purple-300 tracking-widest">
            {currentDate.getFullYear()}
          </div>
        </div>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-purple-500/20 rounded-lg transition-all hover:scale-110 text-purple-300 border border-purple-400/30"
        >
          ▶
        </button>
      </div>

      {/* Current Date Display */}
      <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-lg text-center">
        <div className="text-sm text-purple-300">TODAY</div>
        <div className="text-lg font-bold text-purple-100">
          {today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-2 mb-3">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-bold text-purple-400 tracking-wider p-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => (
          <div
            key={index}
            className={`
              relative aspect-square flex items-center justify-center rounded-lg text-lg font-bold
              transition-all duration-200
              ${day ? 'cursor-pointer hover:scale-110' : ''}
              ${isToday(day)
                ? 'bg-purple-500/40 border-2 border-purple-300 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                : day
                ? 'bg-purple-950/30 border border-purple-400/20 text-purple-100 hover:bg-purple-500/20 hover:border-purple-400/50'
                : 'bg-transparent'
              }
            `}
          >
            {day}
            {day && (
              <>
                <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-purple-400/50" />
                <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-purple-400/50" />
                <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-purple-400/50" />
                <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-purple-400/50" />
              </>
            )}
            {isToday(day) && (
              <div className="absolute inset-0 rounded-lg animate-pulse bg-purple-400/20" />
            )}
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="mt-4 text-center text-xs text-purple-400/60 tracking-wider">
        HOLOMAT CALENDAR SYSTEM • STARDATE {Math.floor(Date.now() / 1000)}
      </div>
    </div>
  );
}

