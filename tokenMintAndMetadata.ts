// tokenMintAndMetadata.ts

import { createAndMintToken } from './createToken';
import { createMetadata, updateMetadata } from './mpl_metadata';
const fs = require('fs');
const { Keypair } = require('@solana/web3.js');

const INITIALIZE_METADATA = true;

function getPayerKeypair() {
    const filename = 'payer-keypair.json';
    if (fs.existsSync(filename)) {
        const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(filename, 'utf-8')));
        return Keypair.fromSecretKey(secretKey);
    } else {
        const newKeypair = Keypair.generate();
        fs.writeFileSync(filename, JSON.stringify(Array.from(newKeypair.secretKey)));
        return newKeypair;
    }
}

async function runTokenMintAndMetadata() {
    
    const payerKeypair = getPayerKeypair(); // Assuming you export this function from createToken.ts

    // Create a new token
    const mintAddress = await createAndMintToken(); // This should return the mint address

    if (INITIALIZE_METADATA) {
        // Create metadata for the new token
        await createMetadata(mintAddress, payerKeypair);
    } else {
        // Update metadata logic
        const updatedMetadata = {
        name: "New Token Name",
        symbol: "NEWTK",
        uri: "https://example.com/new-metadata.json",
        sellerFeeBasisPoints: 500, // Example fee
        };
        await updateMetadata(mintAddress, payerKeypair, updatedMetadata);
    }
}

runTokenMintAndMetadata().catch(console.error);
