const REPLY_PREVIEW_LENGTH = 100;

export const shortenReplyPreview = (messageText: string): string =>
{
    if (messageText.length <= REPLY_PREVIEW_LENGTH)
    {
        return messageText;
    }

    const lastCode = messageText.charCodeAt(REPLY_PREVIEW_LENGTH - 1);
    const isHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
    const cutIndex = isHighSurrogate ? REPLY_PREVIEW_LENGTH - 1 : REPLY_PREVIEW_LENGTH;

    return `${messageText.slice(0, cutIndex).trimEnd()}…`;
};
