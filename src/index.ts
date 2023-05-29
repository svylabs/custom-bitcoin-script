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
  // const addressData = generateAddressData(4)
  const addressData = FIXED_ADDRESS_DATA

  const scripts: Buffer[] = []
  const addresses: string[] = []
  const payments: bitcoin.Payment[] = []
  // 1- Generating addresses
  addressData.forEach((addressData) => {
    const { orderId, privateKey } = addressData

    const ecPair = ECPair.fromPrivateKey(privateKey)
    const publicKey = ecPair.publicKey
    const pubkeyHash = bitcoin.crypto.hash160(publicKey)

    const script = bitcoin.script.compile([
      orderId,
      bitcoin.opcodes.OP_DROP,
      bitcoin.opcodes.OP_DUP,
      bitcoin.opcodes.OP_HASH160,
      pubkeyHash,
      bitcoin.opcodes.OP_EQUALVERIFY,
      bitcoin.opcodes.OP_CHECKSIG
    ])
    scripts.push(script)
    const payment = bitcoin.payments.p2wsh({
      // hash: bitcoin.crypto.sha256(script),
      redeem: { output: script, network: bitcoin.networks.regtest }
    })
    payments.push(payment)
    const { address } = payment
    addresses.push(address as string)
    console.log(`order id: ${orderId.toString('hex')}, public key: ${publicKey.toString('hex')} -> ${address}`)
  })
  // 2- Loading wallet and funding newly created addresses
  const walletDir = await RPCClient.listWalletDir()
  console.log('wallet dir: ', walletDir)
  const wallets = await RPCClient.listWallets() as any[]
  console.log('wallets: ', wallets)
  if (wallets.length === 0) {
    const wallet = await RPCClient.loadWallet(WALLET_NAME)
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
  console.log('balance: ', balance)

  const fundingTxIds: string[] = []
  for(let i = 0; i < addresses.length; i++) {
    const txid = await RPCClient.sendToAddress(addresses[i], 1)
    console.log(`Sent funds to ${addresses[i]}, txid: `, txid)
    fundingTxIds.push(txid as string)
  }
  const blockIds = await RPCClient.generateToAddress(1, address) as string[]
  await sleep(1000)
  console.log('blocks id: ', blockIds)
  const blockHeader = await RPCClient.getBlockHeader(blockIds[0])
  // 3- Fetching merke proofs
  for (let i = 0; i < fundingTxIds.length; i++) {
    const txHash = fundingTxIds[i]
    const { height } = blockHeader
    const merkleProof = await electrum.getMerkle(txHash, height)
    // console.log('merkle proof: ', merkleProof)
  }
  // 4- Generating a tx that will spend from outputs with custom scripts
  const destinationAddress = await RPCClient.getNewAddress() as string
  const vouts: Vout[] = []
  for (let i = 0; i < fundingTxIds.length; i++) {
    const txDetails = await RPCClient.getTransaction(fundingTxIds[i])
    const tx = bitcoin.Transaction.fromHex(txDetails.hex)
    tx.outs.forEach((out, index) => {
      if (out.value === 1E8) {
        vouts.push({
          txid: tx.getId(),
          index: index,
          amount: out.value
        })
      }
    })
  }
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
  for(let i = 0; i < vouts.length; i++) {
    psbt.addInput({
      witnessUtxo: {
        script: payments[i].output!,
        value: vouts[i].amount
      },
      witnessScript: scripts[i],
      hash: vouts[i].txid,
      index: vouts[i].index
    })
  }
  psbt.addOutput({
    address: destinationAddress,
    value: vouts.reduce((accum, vout) => accum + vout.amount,0) - 1E3
  })
  for (let i = 0; i < psbt.inputCount; i++) {
    const keyPair = FIXED_ADDRESS_DATA[i].keyPair
    console.log(`Signing input ${i}`)
    psbt.signInput(i, keyPair)
  }
  const finalizeInput = (inputIndex: number, input: PsbtInput, script: Buffer, isSegwit: boolean, isP2SH: boolean, isP2WSH: boolean) => {
    const publicKey = FIXED_ADDRESS_DATA[inputIndex].keyPair.publicKey
    const redeemPayment = bitcoin.payments.p2wsh({
      redeem: {
        input: bitcoin.script.compile([
          // @ts-ignore
          input.partialSig[0].signature,
          publicKey
        ]),
        output: input.witnessScript
      }
    })
    const finalScriptWitness = witnessStackToScriptWitness(
      redeemPayment.witness ?? []
    )
    return {
      finalScriptSig: Buffer.from(''),
      finalScriptWitness
    }
  }
  for (let i = 0; i < vouts.length; i++) {
    psbt.finalizeInput(i, finalizeInput)
  }
  const tx = psbt.extractTransaction()
  const txid = await RPCClient.sendRawTransaction(tx.toHex())
  console.log('final txid: ', txid)
}

main()