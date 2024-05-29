export type ThpMessage =
    | {
          type: 'ThpCreateChannel';
          payload: {
              nonce: Buffer;
          };
      }
    | {
          type: 'ThpReadAck';
          payload: undefined;
      };
