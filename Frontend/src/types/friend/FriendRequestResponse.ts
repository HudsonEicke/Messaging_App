import { FriendStatus } from "../enums";
import type { UserResponse } from "../user";

export interface FriendRequestResponse
{
    status: FriendStatus;
    user: UserResponse;
}
