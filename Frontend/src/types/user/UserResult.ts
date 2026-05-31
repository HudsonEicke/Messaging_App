import type { ActivityStatus } from "../enums";

export interface UserResult
{
    displayName: string;
    username: string;
    profileImageUrl: string;
    activityStatus: ActivityStatus;
    accountCreationTime: string;
}