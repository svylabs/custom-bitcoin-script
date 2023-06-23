import { RPCClient } from './client'

const WALLET_NAME = 'nala'

export class BitcoinCoreWallet {
  wallet: Promise<any> = Promise.resolve()
  constructor() {
    this.init()
  }

  async init() {
    const loadedWallets = await RPCClient.listWallets() as any[]
    if (loadedWallets.length === 0) {
      const existingWallets = await RPCClient.listWalletDir() as any[]
      if (existingWallets.length === 0) {
        this.wallet = await RPCClient.createWallet(WALLET_NAME)
      } else {
        this.wallet = await RPCClient.loadWallet(WALLET_NAME)
      }
    } else {
      this.wallet = loadedWallets[0]
    }
  }

  async fundAddress(address: string, amount: number) : Promise<string> {
    return RPCClient.sendToAddress(address, amount) as Promise<string>
  }

  async getNewAddress() : Promise<string> {
    return RPCClient.getNewAddress() as Promise<string>
  }
}