import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import type { IRetryPolicy } from '@microsoft/signalr';
import { store } from '@/store/store';
import { hubConnected, hubConnecting, hubDisconnected, hubReconnected, hubReconnecting } from '@/store/hubSlice';
import { getFreshAccessToken } from '@/services/api';
import { registerChannelEvents } from './handlers/channelEvents';
import { registerServerEvents } from './handlers/serverEvents';

const RETRY_DELAYS_MS = [0, 2_000, 5_000, 10_000];
const MAX_RETRY_DELAY_MS = 30_000;

const getRetryDelay = (attempt: number) => RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS;

// the default policy gives up after four tries, this one keeps going while you're logged in
const retryPolicy: IRetryPolicy = {
    nextRetryDelayInMilliseconds: (context) => getRetryDelay(context.previousRetryCount)
};

const connection = new HubConnectionBuilder()
    .withUrl(`${import.meta.env.VITE_API_URL}/hubs/chat`, { accessTokenFactory: getFreshAccessToken })
    .withAutomaticReconnect(retryPolicy)
    .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
    .build();

// registered before the first start so no early event is missed
registerChannelEvents(connection);
registerServerEvents(connection);

// what the app currently wants; queued tasks check it when they run, so a stop followed by a start cancels out
let isWanted = false;
let lifecycle: Promise<void> = Promise.resolve();
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// start and stop never overlap, since SignalR throws when starting a connection that's still stopping
const enqueue = (task: () => Promise<void>) => {
    lifecycle = lifecycle.then(task).catch(() => undefined);
};

const clearRetryTimer = () => {
    if (retryTimer !== null)
    {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
};

// automatic reconnect only covers a connection that was up, so failed starts are retried here
const connect = async (attempt: number) => {
    if (!isWanted || connection.state !== HubConnectionState.Disconnected)
    {
        return;
    }

    try
    {
        await connection.start();

        // a start that only worked after a failure may have missed events, so it resyncs like a reconnect
        store.dispatch(attempt === 0 ? hubConnected() : hubReconnected());
    }
    catch
    {
        if (isWanted)
        {
            store.dispatch(hubReconnecting());
            scheduleConnect(attempt + 1);
        }
    }
};

const scheduleConnect = (attempt: number) => {
    clearRetryTimer();

    retryTimer = setTimeout(() => {
        retryTimer = null;
        enqueue(() => connect(attempt));
    }, getRetryDelay(attempt));
};

connection.onreconnecting(() => store.dispatch(hubReconnecting()));
connection.onreconnected(() => store.dispatch(hubReconnected()));

connection.onclose(() => {
    // the retry policy never gives up, so this only happens on stop or when the server refuses a reconnect
    if (isWanted)
    {
        store.dispatch(hubReconnecting());
        scheduleConnect(1);
    }
});

export const startHub = () => {
    isWanted = true;

    if (connection.state === HubConnectionState.Disconnected)
    {
        store.dispatch(hubConnecting());
    }

    enqueue(() => connect(0));
};

export const stopHub = () => {
    isWanted = false;
    clearRetryTimer();

    enqueue(async () => {
        if (isWanted)
        {
            return;
        }

        await connection.stop();
        store.dispatch(hubDisconnected());
    });
};
