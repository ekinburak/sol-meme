// createToken.ts

import { clusterApiUrl,Connection,Keypair,PublicKey,LAMPORTS_PER_SOL} from '@solana/web3.js';  
import { createSignerFromKeypair, none, signerIdentity, some } from "@metaplex-foundation/umi";

const {
    createMint,
    getMint,
    findProgramAddress,
    getOrCreateAssociatedTokenAccount,
    getAccount,
    mintTo,
  } = require('@solana/spl-token');
  
  
  const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
  const { fromWeb3JsKeypair, fromWeb3JsPublicKey } = require('@metaplex-foundation/umi-web3js-adapters');
  const fs = require('fs');
  
  /**
   * Initializes the Solana connection.
   * @returns {Connection} The Solana connection object.
   */
  function initializeConnection() {
    return new Connection(clusterApiUrl('devnet'), 'confirmed');
  }
  
  /**
   * Creates a new fungible token.
   * @param {Connection} connection - The Solana connection.
   * @param {Keypair} payer - The payer's keypair.
   * @param {Keypair} mintAuthority - The mint authority's keypair.
   * @param {Keypair} freezeAuthority - The freeze authority's keypair.
   * @returns {Promise<PublicKey>} The mint public key.
   */
  async function createNewToken(connection: Connection, payer: Keypair, mintAuthority: Keypair, freezeAuthority: Keypair): Promise<PublicKey> {    
    const mint = await createMint(
      connection,
      payer,
      mintAuthority.publicKey,
      freezeAuthority.publicKey,
      9
    );
    console.log(`Mint account created with address / public key: ${mint.toBase58()}`);
    return mint;
  }
  
  /**
   * Mints tokens to a specified account.
   * @param {Connection} connection - The Solana connection.
   * @param {Keypair} payer - The payer's keypair.
   * @param {PublicKey} mint - The mint public key.
   * @param {PublicKey} recipient - The recipient's public key.
   * @param {Keypair} mintAuthority - The mint authority's keypair.
   * @param {number} amount - The amount to mint.
   */
  async function mintTokens(
    connection: Connection, 
    payer: Keypair, 
    mint: PublicKey, 
    recipient: PublicKey, 
    mintAuthority: Keypair, 
    amount: number
    ) {    
        await mintTo(
        connection,
        payer,
        mint,
        recipient,
        mintAuthority,
        amount
    );
  }
  
  /**
   * Saves a Keypair's secret key to a file.
   */
  function saveKeypairToFile(keypair: Keypair, filename: string) {
    fs.writeFileSync(filename, JSON.stringify(Array.from(keypair.secretKey)));
  }
  
  /**
   * Loads a Keypair from a saved secret key file, or generates a new one.
   */
  function loadKeypairFromFile(filename: string): Keypair {
    if (fs.existsSync(filename)) {
      const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(filename, 'utf-8')));
      return Keypair.fromSecretKey(secretKey);
    } else {
      const newKeypair = Keypair.generate();
      saveKeypairToFile(newKeypair, filename);
      return newKeypair;
    }
  }
  
  /**
   * Checks if a token account for a specific mint and owner exists.
   * @param {Connection} connection - The Solana connection.
   * @param {PublicKey} mint - The mint public key.
   * @param {PublicKey} owner - The owner's public key.
   * @returns {Promise<PublicKey | null>} The token account public key or null if not found.
   */
  async function findExistingTokenAccount(
    connection: Connection, 
    mint: PublicKey, 
    owner: PublicKey
  ): Promise<PublicKey | null> {    const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    if (accounts.value.length > 0) {
      return accounts.value[0].pubkey;
    }
    return null;
  }
  
  /**
   * Main function to run the token creation and minting process.
   */
async function createAndMintToken() {
    const connection = initializeConnection();
  
    // Load or generate the payer's keypair
    const payer = loadKeypairFromFile('payer-keypair.json');
    console.log(`Payer Public Key: ${payer.publicKey.toBase58()}`);
    console.log(`Solana Explorer Link for Payer: https://explorer.solana.com/address/${payer.publicKey.toBase58()}?cluster=devnet`);
  
    // Check balance before requesting an airdrop
    let payerBalance = await connection.getBalance(payer.publicKey);
    console.log(`Payer's balance: ${payerBalance / LAMPORTS_PER_SOL} SOL`);
  
    if (payerBalance < 1 * LAMPORTS_PER_SOL) {
      // Request an airdrop if balance is low
      const airdropSignature = await connection.requestAirdrop(
        payer.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      // Confirm the transaction
      await connection.confirmTransaction(airdropSignature);
      // Check and log payer's balance after the airdrop
      payerBalance = await connection.getBalance(payer.publicKey);
      console.log(`Payer's balance after airdrop: ${payerBalance / LAMPORTS_PER_SOL} SOL`);
    }
  
    // Use the RPC endpoint of your choice.
    const RPC_ENDPOINT = "https://devnet.helius-rpc.com/?api-key=a5e91db0-3801-4ca5-b5af-5878c1d2a41d";
    const umi = createUmi(RPC_ENDPOINT);
  
    const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
    umi.use(signerIdentity(signer, true));
  
    // Create new mint
    const mintAuthority = Keypair.generate();
    const freezeAuthority = Keypair.generate();
    const mint = await createNewToken(connection, payer, mintAuthority, freezeAuthority);
  
    // Attempt to find an existing token account
    const existingTokenAccountAddress = await findExistingTokenAccount(connection, mint, payer.publicKey);
  
    let tokenAccountInfo;
  
    if (existingTokenAccountAddress) {
      console.log(`Existing Token Account Found: ${existingTokenAccountAddress.toBase58()}`);
      tokenAccountInfo = await getAccount(connection, existingTokenAccountAddress);
    } else {
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        payer.publicKey
      );
      console.log(`New Token Account Created: ${tokenAccount.address.toBase58()}`);
      tokenAccountInfo = await getAccount(connection, tokenAccount.address);
      console.log(`Token Account Amount: ${tokenAccountInfo.amount}`);
    }
  
    // Get mint information
    let mintInfo = await getMint(connection, mint);
    console.log(`Initial Supply: ${mintInfo.supply}`);
  
    // Create or get associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      payer.publicKey
    );
    console.log(`Token Account Address: ${tokenAccount.address.toBase58()}`);
  
    // Mint 100 tokens
    await mintTokens(connection, payer, mint, tokenAccount.address, mintAuthority, 100000000000);
  
    // Display updated supply and token account amount
    mintInfo = await getMint(connection, mint);
    console.log(`Mint Token Updated Supply: ${mintInfo.supply}`);
  
    // Return the mint address as a string
    return mint.toBase58();
  }

// Call the function if the file is run directly
if (require.main === module) {
    createAndMintToken()
        .then((mintAddress) => console.log(`Mint Address: ${mintAddress}`))
        .catch((error) => console.error(`Error: ${error.message}`));
}

export { createAndMintToken };