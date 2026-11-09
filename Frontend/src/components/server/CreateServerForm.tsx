import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '@/store/store';
import { createServer } from '@/store/serverSlice';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SERVER_NAME_MAX_LENGTH, createServerSchema } from './CreateServerForm.schema';
import type { CreateServerFormValues } from './CreateServerForm.schema';

interface CreateServerFormProps
{
    onDone: () => void;
}

const CreateServerForm = ({ onDone }: CreateServerFormProps) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting }
    } = useForm<CreateServerFormValues>({
        resolver: zodResolver(createServerSchema),
        defaultValues: { serverName: '' }
    });

    const onSubmit = async (values: CreateServerFormValues) =>
    {
        setServerError(null);

        try
        {
            const server = await dispatch(createServer({ serverName: values.serverName })).unwrap();

            onDone();
            navigate(`/channels/${server.serverID}`);
        }
        catch (error)
        {
            setServerError(getErrorMessage(error, 'Could not create server'));
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor="server-name">Server name</Label>
                <Input
                    id="server-name"
                    autoComplete="off"
                    maxLength={SERVER_NAME_MAX_LENGTH}
                    aria-invalid={!!errors.serverName}
                    {...register('serverName')}
                />
                {errors.serverName && <p className="text-sm text-destructive">{errors.serverName.message}</p>}
                {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            </div>

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create server'}
                </Button>
            </DialogFooter>
        </form>
    );
};

export default CreateServerForm;
