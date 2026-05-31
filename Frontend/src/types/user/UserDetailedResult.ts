import type { ActivityStatus } from "../enums";

export interface UserDetailedResult
{
    displayName: string;
    username: string;
    email: string;
    profileImageUrl: string;
    activityStatus: ActivityStatus;
    accountCreationTime: string;
}