import { memo } from 'react';
import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface MarkdownNode
{
    type: string;
    value?: string;
    children?: MarkdownNode[];
    position?: { start: { offset?: number }; end: { offset?: number } };
}

const BLOCKS_SHOWN_AS_TEXT = new Set(['table', 'thematicBreak', 'footnoteDefinition']);
const INLINES_SHOWN_AS_TEXT = new Set(['footnoteReference']);

// chat doesn't render these, so put back what was typed
const remarkPlainUnsupported = () => (tree: MarkdownNode, file: { value: unknown }) =>
{
    const source = String(file.value);

    const replaceUnsupported = (node: MarkdownNode) =>
    {
        node.children = node.children?.map(child =>
        {
            const start = child.position?.start.offset;
            const end = child.position?.end.offset;
            const isBlock = BLOCKS_SHOWN_AS_TEXT.has(child.type);

            if ((isBlock || INLINES_SHOWN_AS_TEXT.has(child.type)) && start !== undefined && end !== undefined)
            {
                const text: MarkdownNode = { type: 'text', value: source.slice(start, end) };
                return isBlock ? { type: 'paragraph', children: [text] } : text;
            }

            replaceUnsupported(child);
            return child;
        });
    };

    replaceUnsupported(tree);
};

const remarkPlugins = [remarkGfm, remarkPlainUnsupported, remarkBreaks];

const linkClassName = 'text-sky-600 underline-offset-2 hover:underline dark:text-sky-400';

// headings are styled paragraphs so a message can't add headings to the page outline
const components: Components = {
    p: ({ children }) => <p>{children}</p>,
    h1: ({ children }) => <p className="text-xl leading-7 font-bold">{children}</p>,
    h2: ({ children }) => <p className="text-lg leading-6 font-bold">{children}</p>,
    h3: ({ children }) => <p className="font-semibold">{children}</p>,
    h4: ({ children }) => <p className="font-semibold">{children}</p>,
    h5: ({ children }) => <p className="font-semibold">{children}</p>,
    h6: ({ children }) => <p className="font-semibold">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    // react-markdown blanks unsafe hrefs like javascript:, so those become plain text
    a: ({ href, children }) => href
        ? <a href={href} target="_blank" rel="noreferrer noopener" className={linkClassName}>{children}</a>
        : <span>{children}</span>,
    // a link instead of the picture, so nobody can embed huge images or tracking pixels
    img: ({ src, alt }) => (
        <a href={typeof src === 'string' ? src : undefined} target="_blank" rel="noreferrer noopener" className={linkClassName}>
            {alt || (typeof src === 'string' ? src : 'image')}
        </a>
    ),
    blockquote: ({ children }) => <blockquote className="border-l-4 border-border pl-3">{children}</blockquote>,
    ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
    ol: ({ children, start }) => <ol start={start} className="list-decimal pl-5">{children}</ol>,
    pre: ({ children }) => (
        <pre className="max-w-full overflow-x-auto rounded-md border bg-muted p-2 font-mono text-xs leading-5 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-xs">
            {children}
        </pre>
    ),
    code: ({ className, children }) => <code className={`rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] ${className ?? ''}`}>{children}</code>
};

// display: contents lets "(edited)" sit on the same line as the last paragraph
const MessageMarkdown = ({ text }: { text: string }) =>
{
    return (
        <div className="contents [&>*+*]:mt-1 [&>p:last-child]:inline">
            <Markdown remarkPlugins={remarkPlugins} components={components}>{text}</Markdown>
        </div>
    );
};

export default memo(MessageMarkdown);
