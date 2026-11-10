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
    // from a 400 ValidationProblemDetails, keyed by request field
    fieldErrors?: Record<string, string[]>;
}

// JSON parse errors are keyed like "$.displayName", attribute errors by the bare name
const getFieldErrors = (errors: unknown): Record<string, string[]> | undefined => {
    if (typeof errors !== 'object' || errors === null)
    {
        return undefined;
    }

    const fieldErrors: Record<string, string[]> = {};

    for (const [key, messages] of Object.entries(errors))
    {
        if (Array.isArray(messages))
        {
            fieldErrors[key.replace(/^\$\./, '')] = messages.filter((message): message is string => typeof message === 'string');
        }
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
};

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

    // the title only says "One or more validation errors occurred.", so lead with the first field's message
    const fieldErrors = getFieldErrors(data?.errors);
    const firstFieldError = fieldErrors && Object.values(fieldErrors).flat()[0];

    if (fieldErrors && firstFieldError)
    {
        return { status, message: firstFieldError, fieldErrors };
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
