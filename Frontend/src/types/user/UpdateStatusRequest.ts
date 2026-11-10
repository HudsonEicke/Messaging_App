import type { ActivityStatus } from "../enums";

export interface UpdateStatusRequest
{
    newStatus: ActivityStatus;
}