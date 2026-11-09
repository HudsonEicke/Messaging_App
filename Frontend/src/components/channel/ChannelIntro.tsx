import { Hash } from 'lucide-react';

const INTRO_LINES: ((channelName: string) => string)[] = [
    channelName => `Every great conversation starts somewhere. This is where #${channelName} began.`,
    channelName => `You've scrolled all the way back. This is the very first page of #${channelName}.`,
    channelName => `Nothing older than this. #${channelName} started right here.`,
    channelName => `You found the beginning of #${channelName}. Everything below is history.`,
    channelName => `Before this, #${channelName} was just an idea.`,
    channelName => `The first chapter of #${channelName}. Pull up a chair.`
];

interface ChannelIntroProps
{
    channelID: number;
    channelName: string;
}

// picked by channel id so each channel keeps the same line
const ChannelIntro = ({ channelID, channelName }: ChannelIntroProps) =>
{
    const introLine = INTRO_LINES[channelID % INTRO_LINES.length];

    return (
        <div className="flex flex-col gap-2">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Hash className="size-9 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-2xl font-bold break-words">#{channelName}</p>
            <p className="text-sm text-muted-foreground">{introLine(channelName)}</p>
        </div>
    );
};

export default ChannelIntro;
