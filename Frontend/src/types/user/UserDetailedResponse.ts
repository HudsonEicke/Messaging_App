import type { ActivityStatus } from "../enums";

export interface UserDetailedResponse
{
    displayName: string;
    username: string;
    email: string;
    profileImageUrl: string;
    activityStatus: ActivityStatus;
    accountCreationTime: string;
}