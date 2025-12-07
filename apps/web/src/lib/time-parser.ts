/**
 * Natural Language Time Parser
 * Converts natural language time expressions to ISO 8601 timestamps
 */

export interface ParsedTime {
  timestamp: string; // ISO 8601
  isRelative: boolean;
  originalInput: string;
}

export class TimeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeParseError';
  }
}

/**
 * Parse natural language time expression
 * 
 * Supported formats:
 * - Relative: "in 30 minutes", "in 2 hours", "in 5 days"
 * - Absolute time: "at 3 PM", "at 15:30", "at 18:00"
 * - Date with time: "tomorrow at 9 AM", "December 10 at 2 PM"
 * - Special: "noon", "midnight", "tomorrow"
 */
export function parseTime(input: string): ParsedTime {
  const normalizedInput = input.toLowerCase().trim();
  
  // Relative time patterns: "in X minutes/hours/days"
  const relativePattern = /^in\s+(\d+)\s*(minute|minutes|min|hour|hours|hr|hrs|day|days)$/i;
  const relativeMatch = normalizedInput.match(relativePattern);
  
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2].toLowerCase();
    
    const now = new Date();
    
    if (unit.startsWith('min')) {
      now.setMinutes(now.getMinutes() + amount);
    } else if (unit.startsWith('hour') || unit.startsWith('hr')) {
      now.setHours(now.getHours() + amount);
    } else if (unit.startsWith('day')) {
      now.setDate(now.getDate() + amount);
    }
    
    return {
      timestamp: now.toISOString(),
      isRelative: true,
      originalInput: input
    };
  }
  
  // Tomorrow with optional time
  if (normalizedInput.startsWith('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if there's a time specified
    const timeMatch = normalizedInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      
      if (meridiem === 'pm' && hours < 12) {
        hours += 12;
      } else if (meridiem === 'am' && hours === 12) {
        hours = 0;
      }
      
      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
    }
    
    return {
      timestamp: tomorrow.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  // Special keywords
  if (normalizedInput === 'noon') {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    if (noon <= new Date()) {
      noon.setDate(noon.getDate() + 1);
    }
    return {
      timestamp: noon.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  if (normalizedInput === 'midnight') {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    midnight.setDate(midnight.getDate() + 1);
    return {
      timestamp: midnight.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  // Absolute time patterns: "at X PM" or "X:YY PM"
  const timePattern = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const timeMatch = normalizedInput.match(timePattern);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    
    // Convert to 24-hour format
    if (meridiem === 'pm' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    }
    
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    return {
      timestamp: targetTime.toISOString(),
      isRelative: false,
      originalInput: input
    };
  }
  
  // If we can't parse, throw error
  throw new TimeParseError(`Unable to parse time expression: "${input}"`);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) {
    return `today at ${timeStr}`;
  } else if (isTomorrow) {
    return `tomorrow at ${timeStr}`;
  } else {
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    return `${dateStr} at ${timeStr}`;
  }
}
