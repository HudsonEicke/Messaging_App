const ActivityStatus = {
    online: 0,
    away: 1,
    dnd: 2,
    offline: 3
} as const;

type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export { ActivityStatus };
