import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch, useSelector } from 'react-redux';
import { FriendStatus } from '@/types';
import type { ApiError } from '@/lib/utils';
import type { AppDispatch, RootState } from '@/store/store';
import { sendFriendRequest } from '@/store/friendSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addFriendSchema } from './AddFriendForm.schema';
import type { AddFriendFormValues } from './AddFriendForm.schema';

const AddFriendForm = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const currentUsername = useSelector((state: RootState) => state.user.user?.username);
    const [result, setResult] = useState<{ isError: boolean; message: string } | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm<AddFriendFormValues>({
        resolver: zodResolver(addFriendSchema),
        defaultValues: { username: '' }
    });

    const onSubmit = async (values: AddFriendFormValues) =>
    {
        setResult(null);

        if (values.username === currentUsername)
        {
            setResult({ isError: true, message: "You can't add yourself as a friend" });
            return;
        }

        try
        {
            const { status, user } = await dispatch(sendFriendRequest(values.username)).unwrap();

            // they had already sent you a request, so sending one back accepted it
            setResult({
                isError: false,
                message: status === FriendStatus.friends ? `You and ${user.displayName} are now friends.` : `Friend request sent to ${user.displayName}.`
            });
            reset();
        }
        catch (error)
        {
            const apiError = error as ApiError;

            // NotFound() only carries the generic "Not Found" title
            setResult({ isError: true, message: apiError.status === 404 ? 'No user has that username' : apiError.message });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-xl flex-col gap-2">
            <Label htmlFor="add-friend-input" className="text-base font-semibold">Add Friend</Label>
            <p className="text-sm text-muted-foreground">You can add friends with their username.</p>

            <div className="flex gap-2">
                <Input
                    id="add-friend-input"
                    autoComplete="off"
                    placeholder="Enter a username"
                    aria-invalid={!!errors.username || result?.isError}
                    {...register('username', { onChange: () => setResult(null) })}
                />
                <Button type="submit" disabled={isSubmitting} className="shrink-0">
                    {isSubmitting ? 'Sending...' : 'Send Friend Request'}
                </Button>
            </div>

            {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            {
                result && (
                    <p role={result.isError ? 'alert' : 'status'} className={result.isError ? 'text-sm text-destructive' : 'text-sm text-emerald-700 dark:text-emerald-400'}>
                        {result.message}
                    </p>
                )
            }
        </form>
    );
};

export default AddFriendForm;
