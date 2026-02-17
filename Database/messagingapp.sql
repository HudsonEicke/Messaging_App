--HOW TO USE
--open the pgadmin query tool
--then run this command
CREATE DATABASE messaging_app;

--then in pgadmin refresh the databases tab
--then right click the messaging_app and select query tool
--then paste these commands and run
CREATE TYPE ACTIVITYSTATUS AS ENUM('online', 'away', 'dnd', 'offline');

create table Users
(
    id BIGSERIAL PRIMARY KEY, --auto increments on new user
    displayName VARCHAR(100) NOT NULL,
    userName VARCHAR(100) NOT NULL UNIQUE, --used for friend requests
    email TEXT NOT NULL UNIQUE, --may not be used
    passwordHash TEXT NOT NULL, --passwords are stored as hashs for security
    profileImageUrl TEXT NOT NULL, --link to pfp
    activityStatus ACTIVITYSTATUS NOT NULL DEFAULT 'offline',
    accountCreationTime TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

--SERVER DB START
create table Servers
(
    id BIGSERIAL PRIMARY KEY,
    serverName TEXT NOT NULL,
    ownerID BIGINT NOT NULL REFERENCES Users(id),
    iconUrl TEXT NOT NULL
);

create table ServerMembers --links members and servers together
(
    serverID BIGINT NOT NULL REFERENCES Servers(id) ON DELETE CASCADE, --cascade means if the id it references gets deleted this entry also gets deleted
    userID BIGINT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    PRIMARY KEY(serverID, userID)
);

create table Channels
(
    id BIGSERIAL PRIMARY KEY,
    serverID BIGINT NOT NULL REFERENCES Servers(id) ON DELETE CASCADE,
    channelName TEXT NOT NULL
);

create table Messages
(
    id BIGSERIAL PRIMARY KEY, --auto increments on new message
    channelID BIGINT NOT NULL REFERENCES Channels(id) ON DELETE CASCADE,
    messageText TEXT NOT NULL,
    sender BIGINT NOT NULL REFERENCES Users(id) ON DELETE CASCADE, --who the message is from
    timeSent TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited BOOLEAN NOT NULL DEFAULT false
);

--DIRECT MESSAGES DB START
create table Conversations
(
    id BIGSERIAL PRIMARY KEY,
    conversationName TEXT NOT NULL,
    iconUrl TEXT NOT NULL
);

create table ConversationMembers
(
    conversationID BIGINT NOT NULL REFERENCES Conversations(id) ON DELETE CASCADE,
    userID BIGINT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    PRIMARY KEY(conversationID, userID)
);

create table ConversationMessages
(
    id BIGSERIAL PRIMARY KEY, --auto increments on new message
    conversationID BIGINT NOT NULL REFERENCES Conversations(id) ON DELETE CASCADE,
    messageText TEXT NOT NULL,
    sender BIGINT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    timeSent TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited BOOLEAN NOT NULL DEFAULT false
);

--INDEXES
CREATE INDEX idx_messages_channel_time_desc ON Messages(channelID, timeSent DESC);

CREATE INDEX idx_conversation_messages_time_desc ON ConversationMessages(conversationID, timeSent DESC);