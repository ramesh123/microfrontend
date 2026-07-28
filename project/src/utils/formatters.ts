import { format, formatDistanceToNow } from 'date-fns';
import React from 'react';

export const formatDateTime = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  
  try {
    // Explicitly handle UTC to local time conversion
    let date: Date;
    
    // If the string ends with 'Z' or contains timezone info, treat as UTC
    if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-')) {
      // Parse as UTC and convert to local time
      date = new Date(dateString);
    } else {
      // If no timezone info, assume it's UTC and append 'Z' to make it explicit
      date = new Date(dateString + (dateString.includes('T') ? 'Z' : ''));
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return format(date, 'dd-MMM-yyyy, h:mm a');
  } catch (error) {
    return 'Invalid Date';
  }
};

export const formatTimeAgo = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  try {
    // Explicitly handle UTC to local time conversion
    let date: Date;
    
    // If the string ends with 'Z' or contains timezone info, treat as UTC
    if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('-')) {
      // Parse as UTC and convert to local time
      date = new Date(dateString);
    } else {
      // If no timezone info, assume it's UTC and append 'Z' to make it explicit
      date = new Date(dateString + (dateString.includes('T') ? 'Z' : ''));
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return `${formatDistanceToNow(date)} ago`;
  } catch (error) {
    return 'Invalid Date';
  }
}

export const formatDuration = (seconds?: number): string => {
  if (seconds === null || seconds === undefined || seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    return `${remainingSeconds.toFixed(2)}s`;
  }
};

/** e.g. `rollback_running` → `Rollback Running` */
export function formatJobStatusLabel(status?: string | null): string {
  if (status == null || String(status).trim() === '') return '—';
  return String(status)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const getJobStatusColor = (status?: string): string => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'bg-green-500/10 text-green-800 border-green-500/20 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/35';
    case 'failed':
      return 'bg-red-500/10 text-red-800 border-red-500/20 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/35';
    case 'running':
      return 'bg-blue-500/10 text-blue-800 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/35';
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-800 border-yellow-500/20 dark:bg-yellow-500/15 dark:text-yellow-200 dark:border-yellow-500/35';
    case 'queued':
      return 'bg-orange-500/10 text-orange-800 border-orange-500/20 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/35';
    case 'canceled':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/35';
    case 'rolled_back':
    case 'rollback':
      return 'bg-violet-500/10 text-violet-800 border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/40';
    case 'rollback_running':
      return 'bg-cyan-500/10 text-cyan-800 border-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/40';
    case 'rollback_failed':
      return 'bg-rose-500/10 text-rose-800 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/40';
    default:
      return 'bg-gray-500/10 text-gray-800 border-gray-500/20 dark:bg-gray-500/15 dark:text-gray-300 dark:border-gray-500/35';
  }
};

/** Map API / Prefect-style task states to palette keys used by `getTaskStateColorClass`. */
export const normalizeTaskStateForUi = (state?: string | null): string => {
  if (state == null || String(state).trim() === "") return "";
  const t = String(state).toLowerCase().trim().replace(/\s+/g, "_");
  if (["success", "complete", "succeeded", "done", "completed"].includes(t)) return "completed";
  if (["error", "errored", "failure", "failed"].includes(t)) return "failed";
  if (["running", "in_progress", "started"].includes(t)) return "running";
  if (["pending", "queued", "scheduled"].includes(t)) return "pending";
  if (["cancelled", "canceled"].includes(t)) return "cancelled";
  if (["skipped", "not_run"].includes(t)) return "skipped";
  if (["rolled_back", "rollback"].includes(t)) return "rolled_back";
  return t;
};

export const getTaskStateColorClass = (state?: string | null): { bg: string, text: string, border: string, dot: string } => {
  // All cards use blue outline, but badges keep their original colors
  const blueBorder = 'border-l-4 border-t-[0.001rem] border-t-blue-50 border-b-[0.001rem] border-r-[0.001rem] border-blue-500';

  const key = normalizeTaskStateForUi(state);

  switch (key) {
    case "completed":
      return { bg: 'bg-green-500/10 dark:bg-green-500/20', text: 'text-green-800 dark:text-green-300', border: blueBorder, dot: 'bg-green-500' };
    case "failed":
      return { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-800 dark:text-red-300', border: blueBorder, dot: 'bg-red-500' };
    case "running":
      return { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-800 dark:text-blue-300', border: blueBorder, dot: 'bg-blue-500' };
    case "pending":
      return { bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', text: 'text-yellow-900 dark:text-yellow-200', border: blueBorder, dot: 'bg-yellow-500' };
    case "cancelled":
      return { bg: 'bg-slate-500/15 dark:bg-slate-500/25', text: 'text-slate-800 dark:text-slate-200', border: blueBorder, dot: 'bg-slate-500' };
    case "skipped":
      return { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-800 dark:text-orange-200', border: blueBorder, dot: 'bg-orange-500' };
    case "rolled_back":
      return { bg: 'bg-violet-500/10 dark:bg-violet-500/20', text: 'text-violet-800 dark:text-violet-200', border: blueBorder, dot: 'bg-violet-500' };
    default:
      return { bg: 'bg-muted', text: 'text-foreground', border: blueBorder, dot: 'bg-muted-foreground' };
  }
};

export const truncate = (str: string, length: number) => {
  if (!str) return '';
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

// Correct UTC to local time conversion function
export const convertUTCDateToLocalDate = (date: Date): Date => {
  const utcDate = new Date(date.getTime());
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(utcDate.getTime() - (timezoneOffset * 60 * 1000));
  return localDate;
};

export const formatRelativeTime = (updatedAt: string): string => {
  try {
    const utcDate = new Date(updatedAt);
    
    // Check for invalid date
    if (isNaN(utcDate.getTime())) {
      return 'Invalid date';
    }
    
    const localDate = convertUTCDateToLocalDate(utcDate);
    const now = new Date();
    
    const diffInMilliseconds = now.getTime() - localDate.getTime();
    
    // If the date is in the future or less than a second ago, show "Just now"
    if (diffInMilliseconds < 1000) {
      return 'Just now';
    }
    
    // If the date is in the future, show "Future date"
    if (diffInMilliseconds < 0) {
      return 'Future date';
    }
    
    const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'} ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      const remainingMinutes = diffInMinutes % 60;
      return `${diffInHours}h ${remainingMinutes}m ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }
    
    if (diffInDays < 30) {
      const diffInWeeks = Math.floor(diffInDays / 7);
      return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    }
    
    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown time';
  }
};

// Hook for real-time relative time updates
export const useRelativeTime = (timestamp: string): string => {
  const [relativeTime, setRelativeTime] = React.useState<string>(formatRelativeTime(timestamp));

  React.useEffect(() => {
    const updateTime = () => {
      setRelativeTime(formatRelativeTime(timestamp));
    };

    // Update immediately
    updateTime();

    // Update every minute
    const intervalId = setInterval(updateTime, 60000);

    return () => clearInterval(intervalId);
  }, [timestamp]);

  return relativeTime;
};

// Calculate duration between two dates
export const calculateDuration = (startDate: string, endDate: string): string => {
  try {
    if (!startDate || !endDate) return '-';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '-';
    
    // If end date is before start date, return invalid
    if (end < start) return 'Invalid date range';
    
    const diff = end.getTime() - start.getTime();
    
    // Convert to appropriate time units
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    return '-';
  }
};

// Format UTC timestamp to IST
export const formatDateToIST = (utcTimestamp: string): string => {
  try {
    if (!utcTimestamp) return '-';

    // Convert the UTC timestamp to a Date object
    const utcDate = new Date(utcTimestamp);

    // Validate the date
    if (isNaN(utcDate.getTime())) return 'Invalid date';

    // Convert UTC to IST by adding 5 hours 30 minutes
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istDate = new Date(utcDate.getTime() + istOffset);

    // Format as YYYY-MM-DD, h:mm AM/PM
    const year = istDate.getFullYear();
    const month = String(istDate.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const day = String(istDate.getDate()).padStart(2, '0');
    const hours = istDate.getHours() % 12 || 12; // Convert to 12-hour format
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const ampm = istDate.getHours() >= 12 ? 'PM' : 'AM';

    return `${year}-${month}-${day}, ${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting date to IST:', error);
    return 'Invalid date';
  }
};

// Format UTC timestamp to IST time only (for chat messages)
export const formatTimeToIST = (utcTimestamp: string): string => {
  try {
    if (!utcTimestamp) return '';

    // Convert the UTC timestamp to a Date object
    const utcDate = new Date(utcTimestamp);

    // Validate the date
    if (isNaN(utcDate.getTime())) return '';

    // Convert UTC to IST by adding 5 hours 30 minutes
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istDate = new Date(utcDate.getTime() + istOffset);

    // Format as h:mm AM/PM
    const hours = istDate.getHours() % 12 || 12; // Convert to 12-hour format
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const ampm = istDate.getHours() >= 12 ? 'PM' : 'AM';

    return `${hours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time to IST:', error);
    return '';
  }
};
