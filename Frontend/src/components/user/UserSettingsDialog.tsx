import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { User } from 'lucide-react';
import type { UserDetailedResponse } from '@/types';
import type { AppDispatch } from '@/store/store';
import { changePassword, updateProfile } from '@/store/userSlice';
import type { ApiError } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PROFILE_IMAGE_URL_MAX_LENGTH, isValidAvatarUrl, passwordSchema, profileSchema } from './UserSettingsDialog.schema';
import type { PasswordFormValues, ProfileFormValues } from './UserSettingsDialog.schema';

interface UserSettingsDialogProps
{
    user: UserDetailedResponse;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// puts each backend validation error under its field; returns false if none matched, so the caller shows a general error
const showFieldErrors = <Field extends string>(error: unknown, fields: readonly Field[], setFieldError: (field: Field, message: string) => void): boolean =>
{
    const fieldErrors = (error as ApiError).fieldErrors;
    let didShow = false;

    for (const field of fields)
    {
        const message = fieldErrors?.[field]?.[0];

        if (message)
        {
            setFieldError(field, message);
            didShow = true;
        }
    }

    return didShow;
};

const UserSettingsDialog = ({ user, open, onOpenChange }: UserSettingsDialogProps) =>
{
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>User settings</DialogTitle>
                    <DialogDescription>Change how others see you, or your password.</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="profile">
                    <TabsList className="w-full">
                        <TabsTrigger value="profile">Profile</TabsTrigger>
                        <TabsTrigger value="password">Password</TabsTrigger>
                    </TabsList>
                    <TabsContent value="profile">
                        <ProfileForm user={user} />
                    </TabsContent>
                    <TabsContent value="password">
                        <PasswordForm />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};

const ProfileForm = ({ user }: { user: UserDetailedResponse }) =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [serverError, setServerError] = useState<string | null>(null);
    const [savedMessage, setSavedMessage] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        control,
        formState: { errors, isSubmitting, isDirty, dirtyFields }
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: { displayName: user.displayName, profileImageUrl: user.profileImageUrl }
    });

    const previewUrl = useWatch({ control, name: 'profileImageUrl' }).trim();

    const submit = async (values: ProfileFormValues) =>
    {
        setServerError(null);
        setSavedMessage(null);

        try
        {
            // PATCH leaves out fields you didn't touch
            const updated = await dispatch(updateProfile({
                displayName: dirtyFields.displayName ? values.displayName : undefined,
                profileImageUrl: dirtyFields.profileImageUrl ? values.profileImageUrl : undefined
            })).unwrap();

            // a blank display name comes back as your username
            reset({ displayName: updated.displayName, profileImageUrl: updated.profileImageUrl });
            setSavedMessage('Profile saved.');
        }
        catch (error)
        {
            if (!showFieldErrors(error, ['displayName', 'profileImageUrl'] as const, (field, message) => setError(field, { message })))
            {
                setServerError(getErrorMessage(error, 'Could not save your profile'));
            }
        }
    };

    return (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4 pt-2">
            <div className="flex items-center gap-3">
                <Avatar className="size-16">
                    <AvatarImage src={isValidAvatarUrl(previewUrl) ? previewUrl : undefined} alt="" />
                    <AvatarFallback><User className="size-7" aria-hidden="true" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{user.username}</p>
                    <p className="truncate text-muted-foreground">{user.email}</p>
                </div>
            </div>

            <div className="grid gap-2">
                <Label htmlFor="settings-display-name">Display name</Label>
                <Input
                    id="settings-display-name"
                    autoComplete="off"
                    placeholder={user.username}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    aria-invalid={!!errors.displayName}
                    aria-describedby="settings-display-name-hint"
                    {...register('displayName')}
                />
                <p id="settings-display-name-hint" className="text-xs text-muted-foreground">Leave blank to use your username.</p>
                {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="settings-avatar-url">Avatar URL</Label>
                <Input
                    id="settings-avatar-url"
                    type="url"
                    autoComplete="off"
                    placeholder="https://..."
                    maxLength={PROFILE_IMAGE_URL_MAX_LENGTH}
                    aria-invalid={!!errors.profileImageUrl}
                    aria-describedby="settings-avatar-url-hint"
                    {...register('profileImageUrl')}
                />
                <p id="settings-avatar-url-hint" className="text-xs text-muted-foreground">Leave blank to remove your avatar.</p>
                {errors.profileImageUrl && <p className="text-sm text-destructive">{errors.profileImageUrl.message}</p>}
            </div>

            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            {savedMessage && !isDirty && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{savedMessage}</p>}

            <Button type="submit" size="sm" className="self-end" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
        </form>
    );
};

const PasswordForm = () =>
{
    const dispatch = useDispatch<AppDispatch>();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isChanged, setIsChanged] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting }
    } = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
    });

    const submit = async (values: PasswordFormValues) =>
    {
        setServerError(null);
        setIsChanged(false);

        try
        {
            await dispatch(changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })).unwrap();
            reset();
            setIsChanged(true);
        }
        catch (error)
        {
            if (!showFieldErrors(error, ['currentPassword', 'newPassword'] as const, (field, message) => setError(field, { message })))
            {
                setServerError(getErrorMessage(error, 'Could not change your password'));
            }
        }
    };

    return (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4 pt-2">
            <div className="grid gap-2">
                <Label htmlFor="settings-current-password">Current password</Label>
                <Input
                    id="settings-current-password"
                    type="password"
                    autoComplete="current-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    aria-invalid={!!errors.currentPassword}
                    {...register('currentPassword')}
                />
                {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="settings-new-password">New password</Label>
                <Input
                    id="settings-new-password"
                    type="password"
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    aria-invalid={!!errors.newPassword}
                    {...register('newPassword')}
                />
                {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
            </div>

            <div className="grid gap-2">
                <Label htmlFor="settings-confirm-password">Confirm new password</Label>
                <Input
                    id="settings-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    maxLength={PASSWORD_MAX_LENGTH}
                    aria-invalid={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            {
                isChanged && (
                    <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                        Password changed. Your other sessions have been signed out.
                    </p>
                )
            }

            <Button type="submit" size="sm" className="self-end" disabled={isSubmitting}>
                {isSubmitting ? 'Changing...' : 'Change password'}
            </Button>
        </form>
    );
};

export default UserSettingsDialog;
