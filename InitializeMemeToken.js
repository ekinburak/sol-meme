const {
  createMint,
  getMint,
  findProgramAddress,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
} = require('@solana/spl-token');
const {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');
const {
  Collection, 
  CreateMetadataAccountV3InstructionAccounts, 
  CreateMetadataAccountV3InstructionDataArgs, 
  Creator, 
  MPL_TOKEN_METADATA_PROGRAM_ID, 
  UpdateMetadataAccountV2InstructionAccounts, 
  UpdateMetadataAccountV2InstructionData, 
  Uses, 
  createMetadataAccountV3, 
  updateMetadataAccountV2, 
  findMetadataPda
} = require("@metaplex-foundation/mpl-token-metadata");


const {
  PublicKey,
  createSignerFromKeypair,
  signerIdentity,
  none,
  some,
} = require("@metaplex-foundation/umi");
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
async function createNewToken(connection, payer, mintAuthority, freezeAuthority) {
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

async function OLD_createOrUpdateMetadata(umi, mintAddress, signer) {
  
  const INITIALIZE_METADATA = true; // Set to false to update existing metadata

   const ourMetadata = {
    name: "XMAS Token Name",
    symbol: "XMASTN",
    uri: "https://raw.githubusercontent.com/ekinburak/sol-meme/master/metadata.json",
  };
  const onChainData = {
    ...ourMetadata,
    sellerFeeBasisPoints: 0,
    creators: null,
    collection: null,
    uses: null,
  }

  try {

    console.log("Metadata Initialization Process Started...");
    //console.log("Signer Address:", signer);

    if (INITIALIZE_METADATA) {
      const accounts = {
        mint: fromWeb3JsPublicKey(mintAddress),
        mintAuthority: signer,
      };
      const data = {
        is_mutable: true,
        collectionDetails: null,
        data: onChainData
      };
      console.log("Initialization Process - Step 1: Creating metadata account...");
      const txid = await createMetadataAccountV3(umi, {...accounts, ...data}).sendAndConfirm(umi);
      console.log("Initialization Process - Step 1: Metadata account creation successful. Transaction ID:", txid);
      const signature = txid;
      console.log("Initialization Process - Step 2: Signature", signature);
    } else {
      const accounts = {
        metadata: findMetadataPda(umi,{mint: fromWeb3JsPublicKey(mintAddress)}),
        authority: signer,
      };
      const data = {
        update_authority: signer,
        data: some(metadata.data),
      };
      console.log("Updating metadata account...");
      const txid = await updateMetadata(umi, { ...accounts, data }).sendAndConfirm(umi);
      console.log("Metadata account update successful. Transaction ID:", txid);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

async function createOrUpdateMetadata(umi, mintAddress, signer) {
  const INITIALIZE_METADATA = true; // Set to false to update existing metadata

  const ourMetadata = {
      name: "XMAS Token Name",
      symbol: "XMASTN",
      uri: "https://raw.githubusercontent.com/ekinburak/sol-meme/master/metadata.json",
  };

  try {
      console.log("Metadata Initialization Process Started...");

      if (INITIALIZE_METADATA) {
          console.log("Initialization Process - Step 1: Preparing metadata account creation...");

          // Arguments for metadata account creation
          const args = {
              data: {
                  ...ourMetadata,
                  sellerFeeBasisPoints: 0,
                  collection: null,
                  creators: [
                      { address: fromWeb3JsPublicKey(signer), verified: true, share: 100 }
                  ],
                  uses: null
              },
              isMutable: true,
              collectionDetails: null
          };

          // Accounts for metadata account creation
          const accounts = {
              metadata: fromWeb3JsPublicKey(metadata),
              mint: fromWeb3JsPublicKey(mintAddress), 
              payer: signer,
              mintAuthority: signer,
              updateAuthority: fromWeb3JsPublicKey(signer)
          };

          const fullArgs = {...accounts, ...args};

          const metadataBuilder = createMetadataAccountV3(umi, fullArgs);

          const ix = metadataBuilder.getInstructions()[0];
          ix.keys = ix.keys.map(key => {
              const newKey = {...key};
              newKey.pubkey = toWeb3JsPublicKey(key.pubkey);
              return newKey;
          });

          const tx = new Transaction().add(ix);
          console.log("Initialization Process - Step 2: Sending transaction for metadata account creation...");
          const sig = await sendAndConfirmTransaction(connection, tx, [signer]);
          console.log("Initialization Process - Step 3: Metadata account creation successful. Signature:", sig);
      } else {
          console.log("Update Process Started...");
          // Update logic here (similar approach, but with update instructions)
          console.log("Update Process Completed. Transaction ID:", /* transaction ID here */);
      }
  } catch (error) {
      console.error("Error in createOrUpdateMetadata:", error);
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
  console.log(`Mint: ${mint}`);
  console.log(`Mint Public Key: ${mint.publicKey}`);

  // Ensure mint is in the correct format (e.g., PublicKey or base58 string)
  //const mintAddress = mint.publicKey.toBase58(); // or just `mint` if it's already in the correct format

  // Create or update metadata
  //await createOrUpdateMetadata(umi, mintAddress, signer);

  await createOrUpdateMetadata(umi, mint, signer);

}

main().catch(console.error);
