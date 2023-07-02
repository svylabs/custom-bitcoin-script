const Client = require('bitcoin-core')

const client = new Client({ 
  network: 'regtest', 
  username: 'admin', 
  password: 'admin', 
  port: 18443 
})

export class RPCClient {
  static listWalletDir() {
    return client.listWalletDir()
  }
  static listWallets() {
    return client.listWallets()
  }
  static loadWallet(name: string) {
    return client.loadWallet(name)
  }
  static getRawTransaction(txid: string) {
    return client.getRawTransaction(txid)
  }
  static getNewAddress() {
    return new Promise((resolve, reject) => {
      client.getNewAddress()
        .then((res: any) => resolve(res))
        .catch((err: any) => reject(err))
    })
  }
  static generateToAddress(blockCount: number, address: string) {
    return new Promise((resolve, reject) => {
      client.generateToAddress(blockCount, address)
        .then((res: any) => resolve(res))
        .catch((err: any) => reject(err))
    })
  }
  static getBalance() {
    return new Promise((resolve, reject) => {
      client.getBalance()
        .then((res: any) => resolve(res))
        .catch((err: any) => reject(err))
    })
  }
  static sendToAddress(address: string, amount: number) {
    return new Promise((resolve, reject) => {
      client.sendToAddress(address, amount)
        .then((res: any) => resolve(res))
        .catch((err: any) => reject(err))
    })
  }
  static getBlock(hash: string) {
    return client.getBlock(hash)
  }
  static getBlockHeader(hash: string) {
    return client.getBlockHeader(hash)
  }
  static getRawBlockHeader(hash: string) {
    return client.getBlockHeader(hash, false)
  }
  static getBestBlockHash() {
    return client.getBestBlockHash()
  }
  static getTransaction(hash: string) {
    return client.getTransaction(hash)
  }
  static createWallet(name: string) {
    return client.createWallet(name)
  }
  static sendRawTransaction(rawtx: string) {
    return client.sendRawTransaction(rawtx)
  }
}