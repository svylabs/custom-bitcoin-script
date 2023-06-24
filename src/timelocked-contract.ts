import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import ECPairFactory from 'ecpair'
import { PsbtInput } from 'bip174/src/lib/interfaces'
import { witnessStackToScriptWitness } from 'bitcoinjs-lib/src/psbt/psbtutils'
import { BitcoinCoreWallet } from './wallet'
import { sleep } from './sleep'
import { RPCClient } from './client'
import { Vout } from '.'

const ECPair = ECPairFactory(ecc)
// @ts-ignore
Buffer.toString = () => this !== undefined ? this.toString('hex') : '<>'

const SATS_LOCKED_AMOUNT = 100E3
const MINER_FEE = 1000
const LOCKTIME_VALUE = 1860
const ENABLE_LOCKTIME = false

const main = async () => {
  const bitcoinCoreWallet = new BitcoinCoreWallet()

  // My private key
  const myPair = ECPair.fromPrivateKey(Buffer.from('a0ec641c3e9fe4fe7e1fe14eb4a9c029d5ea2f07c586d1595a7f22a88f93b1fd','hex'))
  const pubkeyHash = bitcoin.crypto.hash160(myPair.publicKey)
  // Counterparty private key
  const counterpartyPair = ECPair.fromPrivateKey(Buffer.from('b7a88b58f71f349792e7c83683c9fb41978ff8584a216b7faa400e41580e0de4','hex'))
  const counterpartyPubkeyHash = bitcoin.crypto.hash160(counterpartyPair.publicKey)
  
  const orderId = Buffer.from('20afdf67','hex')
  let redeemScript = bitcoin.script.compile([
    orderId,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP,
    bitcoin.opcodes.OP_HASH160,
    counterpartyPubkeyHash, // counterparty pubKeyHash
    bitcoin.opcodes.OP_EQUAL,
    bitcoin.opcodes.OP_NOTIF,
    bitcoin.script.number.encode(LOCKTIME_VALUE), // populate the future timestamp or future block number here
    bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    bitcoin.opcodes.OP_DROP,
    bitcoin.opcodes.OP_DUP, // should duplicate public key
    bitcoin.opcodes.OP_HASH160,
    pubkeyHash, // my pub key hash
    bitcoin.opcodes.OP_EQUALVERIFY,
    bitcoin.opcodes.OP_ENDIF,
    bitcoin.opcodes.OP_CHECKSIG,
  ])
  const payment = bitcoin.payments.p2wsh({
    redeem: { output: redeemScript, network: bitcoin.networks.regtest }
  })
  const { address } = payment

  // Funding contract
  const txid: string = await bitcoinCoreWallet.fundAddress(address as string, 100E3 / 1E8)
  const rawFundingTx = await RPCClient.getRawTransaction(txid)
  console.log('> funding tx: ', rawFundingTx)
  await sleep(1000)

  // Generating new address
  const finalAddress = await bitcoinCoreWallet.getNewAddress()

  // Constructing transaction that will spend from the contract with my key
  const txDetails = await RPCClient.getTransaction(txid)
  const prevTx = bitcoin.Transaction.fromHex(txDetails.hex)
  const vouts: Vout[] = []
  prevTx.outs.forEach((out, index) => {
    if (out.value === SATS_LOCKED_AMOUNT) {
      vouts.push({
        txid: prevTx.getId(),
        index: index,
        amount: out.value
      })
    }
  })
  // Creating spending tx
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.regtest })
  for(let i = 0; i < vouts.length; i++) {
    psbt.addInput({
      witnessUtxo: {
        script: payment.output!,
        value: vouts[i].amount
      },
      witnessScript: redeemScript,
      hash: vouts[i].txid,
      index: vouts[i].index,
      sequence: 0xfffffffe
    })
  }
  if (ENABLE_LOCKTIME) {
    psbt.setLocktime(LOCKTIME_VALUE)
  }
  psbt.addOutput({
    address: finalAddress,
    value: vouts.reduce((accum, vout) => accum + vout.amount, 0) - MINER_FEE
  })
  for (let i = 0; i < psbt.inputCount; i++) {
    psbt.signInput(i, counterpartyPair)
  }
  const finalizeInput = (inputIndex: number, input: PsbtInput, script: Buffer, isSegwit: boolean, isP2SH: boolean, isP2WSH: boolean) => {
    const publicKey = counterpartyPair.publicKey
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
  console.log('> Spending tx: ', tx.toHex())
  const finalTxId = await RPCClient.sendRawTransaction(tx.toHex())
  console.log('final txid: ', finalTxId)
}

export const timelockedContract = () => {
  main()
}
