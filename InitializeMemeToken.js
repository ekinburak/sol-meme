const { createMint, getMint, getOrCreateAssociatedTokenAccount, getAccount, mintTo } = require('@solana/spl-token');
const { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const {
  createMetadataAccountV3,
  findMetadataPda,
} = require("@metaplex-foundation/mpl-token-metadata");
const { PublicKey, createSignerFromKeypair, signerIdentity} = require( "@metaplex-foundation/umi");
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { fromWeb3JsKeypair } = require('@metaplex-foundation/umi-web3js-adapters');
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
 * @returns {PublicKey} The mint public key.
 */
async function createNewToken(connection, payer, mintAuthority, freezeAuthority) {
    const mint = await createMint(
        connection,
        payer,
        mintAuthority.publicKey,
        freezeAuthority.publicKey,
        9 // Decimal default set to 9
    );
    console.log(`Mint Public Key: ${mint.toBase58()}`);
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
async function mintTokens(connection, payer, mint, recipient, mintAuthority, amount) {
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
function saveKeypairToFile(keypair, filename) {
  fs.writeFileSync(filename, JSON.stringify(Array.from(keypair.secretKey)));
}

/**
 * Loads a Keypair from a saved secret key file, or generates a new one.
 */
function loadKeypairFromFile(filename) {
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
async function findExistingTokenAccount(connection, mint, owner) {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  if (accounts.value.length > 0) {
      return accounts.value[0].pubkey;
  }
  return null;
}

async function createOrUpdateMetadata(umi, mintAddress, signer, metadata, initialize) {

  const metadataPda = findMetadataPda(umi, { mint: mintAddress });

  if (initialize) {
    const accounts = {
        mint: mintAddress, // Directly using mintAddress
        mintAuthority: signer,
    };
    const data = {
        isMutable: true,
        collectionDetails: null,
        data: {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
            creators: metadata.creators || null,
            collection: metadata.collection || null,
            uses: metadata.uses || null,
        }
    };
    const txid = await createMetadataAccountV3(umi, { ...accounts, ...data }).sendAndConfirm(umi);
    console.log(`Metadata creation transaction ID: ${txid}`);
} else {
    // Update metadata logic
    // ...
}
}

/**
 * Main function to run the token creation and minting process.
 */
async function main() {

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

  const umi = createUmi("https://api.devnet.solana.com");
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(signer, true));

  let tokenAccountInfo; // Declare the variable here

  // Create new mint
  const mintAuthority = Keypair.generate();
  const freezeAuthority = Keypair.generate();
  const mint = await createNewToken(connection, payer, mintAuthority, freezeAuthority);
  console.log(`Mint Token Address: ${mint.toBase58()}`);

  // Attempt to find an existing token account
  const existingTokenAccountAddress = await findExistingTokenAccount(connection, mint, payer.publicKey);

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

  // Define metadata for the token
  const metadata = {
    name: "Your Token Name",
    symbol: "YTN",
    uri: "https://example.com/metadata.json", // Replace with your metadata URI
    sellerFeeBasisPoints: 0,
    // Assuming these are optional, set to undefined or null if not used
    creators: undefined,
    collection: undefined,
    uses: undefined,
  };

  // Create or update metadata
  const INITIALIZE_METADATA = true; // Set to false to update existing metadata
  await createOrUpdateMetadata(umi, mint, signer, metadata, INITIALIZE_METADATA);



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
  console.log(`Updated Supply: ${mintInfo.supply}`);

}

main().catch(console.error);
