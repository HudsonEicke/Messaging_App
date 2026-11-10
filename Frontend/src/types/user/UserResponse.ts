import type { ActivityStatus } from "../enums";

export interface UserResponse
{
    displayName: string;
    username: string;
    profileImageUrl: string;
    activityStatus: ActivityStatus;
    accountCreationTime: string;
}