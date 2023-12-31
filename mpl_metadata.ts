import {
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
  } from "@metaplex-foundation/mpl-token-metadata";
  import * as web3 from "@solana/web3.js";
  import { PublicKey, createSignerFromKeypair, none, signerIdentity, some } from "@metaplex-foundation/umi";
  import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
  import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
  
  // Removed loadWalletKey function as it's no longer needed
  
  const INITIALIZE = true;
  
  async function createMetadata(mintAddress: string, keypair: web3.Keypair) {
    console.log("Creating metadata for the token");
  
    const mint = new web3.PublicKey(mintAddress);
    const RPC_ENDPOINT = "https://devnet.helius-rpc.com/?api-key=a5e91db0-3801-4ca5-b5af-5878c1d2a41d";
    const umi = createUmi(RPC_ENDPOINT);
  
    const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(keypair));
    umi.use(signerIdentity(signer, true));
  
    const ourMetadata = {
      name: "XMAS Token Name",
      symbol: "XMASTN",
      uri: "https://raw.githubusercontent.com/ekinburak/sol-meme/master/metadata.json",
    };
    const onChainData = {
      ...ourMetadata,
      sellerFeeBasisPoints: 0,
      creators: none<Creator[]>(),
      collection: none<Collection>(),
      uses: none<Uses>(),
    };
    
    const accounts: CreateMetadataAccountV3InstructionAccounts = {
      mint: fromWeb3JsPublicKey(mint),
      mintAuthority: signer,
    };
    const data: CreateMetadataAccountV3InstructionDataArgs = {
      isMutable: true,
      collectionDetails: null,
      data: onChainData
    };
    const txid = await createMetadataAccountV3(umi, {...accounts, ...data}).sendAndConfirm(umi);
    console.log(`Metadata creation transaction ID: ${txid}`);
  }
  
  async function updateMetadata(mintAddress: string, keypair: web3.Keypair, updatedMetadata: any) {
    console.log("Updating metadata for the token");
  
    const mint = new web3.PublicKey(mintAddress);
  
    // Use the same RPC endpoint as before.
    const RPC_ENDPOINT = "https://devnet.helius-rpc.com/?api-key=a5e91db0-3801-4ca5-b5af-5878c1d2a41d";
    const umi = createUmi(RPC_ENDPOINT);
  
    const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(keypair));
    umi.use(signerIdentity(signer, true));
  
    const onChainData = {
        name: updatedMetadata.name,
        symbol: updatedMetadata.symbol,
        uri: updatedMetadata.uri,
        sellerFeeBasisPoints: updatedMetadata.sellerFeeBasisPoints,
        creators: none<Creator[]>(),
        collection: none<Collection>(),
        uses: none<Uses>(),
    };
  
    const metadataPDA = findMetadataPda(umi, { mint: fromWeb3JsPublicKey(mint) });
    const data: UpdateMetadataAccountV2InstructionData = {
        data: some(onChainData),
        discriminator: 0,
        isMutable: some(true),
        newUpdateAuthority: none<PublicKey>(),
        primarySaleHappened: none<boolean>()
    };
    const accounts: UpdateMetadataAccountV2InstructionAccounts = {
        metadata: metadataPDA,
        updateAuthority: signer
    };
    const txid = await updateMetadataAccountV2(umi, {...accounts, ...data}).sendAndConfirm(umi);
    console.log(`Metadata update transaction ID: ${txid}`);
  }
  
  export { createMetadata, updateMetadata };
  