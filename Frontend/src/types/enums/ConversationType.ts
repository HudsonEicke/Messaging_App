const ConversationType = {
    direct: 0,
    group: 1
} as const;

type ConversationType = (typeof ConversationType)[keyof typeof ConversationType];

export { ConversationType };
