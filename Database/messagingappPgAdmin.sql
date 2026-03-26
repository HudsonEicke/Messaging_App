--HOW TO USE
--open the pgadmin query tool
--then run this command
CREATE DATABASE messaging_app;

--then in pgadmin refresh the databases tab
--then right click the messaging_app and select query tool
--then paste these commands and run
CREATE TYPE ACTIVITYSTATUS AS ENUM('online', 'away', 'dnd', 'offline');
CREATE TYPE FRIENDSTATUS AS ENUM('pending', 'friends', 'blocked');
CREATE TYPE CONVERSATIONTYPE AS ENUM('direct', 'group');

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

create table RefreshTokens
(
    id BIGSERIAL PRIMARY KEY,
    userID BIGINT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    token CHAR(200) NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    createdDate TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiresDate TIMESTAMPTZ NOT NULL
);

create table Friends
(
    sender BIGINT NOT NULL REFERENCES Users(id),
    receiver BIGINT NOT NULL REFERENCES Users(id),
    status FRIENDSTATUS NOT NULL DEFAULT 'pending',
    PRIMARY KEY(sender, receiver)
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

create table ServerInvites
(
    inviteCode UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serverID BIGINT NOT NULL REFERENCES Servers(id) ON DELETE CASCADE,
    createdBy BIGINT NOT NULL REFERENCES Users(id),
    createdDate TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiresDate TIMESTAMPTZ,
    maxUses INT,
    uses INT NOT NULL DEFAULT 0
);

create table Channels
(
    id BIGSERIAL PRIMARY KEY,
    serverID BIGINT NOT NULL REFERENCES Servers(id) ON DELETE CASCADE,
    channelName TEXT NOT NULL,
    channelOrder INT NOT NULL DEFAULT 0
);

create table Messages
(
    id BIGSERIAL PRIMARY KEY, --auto increments on new message
    channelID BIGINT NOT NULL REFERENCES Channels(id) ON DELETE CASCADE,
    messageText TEXT NOT NULL,
    sender BIGINT NOT NULL REFERENCES Users(id) ON DELETE CASCADE, --who the message is from
    timeSent TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited BOOLEAN NOT NULL DEFAULT false,
    replyToID BIGINT REFERENCES Messages(id)
);

--DIRECT MESSAGES DB START
create table Conversations
(
    id BIGSERIAL PRIMARY KEY,
    conversationName TEXT,
    ownerID BIGINT REFERENCES Users(id),
    iconUrl TEXT,
    conversationType CONVERSATIONTYPE NOT NULL DEFAULT 'direct'
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
    edited BOOLEAN NOT NULL DEFAULT false,
    replyToID BIGINT REFERENCES ConversationMessages(id)
);

--INDEXES
CREATE INDEX idx_messages_channel_time_desc ON Messages(channelID, timeSent DESC);
CREATE INDEX idx_conversation_messages_time_desc ON ConversationMessages(conversationID, timeSent DESC);
CREATE INDEX idx_servermembers_userid ON ServerMembers(userID);
CREATE INDEX idx_serverinvites_serverid ON ServerInvites(serverID);
CREATE INDEX idx_channels_serverid ON Channels(serverID);
CREATE INDEX idx_conversationmembers_userid ON ConversationMembers(userID);
CREATE INDEX idx_friends_receiver ON Friends(receiver);