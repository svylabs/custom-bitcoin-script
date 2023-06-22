// given contract id, block height, add merkle root
import * as ethers from 'ethers';

import { RPCClient } from './client'

const abi = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "height",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "merkleRoot",
          "type": "bytes32"
        }
      ],
      "name": "AddHeader",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "txId",
          "type": "bytes32"
        },
        {
          "internalType": "uint32",
          "name": "blockHeight",
          "type": "uint32"
        },
        {
          "internalType": "uint256",
          "name": "index",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "hashes",
          "type": "bytes"
        }
      ],
      "name": "verifyTxInclusionProof",
      "outputs": [
        {
          "internalType": "bool",
          "name": "result",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    }
];

const main = async () => {
    const blockHeader = await RPCClient.getBlockHeader(process.argv[5]);
    console.log(blockHeader.merkleroot);
    console.log(await RPCClient.getRawBlockHeader(process.argv[5]));
    const merkleroot = Buffer.from(blockHeader.merkleroot, 'hex').reverse().toString('hex');
    const provider = new ethers.JsonRpcProvider(`https://polygon-mumbai.g.alchemy.com/v2/${process.argv[2]}`);
    const privateKey = process.argv[3];
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(process.argv[4], abi, wallet);
    const functionName = 'AddHeader';
    const result = await contract[functionName](blockHeader.height, '0x' + merkleroot);
    console.log(result);
}

main();


