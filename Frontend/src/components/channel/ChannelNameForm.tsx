import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CHANNEL_NAME_MAX_LENGTH, channelNameSchema } from './ChannelNameForm.schema';
import type { ChannelNameFormValues } from './ChannelNameForm.schema';

interface ChannelNameFormProps
{
    defaultName?: string;
    submitLabel: string;
    submittingLabel: string;
    // rejects with the error to show under the field; resolving is left to the caller (close, navigate)
    onSubmit: (channelName: string) => Promise<void>;
    // rendered between the field and the footer, e.g. the settings dialog's delete section
    children?: ReactNode;
}

// the name field and footer shared by the create and settings dialogs, so both validate names the same way
const ChannelNameForm = ({ defaultName = '', submitLabel, submittingLabel, onSubmit, children }: ChannelNameFormProps) =>
{
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm<ChannelNameFormValues>({
        resolver: zodResolver(channelNameSchema),
        defaultValues: { channelName: defaultName }
    });

    const submit = async (values: ChannelNameFormValues) =>
    {
        setServerError(null);

        try
        {
            await onSubmit(values.channelName);
        }
        catch (error)
        {
            setServerError(getErrorMessage(error, 'Something went wrong, try again'));
        }
    };

    return (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor="channel-name">Channel name</Label>
                <Input
                    id="channel-name"
                    autoComplete="off"
                    maxLength={CHANNEL_NAME_MAX_LENGTH}
                    aria-invalid={!!errors.channelName}
                    {...register('channelName')}
                />
                {errors.channelName && <p className="text-sm text-destructive">{errors.channelName.message}</p>}
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>

            {children}

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? submittingLabel : submitLabel}
                </Button>
            </DialogFooter>
        </form>
    );
};

export default ChannelNameForm;
