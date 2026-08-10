# Domain schemas

Small dependency-free parsers validate Sui addresses, coin types, token metadata, swap persistence payloads and Cetus pool records before they cross into the database layer. Blockchain base-unit amounts stay as decimal strings/big integers; never coerce them through JavaScript floating point.
