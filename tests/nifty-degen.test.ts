import { afterAll, assert, beforeAll, clearStore, describe, mockFunction, test } from 'matchstick-as/assembly/index';
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Character } from '../generated/schema';
import { handleTransfer, handleNameUpdated } from '../src/nifty-degen';
import { createNameUpdatedEvent, createTransferEvent } from './nifty-degen-utils';

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

let contractAddress = Address.fromString('0x986aea67c7d6a15036e18678065eb663fc5be883');
let totalSupply = BigInt.fromI32(10000);
let initialOwner = Address.fromString('0x0000000000000000000000000000000000000000');
let tokenId = BigInt.fromI32(234);
let entityId = changetype<Bytes>(Bytes.fromBigInt(tokenId));

describe('Describe entity assertions', () => {
  beforeAll(() => {
    // Setup: create a Character entity
    let character = new Character(entityId);
    character.tokenId = tokenId;
    character.name = 'CurrentName';
    character.nameHistory = ['InitialName'];
    character.owner = initialOwner;
    character.createdAt = BigInt.fromI32(1);
    character.transactionHash = '0xabc';
    character.traits = entityId;
    character.save();

    // Mock contract methods
    let returnSupply = ethereum.Value.fromSignedBigInt(totalSupply);
    mockFunction(contractAddress, 'totalSupply', 'totalSupply():(uint256)', [], [returnSupply], false);
    let removedTraits = ethereum.Value.fromI32Array([1, 16, 33]);
    mockFunction(contractAddress, 'getRemovedTraits', 'getRemovedTraits():(uint16[])', [], [removedTraits], false);
  });

  afterAll(() => {
    clearStore();
  });

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test('handleNameUpdated updates character name and history', () => {
    // Call handler
    let event = createNameUpdatedEvent(tokenId, 'CurrentName', 'NewName');
    handleNameUpdated(event);

    // Assert Character updated
    assert.fieldEquals('Character', entityId.toHexString(), 'name', 'NewName');
    assert.fieldEquals('Character', entityId.toHexString(), 'nameHistory', '[InitialName, CurrentName]');

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  });

  test('handleTransfer creates new Owner and updates Character', () => {
    let from = initialOwner;
    let to = Address.fromString('0x0000000000000000000000000000000000000001');

    // Call handler
    let event = createTransferEvent(from, to, tokenId);
    event.address = contractAddress;
    handleTransfer(event);

    // Assert new Owner created
    assert.fieldEquals('Owner', to.toHexString(), 'address', to.toHexString());
    assert.fieldEquals('Owner', to.toHexString(), 'characterCount', '1');

    // Assert Character created and linked to new owner
    assert.fieldEquals('Character', entityId.toHexString(), 'owner', to.toHexString());
  });

  test('handleTransfer updates previous Owner', () => {
    let from = Address.fromString('0x0000000000000000000000000000000000000001');
    let to = Address.fromString('0x0000000000000000000000000000000000000002');

    // Call handler
    let event = createTransferEvent(from, to, tokenId);
    event.address = contractAddress;
    handleTransfer(event);

    // Assert previous Owner updated
    assert.fieldEquals('Owner', from.toHexString(), 'characterCount', '0');

    // Assert new Owner created
    assert.fieldEquals('Owner', to.toHexString(), 'address', to.toHexString());
    assert.fieldEquals('Owner', to.toHexString(), 'characterCount', '1');

    // Assert Character created and linked to new owner
    assert.fieldEquals('Character', entityId.toHexString(), 'owner', to.toHexString());
  });

  test('handleTransfer updates Character traits if new Character', () => {
    let from = initialOwner;
    let to = Address.fromString('0x0000000000000000000000000000000000000001');
    let newTokenId = BigInt.fromI32(10000);

    // Mock getName
    let args = [ethereum.Value.fromUnsignedBigInt(newTokenId)];
    let returnName = ethereum.Value.fromString('CurrentName');
    mockFunction(contractAddress, 'getName', 'getName(uint256):(string)', args, [returnName], false);

    // Mock getCharacterTraits
    let tuple = new ethereum.Tuple();
    for (let i = 1; i <= 22; i++) {
      tuple.push(ethereum.Value.fromI32(i));
    }
    let characterTraits = ethereum.Value.fromTuple(tuple);
    let fnSignature =
      'getCharacterTraits(uint256):((uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16,uint16))';
    mockFunction(contractAddress, 'getCharacterTraits', fnSignature, args, [characterTraits], false);

    // Call handler
    let event = createTransferEvent(from, to, newTokenId);
    event.address = contractAddress;
    handleTransfer(event);

    // Assert TraitMapping created
    let newEntityId = Bytes.fromBigInt(newTokenId).toHexString();
    assert.fieldEquals('TraitMap', newEntityId, 'tokenId', newTokenId.toString());
    assert.fieldEquals('TraitMap', newEntityId, 'tribe', '1');
    assert.fieldEquals('TraitMap', newEntityId, 'skinColor', '2');
    assert.fieldEquals('TraitMap', newEntityId, 'furColor', '3');
    assert.fieldEquals('TraitMap', newEntityId, 'eyeColor', '4');
    assert.fieldEquals('TraitMap', newEntityId, 'pupilColor', '5');
    // ... (assert other traits as needed)

    // Assert correct Background trait set (DEGEN 10K = Meta)
    assert.fieldEquals('TraitMap', newEntityId, 'background', '2');
  });
});
