import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  if (isToday(date)) return format(date, 'h:mm a')
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d')
}

export function formatLastSeen(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateUsername(email: string): string {
  return email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
}
