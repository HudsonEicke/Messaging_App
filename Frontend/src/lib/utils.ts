import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import axios from 'axios';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ApiError
{
    status?: number;
    message: string;
}

export const getApiError = (err: unknown, fallback: string): ApiError => {
    if (!axios.isAxiosError(err))
    {
        return { message: fallback };
    }

    const status = err.response?.status;
    const data = err.response?.data;

    // BadRequest("..."), Conflict("..."), etc. return the message as a plain string
    if (typeof data === 'string' && data.trim() !== '')
    {
        return { status, message: data };
    }

    if (typeof data?.message === 'string')
    {
        return { status, message: data.message };
    }

    // ProblemDetails from NotFound(), BadRequest() with no message, etc.
    if (typeof data?.title === 'string')
    {
        return { status, message: data.title };
    }

    return { status, message: fallback };
};

export const getInitials = (name: string): string => {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => [...word][0] ?? '')
        .join('')
        .toUpperCase();
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string')
    {
        return error.message;
    }

    return fallback;
};

// clipboard access can be refused (permissions, insecure origin); copying is best effort
export const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).catch(() => undefined);
};

export const getAbsoluteUrl = (path: string): string => new URL(path, window.location.origin).href;
