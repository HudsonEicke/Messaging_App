import { findAndReplace } from 'mdast-util-find-and-replace';
import type { PhrasingContent, Root } from 'mdast';

// || on both sides, on one line; text inside code isn't searched, since code nodes have no text children
const SPOILER_PATTERN = /\|\|(.+?)\|\|/g;

// turns ||text|| into a span the Spoiler component renders; a spoiler around formatting, like ||**bold**||, stays as typed
export const remarkSpoilers = () => (tree: Root) =>
{
    findAndReplace(tree, [
        SPOILER_PATTERN,
        (_match: string, hiddenText: string) => ({
            type: 'spoiler',
            children: [{ type: 'text', value: hiddenText }],
            // mdast-util-to-hast builds unknown nodes from hName, so no custom handler is needed
            data: { hName: 'span', hProperties: { dataSpoiler: true } }
        }) as unknown as PhrasingContent
    ]);
};

// for places that show raw message text, like reply previews
export const hideSpoilers = (text: string): string => text.replace(SPOILER_PATTERN, 'Spoiler');
