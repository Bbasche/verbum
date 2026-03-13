import type {
  BridgeSnapshot,
  ConversationSummary,
  RunTerminalRequest,
  SendMessageRequest,
  SpawnConversationRequest
} from "./message-schema";

declare global {
  interface Window {
    verbumApp: {
      platform: string;
      version: string;
      getSnapshot(): Promise<BridgeSnapshot>;
      sendMessage(request: SendMessageRequest): Promise<void>;
      runTerminalCommand(request: RunTerminalRequest): Promise<void>;
      runLaunchDemo(): Promise<void>;
      spawnConversation(request: SpawnConversationRequest): Promise<ConversationSummary>;
      subscribe(listener: (snapshot: BridgeSnapshot) => void): () => void;
    };
  }
}

declare module "*.png" {
  const src: string;
  export default src;
}

export {};
