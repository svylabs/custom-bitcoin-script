import * as dotenv from 'dotenv'
import { randomBytes } from 'crypto'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import ECPairFactory from 'ecpair'
import { RPCClient } from './client'
import { ElectrumService } from './electrum'
import { PsbtInput } from 'bip174/src/lib/interfaces';
import { witnessStackToScriptWitness } from 'bitcoinjs-lib/src/psbt/psbtutils'

dotenv.config()

const ECPair = ECPairFactory(ecc)

// @ts-ignore
Buffer.toString = () => this !== undefined ? this.toString('hex') : '<>'

const WALLET_NAME = 'nala'

// order id: 20afdf67, priv key: a0ec641c3e9fe4fe7e1fe14eb4a9c029d5ea2f07c586d1595a7f22a88f93b1fd
// order id: cc4ac5d2, priv key: b7a88b58f71f349792e7c83683c9fb41978ff8584a216b7faa400e41580e0de4
// order id: 57a359dd, priv key: d114994c865ac49c2b1669a7488283e45a32e15df8fefd9d46dec5dfe9bc221b
// order id: 6db1e2b0, priv key: 02c92d81dda39c02e91916ef68ba5cf5a796cb5dc0a64e448d92b6b79a6076ba
const FIXED_ADDRESS_DATA = [
  {
    orderId: Buffer.from('20afdf67','hex'),
    keyPair: ECPair.fromPrivateKey(Buffer.from('a0ec641c3e9fe4fe7e1fe14eb4a9c029d5ea2f07c586d1595a7f22a88f93b1fd','hex')),
    privateKey: Buffer.from('a0ec641c3e9fe4fe7e1fe14eb4a9c029d5ea2f07c586d1595a7f22a88f93b1fd','hex')
  },
  {
    orderId: Buffer.from('cc4ac5d2','hex'),
    keyPair: ECPair.fromPrivateKey(Buffer.from('b7a88b58f71f349792e7c83683c9fb41978ff8584a216b7faa400e41580e0de4','hex')),
    privateKey: Buffer.from('b7a88b58f71f349792e7c83683c9fb41978ff8584a216b7faa400e41580e0de4','hex')
  },
  {
    orderId: Buffer.from('57a359dd','hex'),
    keyPair: ECPair.fromPrivateKey(Buffer.from('d114994c865ac49c2b1669a7488283e45a32e15df8fefd9d46dec5dfe9bc221b','hex')),
    privateKey: Buffer.from('d114994c865ac49c2b1669a7488283e45a32e15df8fefd9d46dec5dfe9bc221b','hex')
  },
  {
    orderId: Buffer.from('6db1e2b0','hex'),
    keyPair: ECPair.fromPrivateKey(Buffer.from('02c92d81dda39c02e91916ef68ba5cf5a796cb5dc0a64e448d92b6b79a6076ba','hex')),
    privateKey: Buffer.from('02c92d81dda39c02e91916ef68ba5cf5a796cb5dc0a64e448d92b6b79a6076ba','hex')
  },
]

interface AddressData {
  orderId: Buffer
  privateKey: Buffer
}

interface Vout {
  txid: string,
  index: number,
  amount: number
}

const generateAddressData = (count: number) : AddressData[] => {
  const addressData: AddressData[] = []
  for (let i = 0; i < count; i++) {
    addressData.push({
      orderId: randomBytes(4),
      privateKey: randomBytes(32)
    })
    console.log(`order id: ${addressData[i].orderId.toString('hex')}, priv key: ${addressData[i].privateKey.toString('hex')}`)
  }
  return addressData
}

const sleep = (ms: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(0), ms)
  })
}

const main = async () => {
  // Instantiating electrum client
  const electrum = new ElectrumService()
  const sendAddr = process.argv[2];
  console.log(sendAddr);
  const value = parseInt(process.argv[3] || '1');
  // 2- Loading wallet and funding newly created addresses
  const walletDir = await RPCClient.listWalletDir()
  console.log('wallet dir: ', walletDir)
  const wallets = await RPCClient.listWallets() as any[]
  console.log('wallets: ', wallets)
  if (wallets.length === 0) {
    const wallet = await RPCClient.createWallet(WALLET_NAME)
    console.log('wallet: ', wallet)
  }
  const address = await RPCClient.getNewAddress() as string
  console.log('address: ', address)
  const bestBlockHash = await RPCClient.getBestBlockHash()
  const bestBlockHeader = await RPCClient.getBlockHeader(bestBlockHash)
  if (bestBlockHeader.height < 100) {
    await RPCClient.generateToAddress(100, address)
  }
  const balance = await RPCClient.getBalance()
  console.log('balance: ', balance);
  let blockIds = await RPCClient.generateToAddress(1, address) as string[]
  await sleep(1000);
  const txid = await RPCClient.sendToAddress(sendAddr, value) as string;
  console.log(txid);
  const rawTx = await RPCClient.getTransaction(txid);
  console.log(rawTx);
  blockIds = await RPCClient.generateToAddress(1, address) as string[]
  await sleep(1000)
  console.log('blocks id: ', blockIds)
  const blockHeader = await RPCClient.getBlockHeader(blockIds[0])
  console.log(blockHeader);
  const rawBlockHeader = await RPCClient.getRawBlockHeader(blockIds[0]);
  // 3- Fetching merke proofs
  const { height } = blockHeader;
  console.log("BlockHeight: " + height + ", Header: " + rawBlockHeader);
  const merkleProof = await electrum.getMerkle(txid, height)
  console.log('merkle proof: ', merkleProof)
}

main();