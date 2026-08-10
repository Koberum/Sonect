declare module "mpd" {
  interface MPDClient {
    on(event: string, callback: (...args: any[]) => void): this;
    off(event: string, callback: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    sendCommand(command: any, callback: (err: any, msg: any) => void): void;
    socket: import("net").Socket;
  }

  interface MPDConnectOptions {
    host?: string;
    port?: number;
  }

  function connect(options?: MPDConnectOptions): MPDClient;

  const cmd: any;

  export default { connect, cmd };
  export { connect, cmd };
}
