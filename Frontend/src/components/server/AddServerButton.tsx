import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import CreateServerForm from './CreateServerForm';
import JoinServerForm from './JoinServerForm';

// bottom of the server rail; styled like HomeButton but it opens a dialog instead of navigating
const AddServerButton = () =>
{
    const [isOpen, setIsOpen] = useState(false);
    const close = () => setIsOpen(false);

    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        aria-label="Add a server"
                        onClick={() => setIsOpen(true)}
                        className="flex size-10 items-center justify-center rounded-[20px] bg-muted text-muted-foreground outline-none transition-all hover:rounded-xl hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <Plus className="size-5" aria-hidden="true" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">Add a server</TooltipContent>
            </Tooltip>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add a server</DialogTitle>
                        <DialogDescription>Create your own, or join one with an invite code.</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="create">
                        <TabsList className="w-full">
                            <TabsTrigger value="create">Create</TabsTrigger>
                            <TabsTrigger value="join">Join</TabsTrigger>
                        </TabsList>
                        <TabsContent value="create">
                            <CreateServerForm onDone={close} />
                        </TabsContent>
                        <TabsContent value="join">
                            <JoinServerForm onDone={close} />
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default AddServerButton;
