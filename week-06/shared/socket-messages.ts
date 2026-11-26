// Messages the API pushes to its clients over the WebSocket at /ws.
//
// A discriminated union: every message has a `type`, and TypeScript narrows
// the rest of the object from it (switch (message.type) { case "viewers": … }).
// To add a message, add a variant here: the server and the client both see it.
//
// Like types.ts this file holds only types, so import it with `import type`.

// How many browser tabs are connected right now. Sent to everyone whenever a
// tab connects or disconnects.
export type ViewersMessage = { type: "viewers"; count: number };

export type ServerMessage = ViewersMessage;
