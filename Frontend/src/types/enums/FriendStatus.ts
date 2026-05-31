const FriendStatus = {
    pending: 0,
    friends: 1,
    blocked: 2
} as const;

type FriendStatus = (typeof FriendStatus)[keyof typeof FriendStatus];

export { FriendStatus };
