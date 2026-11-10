import type { UserResponse } from '@/types';

export const byDisplayName = (first: UserResponse, second: UserResponse) => first.displayName.localeCompare(second.displayName, undefined, { sensitivity: 'base' });
