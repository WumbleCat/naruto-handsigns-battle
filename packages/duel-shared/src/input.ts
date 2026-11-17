// The fixed-step movement input, sent through Colyseus's native input channel (server
// `defineInput`, client `room.input`). Only direction travels; speed, bounds and collisions are
// the server's. The library stamps sequence numbers, so no seq field is needed here.
import { schema, t, type SchemaType } from '@colyseus/schema';

export const MoveInput = schema(
  {
    moveX: t.float32().default(0),
    moveY: t.float32().default(0),
  },
  'MoveInput',
);
export type MoveInput = SchemaType<typeof MoveInput>;
