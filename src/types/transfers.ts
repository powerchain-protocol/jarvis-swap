export type TransferKind = "send" | "receive";
export type TransferToken = { symbol: string; name?: string; coinType: string; decimals: number; balance?: number };
export type SendIntent = { sender: string; recipient: string; token: TransferToken; amount: string };
export type SendResult = { digest: string; gasUsedMist?: string };
