import { ElectrumClient } from '@gemlinkofficial/electrum-client-ts'

export type CallbackType = (args: any[]) => void

export interface TxHistoryElement {
  height: number,
  tx_hash: string,
  fee?: number
}

export type BlockHeaderNotification = [
  {
    hex: string,
    height: number
  }
]

export type Balance = {
  confirmed: number,
  unconfirmed: number
}

export type MerkeProof = {
  merkle: string[],
  block_height: number,
  pos: number
}

export class ElectrumService {
  constructor() {
    this.connect()
  }

  private readonly electrum = new ElectrumClient(
    process.env.ELECTRUM_HOST || "0.0.0.0",
    parseInt(process.env.ELECTRUM_PORT || "30000" as string),
    process.env.ELECTRUM_PROTOCOL || 'tcp'
  )

  private _isConnected = false

  public get isConnected() {
    return this._isConnected
  }

  public set isConnected(value: boolean) {
    this._isConnected = value
  }

  async connect() {
    console.log('connect. protocol: ', process.env.ELECTRUM_PROTOCOL)
    try {
      await this.electrum.connect('electrum-client-js', '1.4', {
        maxRetry: 10,
        callback: (e: any) => console.log('connect callback. e: ', e)
      })
      this.isConnected = true
      this.electrum.onEnd = (error: Error) => {
        console.log('The connection was closed on us, re-connecting')
        this.electrum.reconnect()
      }
    } catch(e) {
      console.error('> Error while trying to connect', e)
    }
  }

  onConnect(callback: () => void) {
    this.electrum.onConnect = callback
  }

  disconnect() {
    this.electrum.close()
  }

  async getBalance(reversedHash: Buffer) : Promise<Balance> {
    return this.electrum
      .blockchain_scripthash_getBalance(reversedHash.toString('hex')) as Promise<Balance>
  }

  async getVersion() {
    return await this.electrum.server_version('electrum-client-js', '1.4')
  }

  async subscribe(scriptHash: Buffer) : Promise<string|null> {
    this.electrum.blockchain_address_subscribe
    return await this.electrum
      .blockchain_scripthash_subscribe(scriptHash.toString('hex')) as Promise<string|null>
  }

  async getTxHistory(scriptHash: Buffer | string) : Promise<TxHistoryElement[]> {
    if (Buffer.isBuffer(scriptHash)) {
      scriptHash = scriptHash.toString('hex')
    }
    return await this
      .electrum
      .blockchain_scripthash_getHistory(scriptHash) as Promise<TxHistoryElement[]>
  }

  async getTransaction(txid: Buffer | string, verbose: boolean) : Promise<string> {
    if (Buffer.isBuffer(txid)) {
      txid = txid.toString('hex')
    }
    return await this.electrum.blockchain_transaction_get(txid, verbose) as Promise<string>
  }

  async getMerkle(txHash: string, height: number) : Promise<MerkeProof> {
    return await this.electrum.blockchain_transaction_getMerkle(txHash, height) as Promise<MerkeProof>
  }

  on(event: string, callback: CallbackType) {
    this.electrum.subscribe.on(event, callback)
  }

  async subscribeToHeaders() : Promise<BlockHeaderNotification> {
    return this.electrum.blockchain_headers_subscribe() as Promise<BlockHeaderNotification>
  }
}
