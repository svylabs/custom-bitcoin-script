import { randomBytes } from 'crypto'
import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import ECPairFactory from 'ecpair'
import { RegtestUtils } from 'regtest-client'

const ECPair = ECPairFactory(ecc);

// order id: 20afdf67, priv key: a0ec641c3e9fe4fe7e1fe14eb4a9c029d5ea2f07c586d1595a7f22a88f93b1fd
// order id: cc4ac5d2, priv key: b7a88b58f71f349792e7c83683c9fb41978ff8584a216b7faa400e41580e0de4
// order id: 57a359dd, priv key: d114994c865ac49c2b1669a7488283e45a32e15df8fefd9d46dec5dfe9bc221b
// order id: 6db1e2b0, priv key: 02c92d81dda39c02e91916ef68ba5cf5a796cb5dc0a64e448d92b6b79a6076ba
const FIXED_ADDRESS_DATA = [
  {
    orderId: Buffer.from('20afdf67','hex'),
    privateKey: Buffer.from('a0ec641c3e9fe4fe7e1fe14eb4a9c029d5ea2f07c586d1595a7f22a88f93b1fd','hex')
  },
  {
    orderId: Buffer.from('cc4ac5d2','hex'),
    privateKey: Buffer.from('b7a88b58f71f349792e7c83683c9fb41978ff8584a216b7faa400e41580e0de4','hex')
  },
  {
    orderId: Buffer.from('57a359dd','hex'),
    privateKey: Buffer.from('d114994c865ac49c2b1669a7488283e45a32e15df8fefd9d46dec5dfe9bc221b','hex')
  },
  {
    orderId: Buffer.from('6db1e2b0','hex'),
    privateKey: Buffer.from('02c92d81dda39c02e91916ef68ba5cf5a796cb5dc0a64e448d92b6b79a6076ba','hex')
  },
]

interface AddressData {
  orderId: Buffer
  privateKey: Buffer
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

const main = () => {
  // const addressData = generateAddressData(4)
  const addressData = FIXED_ADDRESS_DATA

  const addresses = []
  // Generating addresses
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
    const { address } = bitcoin.payments.p2wsh({
      redeem: { output: script },
      network: bitcoin.networks.regtest
    })
    addresses.push(address)
    console.log(`order id: ${orderId.toString('hex')}, public key: ${publicKey.toString('hex')} -> ${address}`)
  })
}

main()