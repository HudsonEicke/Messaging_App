import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Check, Copy } from 'lucide-react';
import type { AppDispatch } from '@/store/store';
import { createInvite } from '@/store/serverSlice';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DAY_MS = 24 * 60 * 60 * 1000;
const COPIED_RESET_MS = 2000;

// 0 means never / no limit, which the backend takes as a missing field
const EXPIRY_OPTIONS = [
    { days: 0, label: 'Never' },
    { days: 1, label: '1 day' },
    { days: 7, label: '7 days' }
];

const MAX_USES_OPTIONS = [0, 1, 5, 10, 25];

interface InviteDialogProps
{
    serverId: number;
    serverName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const InviteDialog = ({ serverId, serverName, open, onOpenChange }: InviteDialogProps) =>
{
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite people to {serverName}</DialogTitle>
                    <DialogDescription>Share the code. People join from the + button in the server list.</DialogDescription>
                </DialogHeader>

                {/* a separate component so its state resets each time the dialog opens */}
                <InviteGenerator serverId={serverId} />
            </DialogContent>
        </Dialog>
    );
};

const InviteGenerator = ({ serverId }: { serverId: number }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [expiryDays, setExpiryDays] = useState(7);
    const [maxUses, setMaxUses] = useState(0);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() =>
    {
        if (!isCopied)
        {
            return;
        }

        const timeoutId = setTimeout(() => setIsCopied(false), COPIED_RESET_MS);

        return () => clearTimeout(timeoutId);
    }, [isCopied]);

    const handleGenerate = async () =>
    {
        setIsGenerating(true);
        setError(null);

        try
        {
            const { invite } = await dispatch(createInvite({
                serverID: serverId,
                request: {
                    expiresDate: expiryDays === 0 ? undefined : new Date(Date.now() + expiryDays * DAY_MS).toISOString(),
                    maxUses: maxUses === 0 ? undefined : maxUses
                }
            })).unwrap();

            setInviteCode(invite.inviteCode);
            setIsCopied(false);
        }
        catch (generateError)
        {
            setError(getErrorMessage(generateError, 'Could not create invite'));
        }
        finally
        {
            setIsGenerating(false);
        }
    };

    const handleCopy = async () =>
    {
        if (inviteCode === null)
        {
            return;
        }

        try
        {
            await navigator.clipboard.writeText(inviteCode);
            setIsCopied(true);
        }
        catch
        {
            // the clipboard API needs a secure context and permission
            setError("Couldn't copy, select the code and copy it yourself");
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                    <Label htmlFor="invite-expiry">Expires after</Label>
                    <Select value={String(expiryDays)} onValueChange={value => setExpiryDays(Number(value))}>
                        <SelectTrigger id="invite-expiry" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                            {EXPIRY_OPTIONS.map(option => <SelectItem key={option.days} value={String(option.days)}>{option.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="invite-max-uses">Max uses</Label>
                    <Select value={String(maxUses)} onValueChange={value => setMaxUses(Number(value))}>
                        <SelectTrigger id="invite-max-uses" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                            {MAX_USES_OPTIONS.map(uses => <SelectItem key={uses} value={String(uses)}>{uses === 0 ? 'No limit' : uses}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Button type="button" variant={inviteCode === null ? 'default' : 'outline'} disabled={isGenerating} onClick={handleGenerate}>
                {isGenerating ? 'Generating...' : inviteCode === null ? 'Generate invite' : 'Generate new invite'}
            </Button>

            {
                inviteCode !== null && (
                    <div className="grid gap-2">
                        <Label htmlFor="invite-code">Invite code</Label>
                        <div className="flex gap-2">
                            <Input id="invite-code" readOnly value={inviteCode} className="font-mono text-xs" onFocus={event => event.target.select()} />
                            <Button type="button" variant="outline" className="shrink-0" onClick={handleCopy}>
                                {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                                {isCopied ? 'Copied!' : 'Copy'}
                            </Button>
                        </div>
                    </div>
                )
            }

            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
};

export default InviteDialog;
