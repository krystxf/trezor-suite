# @trezor/protobuf

Library for decoding and encoding messages from/to Trezor

## protocol-bridge

Full message format:

```
| protobufMessageType | protobufMessage |
```

no continuation packet

## protocol-v1

Full message format:

```
| magic | magic | magic | len | protobufMessageType | protobufMessage |
```

Continuation packet format (chunks):

```
| magic | protobufMessage |
```

## protocol-v2 (TrezorHostProtocol)

TODO: link to specification
https://www.notion.so/satoshilabs/THP-Specification-d17010749c254977889660ec158e675c

Full message format:

```
| 1 byte | 2 bytes           | 2 bytes   |                                       | 4 bytes |
| magic  | channel | channel | len | len | protobufMessageType | protobufMessage | crc     |
```

Continuation packet format (chunks):

| 0x80 | channel | protobufMessage

## protocol-thp

decode/encode payload of `protocol-v2` message

## protocol-trzd

decode dynamically loaded `@trezor/protobuf` messages
