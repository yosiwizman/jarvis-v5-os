'use client';

import React, { useState, useEffect } from 'react';

interface CalendarAppProps {
  onClose: () => void;
}

interface CalendarEvent {
  id: string;
  summary: string | null;
  start: string | null;
  end: string | null;
  location?: string | null;
  description?: string | null;
}

export function CalendarApp({ onClose }: CalendarAppProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  // Fetch events on mount
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/google-calendar/sync-events?limit=20');
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }
      
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
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

  const hasEvents = (day: number | null) => {
    if (!day) return false;
    return events.some(event => {
      if (!event.start) return false;
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const getEventsForDay = (day: number | null): CalendarEvent[] => {
    if (!day) return [];
    return events.filter(event => {
      if (!event.start) return false;
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  const getUpcomingEvents = (): CalendarEvent[] => {
    const now = new Date();
    return events
      .filter(event => event.start && new Date(event.start) > now)
      .sort((a, b) => {
        const dateA = a.start ? new Date(a.start).getTime() : 0;
        const dateB = b.start ? new Date(b.start).getTime() : 0;
        return dateA - dateB;
      })
      .slice(0, 5);
  };

  const formatEventTime = (dateString: string | null) => {
    if (!dateString) return 'No time';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return 'Invalid time';
    }
  };

  const formatEventDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch {
      return 'Invalid date';
    }
  };

  const handleDayClick = (day: number | null) => {
    if (!day) return;
    const dayEvents = getEventsForDay(day);
    if (dayEvents.length > 0) {
      setSelectedDay(day);
      setSelectedEvent(null);
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="relative w-[700px] h-[800px] bg-black/80 backdrop-blur-xl border-2 border-purple-400/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(168,85,247,0.4)] overflow-hidden flex flex-col">
      {/* Header */}
      <div 
        className="flex items-center justify-between mb-4 cursor-grab active:cursor-grabbing" 
        data-drag-handle
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">📅</div>
          <h2 className="text-xl font-bold text-purple-400 tracking-wider">CALENDAR</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/30 rounded-lg text-sm text-purple-200 transition-all disabled:opacity-50"
          >
            {loading ? '↻' : '⟳'} Refresh
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 border border-red-400/30"
          >
            ✕
          </button>
        </div>
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

      {/* Error Display */}
      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-xs">
          ⚠️ {error === 'google_calendar_not_configured' ? 'Google Calendar not configured' : error}
        </div>
      )}

      {/* Current Date Display */}
      <div className="mb-3 p-2 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30 rounded-lg text-center">
        <div className="text-xs text-purple-300">TODAY</div>
        <div className="text-sm font-bold text-purple-100">
          {today.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
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
      <div className="grid grid-cols-7 gap-2 mb-4">
        {days.map((day, index) => {
          const dayHasEvents = hasEvents(day);
          return (
            <div
              key={index}
              onClick={() => handleDayClick(day)}
              className={`
                relative aspect-square flex items-center justify-center rounded-lg text-sm font-bold
                transition-all duration-200
                ${day ? 'cursor-pointer hover:scale-105' : ''}
                ${isToday(day)
                  ? 'bg-purple-500/40 border-2 border-purple-300 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                  : day
                  ? 'bg-purple-950/30 border border-purple-400/20 text-purple-100 hover:bg-purple-500/20 hover:border-purple-400/50'
                  : 'bg-transparent'
                }
              `}
            >
              {day}
              {day && dayHasEvents && (
                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_rgba(34,211,238,0.8)]" />
              )}
              {day && (
                <>
                  <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-purple-400/50" />
                  <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-purple-400/50" />
                  <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-purple-400/50" />
                  <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-purple-400/50" />
                </>
              )}
              {isToday(day) && (
                <div className="absolute inset-0 rounded-lg animate-pulse bg-purple-400/20" />
              )}
            </div>
          );
        })}
      </div>

      {/* Upcoming Events Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <h3 className="text-sm font-bold text-purple-300 mb-2 tracking-wider">
          {selectedDay ? `EVENTS FOR ${monthNames[currentDate.getMonth()]} ${selectedDay}` : 'UPCOMING EVENTS'}
        </h3>
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading && (
            <div className="text-center text-purple-300/60 py-4">
              <div className="animate-pulse">Loading events...</div>
            </div>
          )}
          
          {!loading && selectedDay && (
            <>
              <button
                onClick={() => setSelectedDay(null)}
                className="mb-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                ← Back to upcoming
              </button>
              {getEventsForDay(selectedDay).length === 0 ? (
                <div className="text-center text-purple-300/60 py-4 text-sm">
                  No events on this day
                </div>
              ) : (
                getEventsForDay(selectedDay).map((event) => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                    className="p-3 bg-purple-950/30 border border-cyan-400/30 rounded-lg hover:bg-cyan-500/10 cursor-pointer transition-all"
                  >
                    <div className="font-bold text-cyan-300 text-sm mb-1">
                      {event.summary || '(No title)'}
                    </div>
                    <div className="text-xs text-purple-200 mb-1">
                      🕒 {formatEventTime(event.start)}
                      {event.end && ` - ${formatEventTime(event.end)}`}
                    </div>
                    {event.location && (
                      <div className="text-xs text-purple-300/80">
                        📍 {event.location}
                      </div>
                    )}
                    {selectedEvent?.id === event.id && event.description && (
                      <div className="mt-2 pt-2 border-t border-purple-400/20 text-xs text-purple-200">
                        {event.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {!loading && !selectedDay && (
            <>
              {upcomingEvents.length === 0 ? (
                <div className="text-center text-purple-300/60 py-4 text-sm">
                  {error ? 'Unable to load events' : 'No upcoming events'}
                </div>
              ) : (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                    className="p-3 bg-purple-950/30 border border-purple-400/30 rounded-lg hover:bg-purple-500/20 cursor-pointer transition-all"
                  >
                    <div className="font-bold text-purple-200 text-sm mb-1">
                      {event.summary || '(No title)'}
                    </div>
                    <div className="text-xs text-purple-300 mb-1">
                      📅 {formatEventDate(event.start)}
                    </div>
                    {event.location && (
                      <div className="text-xs text-purple-300/80">
                        📍 {event.location}
                      </div>
                    )}
                    {selectedEvent?.id === event.id && event.description && (
                      <div className="mt-2 pt-2 border-t border-purple-400/20 text-xs text-purple-200">
                        {event.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-3 text-center text-xs text-purple-400/60 tracking-wider">
        HOLOMAT CALENDAR • {events.length} EVENT{events.length !== 1 ? 'S' : ''}
      </div>
    </div>
  );
}

